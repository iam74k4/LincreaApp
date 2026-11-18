// マイアプリ一覧（ログイン後の最初の画面）。Web 版の /main/#/application/ にあたる。
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { SessionExpiredError } from '../../api/http';
import { fetchMyApps, type MyApp } from '../../api/myApps';
import { logout } from '../../auth/api';
import { AppDataPrefetch } from '../../components/AppDataPrefetch';
import { MyAppRow } from '../../components/MyAppRow';
import { appOrder, displayName } from '../../knownApps';
import { useSession } from '../../session/SessionContext';
import { SHORTCUTS, type Shortcut } from '../../shortcuts';
import { appDataKey, recallAppData, useAppDataVersion } from '../../webview/appDataCache';
import { savesSnapshot } from '../../webview/backgroundSaves';
import { prefetchInitApps } from '../../webview/initAppCache';
import { openShortcutDirect, openShortcutThroughMenu } from '../../openShortcut';
import { sizes, useColors, type Colors } from '../../theme';

/** アプリがこの数より多いときだけ、検索バーを出す */
const SEARCH_FROM = 8;

export default function MyAppsScreen() {
  const { session, signOut, reauthenticate } = useSession();
  const c = useColors();
  const styles = useMemo(() => createStyles(c), [c]); // ライト / ダークが切り替わったら作り直す

  // ① 画面が覚えておくこと
  const [apps, setApps] = useState<MyApp[] | null>(null); // null = まだ読み込んでいない
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  // ② 一覧を読み込む
  const handleError = useCallback(
    (e: unknown) => {
      if (e instanceof SessionExpiredError) {
        Alert.alert('ログインが切れました', e.message);
        signOut(); // 守り役がログイン画面へ戻す
        return;
      }
      setError(e instanceof Error ? e.message : String(e));
    },
    [signOut],
  );

  // サーバーに聞き直して、一覧を入れ替える。読み込み中は、いま出ている一覧をそのまま見せておく。
  // isActive() が false なら（画面を離れたあとに返事が来たら）結果は捨てる。
  const loadingRef = useRef(false);
  const fetchAndShow = useCallback(
    async (isActive: () => boolean = () => true) => {
      if (loadingRef.current) return; // 読み込みが重ならないように
      loadingRef.current = true;
      try {
        let result: MyApp[];
        try {
          result = await fetchMyApps();
        } catch (e) {
          // ログインが切れていても、Face ID で入り直せたら、もう一度読む
          if (!(e instanceof SessionExpiredError) || !(await reauthenticate())) throw e;
          result = await fetchMyApps();
        }
        if (isActive()) {
          setApps(result);
          setError(null);
        }
      } catch (e) {
        if (isActive()) handleError(e);
      } finally {
        loadingRef.current = false;
      }
    },
    [handleError, reauthenticate],
  );

  // この画面が前に出るたびに読み直す。
  //   - 最初に開いたとき
  //   - アプリ（WebView）から戻ってきたとき
  //   - ホーム画面などから、このアプリに戻ってきたとき（この画面が出ている間だけ見張る）
  // Web で追加・変更されたアプリが、開き直さなくても反映される。
  // よく使う画面の定義（initApp）を、マイアプリを見ているあいだに裏で読んでおく（src/webview/initAppCache.ts）。
  // 一覧の読み込みと取り合わないよう、少し待ってから
  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => {
        prefetchInitApps();
      }, 1500);
      return () => clearTimeout(timer);
    }, []),
  );
  const [focused, setFocused] = useState(true);
  const [prefetchFailed, setPrefetchFailed] = useState(false); // 近道の下準備がうまくいかなかった（下の ④）
  const [pending, setPending] = useState<Shortcut | null>(null); // 下準備を待っている近道
  const pendingRef = useRef<Shortcut | null>(null);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setFocused(true);
      setPrefetchFailed(false); // 前にうまくいかなかった下準備も、画面に戻ってきたらもう一度
      fetchAndShow(() => active);
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') fetchAndShow(() => active);
      });
      return () => {
        active = false;
        setFocused(false);
        pendingRef.current = null;
        setPending(null);
        subscription.remove();
      };
    }, [fetchAndShow]),
  );

  // 下に引っぱったとき・「もう一度読み込む」を押したとき
  const reload = async () => {
    setRefreshing(true);
    await fetchAndShow();
    setRefreshing(false);
  };

  // ③ 検索。サーバーに聞き直さず、手元の一覧を名前（短い名前と正式名）・ID・説明で絞り込む。
  // アプリが少ないうちは、探すより見たほうが早いので、検索バーを出さない
  const searchable = (apps?.length ?? 0) > SEARCH_FROM;
  const visibleApps = useMemo(() => {
    const q = query.trim().toLowerCase();
    // よく使うアプリ（勤怠など）を上に。同じ順位なら Web 版の順のまま（sort は安定）
    const sorted = [...(apps ?? [])].sort((a, b) => appOrder(a) - appOrder(b));
    if (q === '') return sorted;
    return sorted.filter((app) =>
      [app.name, displayName(app).name, app.logicName, app.description].some((text) => text.toLowerCase().includes(q)),
    );
  }, [apps, query]);

  // ④ 近道。使えるアプリ（一覧にあって稼働中）のものだけ。検索しているあいだは出さない
  const shortcuts = useMemo(
    () => (query.trim() ? [] : SHORTCUTS.filter((s) => apps?.some((app) => app.logicName === s.app && app.isAvailable))),
    [apps, query],
  );
  // 近道の下準備: メニューの App.data の控えがなければ、マイアプリを見ているあいだに裏で作る（AppDataPrefetch）。
  // 控えがあれば、近道はメニューを開かずに行き先を直接開く（メニューの1画面〜2画面ぶん速い）
  const appDataVersion = useAppDataVersion();
  const menu = shortcuts[0] ?? null; // 近道はどれも同じメニュー（TiMS のトップ）から
  const menuReady = useMemo(
    () => (menu ? recallAppData(appDataKey(menu.app, menu.form)) !== null : false),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 控えが変わったら（appDataVersion）測り直す
    [menu, appDataVersion],
  );
  const prefetching = menu !== null && focused && !menuReady && !prefetchFailed;

  const openShortcut = (shortcut: Shortcut) => {
    const appData = recallAppData(appDataKey(shortcut.app, shortcut.form));
    if (appData) {
      openDirect(shortcut, appData);
      return;
    }
    if (prefetching) {
      // 下準備がもうすぐ終わるので、待ってから直接開く（終わったら onPrefetched。待ちすぎたらメニュー経由で）
      pendingRef.current = shortcut;
      setPending(shortcut);
      setTimeout(() => {
        if (pendingRef.current !== shortcut) return;
        pendingRef.current = null;
        setPending(null);
        setPrefetchFailed(true);
        openThroughMenu(shortcut);
      }, 12000);
      return;
    }
    openThroughMenu(shortcut);
  };
  const onPrefetched = (ok: boolean) => {
    if (!ok) setPrefetchFailed(true);
    const waiting = pendingRef.current;
    if (!waiting) return;
    pendingRef.current = null;
    setPending(null);
    const appData = recallAppData(appDataKey(waiting.app, waiting.form));
    if (appData) openDirect(waiting, appData);
    else openThroughMenu(waiting);
  };
  // 行き先の画面を直接開く / 控えがないときはメニューを裏で開いて進む（src/openShortcut.ts）
  const openDirect = (shortcut: Shortcut, appData: string) => openShortcutDirect(shortcut, appData);
  const openThroughMenu = (shortcut: Shortcut) => openShortcutThroughMenu(shortcut);

  // ⑤ 行を押したら、そのアプリを開く
  const openApp = (app: MyApp) => {
    if (!app.isAvailable) {
      Alert.alert('起動できません', 'このアプリは稼働していないため起動できません。');
      return;
    }
    router.push({
      pathname: '/run/[app]/[form]',
      params: { app: app.logicName, form: app.formName, title: displayName(app).name },
    });
  };

  const confirmLogout = () => {
    // 保存（登録・削除など）を裏で続けているあいだは、ログアウトしない。画面ごとページが消えて保存が途中で切れ、
    // 書きかけがサーバーに残って、次の保存が待たされるため（src/webview/backgroundSaves.ts）
    const running = savesSnapshot().current;
    if (running) {
      Alert.alert('保存しています', `${running.title}の保存が終わってから、ログアウトしてください。`);
      return;
    }
    const who = session?.username ? `${session.username} から` : '';
    Alert.alert('ログアウト', `${who}ログアウトしますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: 'ログアウト',
        style: 'destructive',
        onPress: async () => {
          await logout(); // サーバー側のログインも終わらせる
          signOut(); // 守り役がログイン画面へ戻す
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          // 検索は、ヘッダーに付く端末標準の検索バーで。打つたびに手元の一覧を絞り込む
          headerSearchBarOptions: searchable
            ? {
                placeholder: 'アプリを検索',
                autoCapitalize: 'none',
                hideWhenScrolling: false,
                onChangeText: (e) => setQuery(e.nativeEvent.text),
                onCancelButtonPress: () => setQuery(''),
              }
            : undefined,
          headerRight: () => (
            <Pressable onPress={confirmLogout} accessibilityRole="button" accessibilityLabel="ログアウト" hitSlop={8}>
              <SymbolView
                name={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }}
                size={20}
                tintColor={c.accent}
              />
            </Pressable>
          ),
        }}
      />
      {prefetching && menu && (
        <AppDataPrefetch app={menu.app} form={menu.form} ready={menu.ready} onDone={onPrefetched} />
      )}
      {/* 大きな見出しが縮む動きのために、一覧はこの画面のいちばん外側に置く */}
      <FlatList
        style={styles.list}
        data={visibleApps}
        keyExtractor={(app) => app.id}
        renderItem={({ item, index }) => (
          <MyAppRow app={item} onPress={() => openApp(item)} first={index === 0} last={index === visibleApps.length - 1} />
        )}
        ItemSeparatorComponent={() => (
          <View style={styles.separatorRow}>
            <View style={styles.separator} />
          </View>
        )}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          apps ? (
            <View>
              {shortcuts.length > 0 && <Text style={[styles.sectionTitle, styles.firstSectionTitle]}>よく使う</Text>}
              {shortcuts.length > 0 && (
                <View style={styles.shortcuts}>
                  {shortcuts.map((shortcut) => (
                    <Pressable
                      key={shortcut.key}
                      onPress={() => openShortcut(shortcut)}
                      style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]}
                      accessibilityRole="button"
                      accessibilityLabel={`${shortcut.title}、${shortcut.subtitle}`}
                    >
                      <View style={[styles.shortcutIcon, { backgroundColor: shortcut.color }]}>
                        {pending?.key === shortcut.key ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <SymbolView name={shortcut.symbol} size={18} weight="semibold" tintColor="#FFFFFF" />
                        )}
                      </View>
                      <View style={styles.shortcutText}>
                        <Text style={styles.shortcutTitle} numberOfLines={1}>
                          {shortcut.title}
                        </Text>
                        <Text style={styles.shortcutSubtitle} numberOfLines={1}>
                          {shortcut.subtitle}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
              {shortcuts.length > 0 && visibleApps.length > 0 && <Text style={styles.sectionTitle}>アプリ</Text>}
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          <EmptyState
            styles={styles}
            colors={c}
            loading={apps === null && error === null}
            error={error}
            query={query}
            onRetry={reload}
          />
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentInsetAdjustmentBehavior="automatic"
      />
    </>
  );
}

// ---- この画面の中だけで使う小さな部品 ----

function EmptyState({
  styles,
  colors,
  loading,
  error,
  query,
  onRetry,
}: {
  styles: ReturnType<typeof createStyles>;
  colors: Colors;
  loading: boolean;
  error: string | null;
  query: string;
  onRetry: () => void;
}) {
  if (loading) {
    return <ActivityIndicator style={styles.empty} color={colors.textSecondary} />;
  }
  if (error) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{error}</Text>
        <Pressable onPress={onRetry} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.retryText}>もう一度読み込む</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>
        {query.trim() ? `「${query.trim()}」に当てはまるアプリはありません。` : '使えるアプリはありません。'}
      </Text>
    </View>
  );
}

function createStyles(c: Colors) {
  return StyleSheet.create({
    list: {
      flex: 1,
      backgroundColor: c.background,
    },
    listContent: {
      paddingBottom: 32,
    },
    // 小見出しは、アプリの中の画面（お知らせ・今日と未登録の日 など）と同じ 13pt の太字の灰色
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: c.textSecondary,
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 8,
    },
    // 大きな見出し（マイアプリ）のすぐ下の小見出しは、「アプリ」の上と同じくらい間をあける
    firstSectionTitle: {
      paddingTop: 16,
    },
    shortcuts: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      paddingHorizontal: 16,
      paddingBottom: 20,
    },
    shortcutIcon: {
      width: 32,
      height: 32,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },
    shortcut: {
      flexGrow: 1,
      flexBasis: '45%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 64,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: sizes.cardRadius,
      backgroundColor: c.card,
    },
    pressed: {
      opacity: 0.6,
    },
    shortcutText: {
      flex: 1,
      gap: 2,
    },
    shortcutTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: c.text,
    },
    shortcutSubtitle: {
      fontSize: 13,
      color: c.textSecondary,
    },
    // 行の間の線。カードの地の上に、アイコンの右（文字の頭）から引く
    separatorRow: {
      marginHorizontal: 16,
      backgroundColor: c.card,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      marginLeft: 74,
      backgroundColor: c.separator,
    },
    empty: {
      marginTop: 64,
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 32,
    },
    emptyText: {
      fontSize: 15,
      color: c.textSecondary,
      textAlign: 'center',
    },
    retryText: {
      fontSize: 15,
      fontWeight: '600',
      color: c.accent,
    },
  });
}
