import { useEffect, useMemo, useRef, useState, type Ref } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useColorScheme,
  type TextInputInstance,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { login, LoginError, type Session } from '../auth/login';
import { biometry, disableFaceId, enableFaceId, faceIdUser, loginWithFaceId, renewFaceIdToken, type Biometry } from '../auth/faceId';
import { loadRememberedUsername, saveRememberedUsername } from '../auth/rememberedUsername';
import { versionLabel } from '../core/appVersion';
import { DEMO_SESSION, isDemoCredentials } from '../demo/demoAccount';
import { GlassButton } from '../components/GlassButton';
import { Icon } from '../platform/icons';
import { sizes, useColors, type Colors } from '../core/theme';

type Props = {
  /** ログインできたら呼ぶ。次の画面へ進むのは呼んだ側の仕事 */
  onLoggedIn: (session: Session) => void;
  onForgotPassword: () => void;
  onLoginHelp: () => void;
};

/** ログイン画面の上の、会社のロゴ（表示は 220×40pt。@2x・@3x の画像もある） */
const LOGO = require('../../assets/logo.png');
const LOGO_DARK = require('../../assets/logo-dark.png');

export function LoginScreen({ onLoggedIn, onForgotPassword, onLoginHelp }: Props) {
  const c = useColors();
  const scheme = useColorScheme();
  const styles = useMemo(() => createStyles(c), [c]); // ライト / ダークが切り替わったら作り直す

  // ① 画面が覚えておくこと（state）
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberUsername, setRememberUsername] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // パスワードを見えるようにする（打ち間違いの確認）
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Face ID（Touch ID）。kind はこの端末で使えるもの（使えなければ null）、bioUser は Face ID でログインできる人
  const [kind, setKind] = useState<Biometry | null>(null);
  const [bioUser, setBioUser] = useState<string | null>(null);
  const [useBio, setUseBio] = useState(false); // 「Face ID でログイン」のスイッチ（パスワードでログインしたときに決まる）

  // 「次へ」でパスワード欄に移るために、パスワード欄を直接触れるようにしておく
  const passwordRef = useRef<TextInputInstance>(null);

  // ② 開いたとき、前回保存したユーザー名があれば入れておく。Face ID が使えるかも見る
  useEffect(() => {
    let active = true;
    loadRememberedUsername().then((saved) => {
      if (!active || !saved) return;
      setUsername((current) => (current === '' ? saved : current)); // 先に打ち始めていたら上書きしない
      setRememberUsername(true);
    });
    Promise.all([biometry(), faceIdUser()]).then(([k, user]) => {
      if (!active) return;
      setKind(k);
      setBioUser(k ? user : null);
      setUseBio(k !== null && user !== null);
    });
    return () => {
      active = false;
    };
  }, []);

  // ③ ログインを押したとき
  async function handleSubmit() {
    if (submitting) return; // 二度押しで二重に送らない

    const name = username.trim();
    if (name === '' || password === '') {
      setError('ユーザー名とパスワードを入力してください。');
      return;
    }

    Keyboard.dismiss();
    // 審査用のデモ: サーバーにはつながず、見本のデータで開く（Face ID・ユーザー名の保持は使わない。src/demo/demoAccount.ts）
    if (isDemoCredentials(name, password)) {
      setPassword('');
      setError(null);
      onLoggedIn(DEMO_SESSION);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { session, refreshToken } = await login(name, password, rememberUsername);
      await saveRememberedUsername(rememberUsername ? name : null);
      setPassword(''); // パスワードは画面に残さない
      // Face ID: スイッチがオンなら、次から Face ID でログインできるようにする（同じ人なら、鍵を新しくするだけ）。
      // オフなら、前に入れた鍵を消す。Face ID をやめても（顔が合わなくても）、ログインはそのまま進める
      if (kind && useBio) {
        if (bioUser === name) await renewFaceIdToken(name, refreshToken);
        else if (!(await enableFaceId(name, refreshToken, kind))) {
          // やめた・顔が合わなかった・保存できなかった。ログインはそのまま進め、次も同じかどうかを伝えておく
          Alert.alert(`${kind} は使えるようになっていません`, `次もパスワードでログインします。${kind} を使うときは、ログイン画面のスイッチをオンにしてログインし直してください。`);
        }
      } else if (bioUser) {
        await disableFaceId();
      }
      onLoggedIn(session);
    } catch (e) {
      if (e instanceof LoginError) {
        setError(e.message);
      } else {
        // 想定外の失敗。開発中は原因が分かるように中身も出す
        const detail = e instanceof Error ? e.message : String(e);
        console.log(`[login] NG ${detail}`);
        setError(
          __DEV__
            ? `通信でつまずきました: ${detail}`
            : '通信できませんでした。電波のよい所でもう一度お試しください。',
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Face ID でログインする（パスワードは使わない）
  async function handleFaceId() {
    if (submitting) return;
    Keyboard.dismiss();
    setSubmitting(true);
    setError(null);
    try {
      const result = await loginWithFaceId();
      if (result.ok) {
        onLoggedIn(result.session);
        return;
      }
      // やめた・顔が合わなかったときは、何も言わない（パスワードでもログインできる）
      if (result.message) setError(result.message);
      if (result.reason === 'reset' || result.reason === 'expired' || result.reason === 'off') {
        setBioUser(null); // 鍵はもう使えないので、ボタンを消す（スイッチはオンのまま。パスワードでログインすると入れ直す）
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ④ 見た目。上から順に、会社のロゴ → 入力欄2つ → 保持スイッチ → エラー → ボタン → ヘルプ → 版
  return (
    <SafeAreaView style={styles.page}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled" // キーボードが出ていてもボタンを1回で押せるように
        >
          <View style={styles.form}>
            <View style={styles.heading}>
              {/* 会社のロゴ（暗い表示では、紺と黒の字を白にしたもの。assets/brand-logo.svg から作った画像） */}
              <Image
                source={scheme === 'dark' ? LOGO_DARK : LOGO}
                style={styles.logo}
                resizeMode="contain"
                accessibilityRole="header"
                accessibilityLabel="LINCREA"
              />
            </View>

            <View style={styles.fields}>
              <Field
                styles={styles}
                colors={c}
                placeholder="ユーザー名"
                accessibilityLabel="ユーザー名"
                value={username}
                onChangeText={(text) => {
                  setUsername(text);
                  setError(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                textContentType="username"
                returnKeyType="next"
                submitBehavior="submit" // 「次へ」でキーボードを閉じずにパスワード欄へ
                onSubmitEditing={() => passwordRef.current?.focus()}
                editable={!submitting}
              />
              <View style={styles.passwordBox}>
                <Field
                  ref={passwordRef}
                  styles={styles}
                  colors={c}
                  placeholder="パスワード"
                  accessibilityLabel="パスワード"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setError(null);
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="current-password"
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={handleSubmit}
                  editable={!submitting}
                  style={styles.passwordInput}
                />
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  style={styles.eye}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}
                >
                  <Icon name={showPassword ? 'eye-off' : 'eye'} size={20} tintColor={c.textSecondary} />
                </Pressable>
              </View>
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>ユーザー名を保持する</Text>
              <Switch
                value={rememberUsername}
                onValueChange={setRememberUsername}
                trackColor={{ false: c.switchOff, true: c.accent }}
                accessibilityLabel="ユーザー名を保持する"
              />
            </View>

            {kind && (
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>次から {kind} でログイン</Text>
                <Switch
                  value={useBio}
                  onValueChange={setUseBio}
                  trackColor={{ false: c.switchOff, true: c.accent }}
                  accessibilityLabel={`次から ${kind} でログイン`}
                />
              </View>
            )}

            {error && (
              <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
                {error}
              </Text>
            )}

            <GlassButton onPress={handleSubmit} disabled={submitting} busy={submitting} accessibilityLabel="ログイン" style={styles.button}>
              {submitting ? (
                <ActivityIndicator color={c.onAccent} />
              ) : (
                <Text style={styles.buttonText}>ログイン</Text>
              )}
            </GlassButton>

            {kind && bioUser && (
              <Pressable
                onPress={handleFaceId}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel={`${kind} でログイン`}
                style={({ pressed }) => [styles.bioButton, (pressed || submitting) && styles.bioButtonPressed]}
              >
                <Icon name={kind === 'Face ID' || kind === '顔認証' ? 'face' : 'fingerprint'} size={22} tintColor={c.accent} />
                <Text style={styles.bioButtonText}>{kind} でログイン</Text>
              </Pressable>
            )}

            <View style={styles.links}>
              <TextLink styles={styles} label="パスワードをお忘れの方はこちら" onPress={onForgotPassword} />
              <TextLink styles={styles} label="ログイン方法がご不明な方はこちら" onPress={onLoginHelp} />
            </View>
          </View>
        </ScrollView>

        <Text style={styles.version}>{versionLabel()}</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---- この画面の中だけで使う小さな部品 ----

type Styles = ReturnType<typeof createStyles>;

/** 入力欄。選んでいる間だけ、ふちを差し色にする */
function Field({
  ref,
  styles,
  colors,
  ...inputProps
}: TextInputProps & { ref?: Ref<TextInputInstance>; styles: Styles; colors: Colors }) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={colors.textSecondary}
      {...inputProps}
      onFocus={(e) => {
        setFocused(true);
        inputProps.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        inputProps.onBlur?.(e);
      }}
      style={[styles.input, inputProps.style, focused && styles.inputFocused]}
    />
  );
}

function TextLink({ styles, label, onPress }: { styles: Styles; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" hitSlop={8}>
      {({ pressed }) => <Text style={[styles.link, pressed && styles.linkPressed]}>{label}</Text>}
    </Pressable>
  );
}

function createStyles(c: Colors) {
  return StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor: c.background,
    },
    flex: { flex: 1 },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    form: {
      width: '100%',
      maxWidth: sizes.formWidth,
      gap: 16,
    },
    heading: {
      alignItems: 'center',
      marginBottom: 24,
    },
    logo: {
      width: 220,
      height: 40,
    },
    fields: {
      gap: 12,
    },
    input: {
      height: sizes.control,
      borderRadius: sizes.radius,
      paddingHorizontal: 16,
      backgroundColor: c.fill,
      borderWidth: 1.5,
      borderColor: 'transparent',
      fontSize: 17,
      color: c.text,
    },
    inputFocused: {
      borderColor: c.accent,
    },
    passwordBox: {
      justifyContent: 'center',
    },
    passwordInput: {
      paddingRight: 52,
    },
    eye: {
      position: 'absolute',
      right: 4,
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
    },
    switchLabel: {
      fontSize: 15,
      color: c.text,
    },
    error: {
      fontSize: 14,
      color: c.danger,
      paddingHorizontal: 4,
    },
    button: {
      marginTop: 4,
    },
    // Face ID でログイン: 2つ目のボタンなので、灰色のカプセルに差し色の文字（ほかの画面の2つ目のボタンと同じ）
    bioButton: {
      height: sizes.control,
      borderRadius: sizes.control / 2,
      backgroundColor: c.fill,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    bioButtonPressed: {
      opacity: 0.6,
    },
    bioButtonText: {
      fontSize: 17,
      fontWeight: '600',
      color: c.accent,
    },
    buttonText: {
      fontSize: 17,
      fontWeight: '600',
      color: c.onAccent,
    },
    links: {
      alignItems: 'center',
      gap: 14,
      marginTop: 8,
    },
    link: {
      fontSize: 15,
      color: c.accent,
    },
    linkPressed: {
      opacity: 0.6,
    },
    version: {
      alignSelf: 'center',
      paddingBottom: 8,
      fontSize: 12,
      color: c.textSecondary,
    },
  });
}
