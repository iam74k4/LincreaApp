// 「いまログインしているか」を、アプリ全体で1か所に持つ。
// 画面はここを見て表示を切り替える（どの画面を出すかは src/app/_layout.tsx の守り役が決める）。
//
// 起動したときは、サーバーのログインがまだ有効か確かめて、有効ならログイン画面を飛ばす（電波がないときは、前の人のまま始める）。
// 切れていても、Face ID でログインできるようにしてあれば、Face ID で入り直す（src/auth/faceId.ts）。
// 確かめている間は restoring が true（その間は画面を出さずに待つ）。
//
// 使っているあいだにログインが切れたときも、Face ID で入り直せれば、その場で続けられる（reauthenticate）。
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { DEMO_SESSION, isDemoSession, rememberDemo, wasDemo } from '../demo/demoAccount';
import { resetDemo } from '../demo/demoStore';
import { forgetCachedApps } from '../myApps/myAppsCache';
import { attendanceRemindersFor, forgetAttendanceReminders } from '../attendance/attendanceReminder';
import { forgetServerLogin, type Session } from '../auth/login';
import { forgetCognitoTokens, loadCognitoStorage } from '../auth/cognitoStorage';
import { loginWithFaceId } from '../auth/faceId';
import { forgetPayslipPassword } from '../auth/payslipPassword';
import { clearSavedSession, restoreSession, saveSession } from '../auth/savedSession';
import { discardOld } from '../platform/files';
import { forgetAllLaunches } from '../shortcuts/launch';
import { stopApplyQueue } from '../shortcuts/openShortcut';
import { forgetAllAppData } from '../webview/appDataCache';
import { resetSaves } from '../webview/backgroundSaves';
import { forgetAllHandoffs } from '../webview/handoff';
import { forgetAllInitApps, forgetInitAppTexts } from '../webview/initAppCache';

/**
 * 入り直した結果:
 *   ok      … 入り直せた（そのまま続ける）
 *   offline … つながらなかった（ログインのまま。電波のよい所でもう一度）
 *   failed  … 入り直せない（Face ID を使っていない・やめた・鍵が使えない・別の人の鍵）。ログイン画面へ
 */
export type Reauth = 'ok' | 'offline' | 'failed';

