import { useEffect, useMemo, useRef, useState, type Ref } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type TextInputInstance,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import Constants from 'expo-constants';

import { login, LoginError, type Session } from '../auth/api';
import { loadRememberedUsername, saveRememberedUsername } from '../auth/rememberedUsername';
import { GlassButton } from '../components/GlassButton';
import { sizes, useColors, type Colors } from '../theme';

type Props = {
  /** 見出しの下に出す、ログイン先の名前（Web 版ならサブドメインにあたる） */
  workspaceName: string;
  /** ログインできたら呼ぶ。次の画面へ進むのは呼んだ側の仕事 */
  onLoggedIn: (session: Session) => void;
  onForgotPassword: () => void;
  onLoginHelp: () => void;
};

export function LoginScreen({ workspaceName, onLoggedIn, onForgotPassword, onLoginHelp }: Props) {
  const c = useColors();
  const styles = useMemo(() => createStyles(c), [c]); // ライト / ダークが切り替わったら作り直す

  // ① 画面が覚えておくこと（state）
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberUsername, setRememberUsername] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // パスワードを見えるようにする（打ち間違いの確認）
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 「次へ」でパスワード欄に移るために、パスワード欄を直接触れるようにしておく
  const passwordRef = useRef<TextInputInstance>(null);

  // ② 開いたとき、前回保存したユーザー名があれば入れておく
  useEffect(() => {
    let active = true;
    loadRememberedUsername().then((saved) => {
      if (!active || !saved) return;
      setUsername((current) => (current === '' ? saved : current)); // 先に打ち始めていたら上書きしない
      setRememberUsername(true);
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
    setSubmitting(true);
    setError(null);
    try {
      const session = await login(name, password, rememberUsername);
      await saveRememberedUsername(rememberUsername ? name : null);
      setPassword(''); // パスワードは画面に残さない
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

  // ④ 見た目。上から順に、見出し → 入力欄2つ → 保持スイッチ → エラー → ボタン → ヘルプ → 版
  return (
    <SafeAreaView style={styles.page}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled" // キーボードが出ていてもボタンを1回で押せるように
        >
          <View style={styles.form}>
            <View style={styles.heading}>
              <View style={styles.mark}>
                <SymbolView
                  name={{ ios: 'square.stack.3d.up.fill', android: 'stacks', web: 'stacks' }}
                  size={28}
                  tintColor={c.onAccent}
                />
              </View>
              <Text style={styles.title} accessibilityRole="header">
                MyApp
              </Text>
              <Text style={styles.subtitle}>{workspaceName}</Text>
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
                  <SymbolView
                    name={showPassword ? { ios: 'eye.slash', android: 'visibility_off', web: 'visibility_off' } : { ios: 'eye', android: 'visibility', web: 'visibility' }}
                    size={20}
                    tintColor={c.textSecondary}
                  />
                </Pressable>
              </View>
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>ユーザー名を保持する</Text>
              <Switch
                value={rememberUsername}
                onValueChange={setRememberUsername}
                trackColor={{ true: c.accent }}
                accessibilityLabel="ユーザー名を保持する"
              />
            </View>

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

            <View style={styles.links}>
              <TextLink styles={styles} label="パスワードをお忘れの方はこちら" onPress={onForgotPassword} />
              <TextLink styles={styles} label="ログイン方法がご不明な方はこちら" onPress={onLoginHelp} />
            </View>
          </View>
        </ScrollView>

        <Text style={styles.version}>v{Constants.expoConfig?.version}</Text>
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
      gap: 4,
      marginBottom: 16,
    },
    mark: {
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: c.text,
    },
    subtitle: {
      fontSize: 15,
      color: c.textSecondary,
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