type SessionContextValue = {
  session: Session | null;
  restoring: boolean;
  signIn: (session: Session) => void;
  /**
   * ログイン画面に戻る。byUser は、使う人がログアウトのボタンを押したとき（覚えさせた明細のパスワードも消す）。
   * ログインが切れて戻るときは消さない（Face ID で入り直せなかっただけで、明細のパスワードまで覚え直させない）
   */
  signOut: (options?: { byUser?: boolean }) => void;
  /**
   * ログインが切れたときに、いまの人の Face ID で入り直す。いくつもの画面が同時に気づいても、Face ID は1回だけ出す
   */
  reauthenticate: () => Promise<Reauth>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [restoring, setRestoring] = useState(true);

  // いまの人（reauthenticate が、その人の鍵でだけ入り直すため）
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // 受け取った明細などのファイルを、残しすぎない（起動したとき・アプリが裏に回ったときに、古いものを消す。src/platform/files.ts）
  useEffect(() => {
    discardOld();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') discardOld();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      // 審査用のデモのままだった: サーバーには確かめずに、デモで始める（src/demo/demoAccount.ts）
      if (await wasDemo()) {
        if (!active) return;
        setSession((current) => current ?? DEMO_SESSION);
        setRestoring(false);
        return;
      }
      // 前の版が端末に残したトークンを消す（src/auth/cognitoStorage.ts）。サーバーへの確かめと同時に進める（起動を待たせない）
      const [, result] = await Promise.all([loadCognitoStorage(), restoreSession()]);
      // 端末に残っている勤怠の通知は、前にログインしていた人のもの（ログアウトで消すので）。
      // そのあと別の人がログインしたら、signIn で消す（ログインが切れて入り直せなかったときは、ログアウトを通らない）
      const savedUser = (result.status === 'valid' ? result.session : result.saved)?.username;
      if (savedUser) attendanceRemindersFor(savedUser);
      // 電波がない: 前にログインしていた人なら、その人の画面（マイアプリ）を出しておく。一覧は「つながっていません」と
      // 「もう一度読み込む」を出し、つながって読み直したときに、ログインが切れていればログイン画面に戻す
      let restored: Session | null = result.status === 'valid' ? result.session : result.status === 'offline' ? result.saved : null;
      // サーバーのログインが切れていたら、Face ID で入り直す（使っていなければ、何も出さずにログイン画面へ）。
      // 前にログインしていた人がいれば、その人の鍵でだけ（ほかの人の鍵で入ると、前の人の通知などと食い違う）
      if (!restored && result.status === 'expired' && active) {
        // 確かめたときに着いたログイン画面から、Cognito の設定を読めていれば、それを使う（ログイン画面を読み直さない）
        const faceId = await loginWithFaceId(result.pool, result.saved?.username ?? null);
        if (faceId.ok) {
          forgetAllAppData();
          forgetInitAppTexts();
          restored = faceId.session;
          attendanceRemindersFor(faceId.session.username);
          saveSession(faceId.session);
        }
      }
      if (!active) return;
      setSession((current) => current ?? restored); // 確かめている間にログインしていたら、そちらを優先
      setRestoring(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback((next: Session) => {
    forgetAllAppData(); // 前にログインしていた人の控え（近道のため）は使わない
    forgetInitAppTexts(); // 画面の定義の控えにも、前のログインの記録が入っている
    attendanceRemindersFor(next.username); // 前の人の勤怠の通知が残っていたら消す
    setSession(next);
    // 審査用のデモは、ユーザー名を控えない（次の起動でサーバーに確かめに行かないように。デモの印だけを覚える）
    if (isDemoSession(next)) rememberDemo(true);
    else {
      rememberDemo(false);
      saveSession(next);
    }
  }, []);

  const signOut = useCallback((options?: { byUser?: boolean }) => {
    forgetCognitoTokens(); // メモリに置いていたトークンも消す
    forgetServerLogin(); // なりすまし防止の合言葉も
    forgetAllAppData();
    forgetAllInitApps(); // 画面の定義の控えと、裏で読む画面の覚え書き
    forgetAllHandoffs(); // 画面から画面へ渡していた、開いた元のデータ（ログインした人の情報が入る）
    forgetAllLaunches(); // 近道で次の画面に引き継いでいた、押す段と入れておく値
    stopApplyQueue(); // まとめて申請の残り
    discardOld(true); // 受け取った明細などのファイルも残さない
    resetSaves(); // 裏で続けていた保存の知らせも消す
    forgetAttendanceReminders(); // 勤怠登録の通知の予約と、覚えていた勤務表の状態も消す
    forgetCachedApps(); // マイアプリの一覧の控えも
    // 使う人がログアウトしたときは、明細のパスワード（イントラのパスワード）も消す。ログアウトが、覚えさせたパスワードを消す方法になる。
    // ログインが切れて戻るときは消さない。ログインの Face ID の鍵は、どちらでも残す（次から Face ID でログインできるように。docs/device-testing.md）
    if (options?.byUser) forgetPayslipPassword();
    rememberDemo(false); // 審査用のデモの印と、デモで登録した見本も消す
    resetDemo();
    setSession(null);
    clearSavedSession();
  }, []);

  const reauthenticating = useRef<Promise<Reauth> | null>(null);
  const reauthenticate = useCallback(() => {
    // 審査用のデモは、ログインが切れない（サーバーにつないでいない）
    if (isDemoSession(sessionRef.current)) return Promise.resolve<Reauth>('ok');
    if (!reauthenticating.current) {
      // いまの人の鍵でだけ入り直す（別の人の鍵で入ると、画面の人とサーバーにログインした人が食い違う）
      reauthenticating.current = loginWithFaceId(null, sessionRef.current?.username ?? null)
        .then((result): Reauth => {
          // つながらなかっただけなら、ログインのまま（電波のよい所でもう一度。ログアウトさせない）
          if (!result.ok) return result.reason === 'offline' ? 'offline' : 'failed';
          // 同じ人でも、画面の定義の控えには前のログインの記録が入っているので、読み直してもらう
          forgetAllAppData();
          forgetInitAppTexts();
          return 'ok';
        })
        .finally(() => {
          reauthenticating.current = null;
        });
    }
    return reauthenticating.current;
  }, []);

  // 中身が変わらない限り同じ値を渡す（使う側の再描画や useEffect の空回りを防ぐ）
  const value = useMemo(
    () => ({ session, restoring, signIn, signOut, reauthenticate }),
    [session, restoring, signIn, signOut, reauthenticate],
  );
  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): SessionContextValue {
  const value = use(SessionContext);
  if (!value) throw new Error('useSession は SessionProvider の中で使ってください');
  return value;
}
