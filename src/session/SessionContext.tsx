// 「いまログインしているか」を、アプリ全体で1か所に持つ。
// 画面はここを見て表示を切り替える（どの画面を出すかは src/app/_layout.tsx の守り役が決める）。
//
// 起動したときは、サーバーのログインがまだ有効か確かめて、有効ならログイン画面を飛ばす（電波がないときは、前の人のまま始める）。
// 切れていても、Face ID でログインできるようにしてあれば、Face ID で入り直す（src/auth/faceId.ts）。
// 確かめている間は restoring が true（その間は画面を出さずに待つ）。
//
// 使っているあいだにログインが切れたときも、Face ID で入り直せれば、その場で続けられる（reauthenticate）。
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { forgetAttendanceReminders } from '../attendanceReminder';
import type { Session } from '../auth/api';
import { forgetCognitoTokens, loadCognitoStorage } from '../auth/cognitoStorage';
import { loginWithFaceId } from '../auth/faceId';
import { clearSavedSession, restoreSession, saveSession } from '../auth/savedSession';
import { discardOld } from '../files';
import { forgetAllAppData } from '../webview/appDataCache';
import { resetSaves } from '../webview/backgroundSaves';
import { forgetAllInitApps, forgetInitAppTexts } from '../webview/initAppCache';

type SessionContextValue = {
  session: Session | null;
  restoring: boolean;
  signIn: (session: Session) => void;
  signOut: () => void;
  /**
   * ログインが切れたときに、Face ID で入り直す。入り直せたら true（Face ID を使っていない・やめたなら false）。
   * いくつもの画面が同時に気づいても、Face ID は1回だけ出す
   */
  reauthenticate: () => Promise<boolean>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      // 前の版が端末に残したトークンを消す（src/auth/cognitoStorage.ts）
      await loadCognitoStorage();
      const result = await restoreSession();
      // 電波がない: 前にログインしていた人なら、その人の画面（マイアプリ）を出しておく。一覧は「つながっていません」と
      // 「もう一度読み込む」を出し、つながって読み直したときに、ログインが切れていればログイン画面に戻す
      let restored: Session | null = result.status === 'valid' ? result.session : result.status === 'offline' ? result.saved : null;
      // サーバーのログインが切れていたら、Face ID で入り直す（使っていなければ、何も出さずにログイン画面へ）
      if (!restored && result.status === 'expired' && active) {
        const faceId = await loginWithFaceId();
        if (faceId.ok) {
          forgetAllAppData();
          forgetInitAppTexts();
          restored = faceId.session;
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
    setSession(next);
    saveSession(next);
  }, []);

  const signOut = useCallback(() => {
    forgetCognitoTokens(); // メモリに置いていたトークンも消す
    forgetAllAppData();
    forgetAllInitApps(); // 画面の定義の控えと、裏で読む画面の覚え書き
    discardOld(true); // 受け取った明細などのファイルも残さない
    resetSaves(); // 裏で続けていた保存の知らせも消す
    forgetAttendanceReminders(); // 勤怠登録の通知の予約と、覚えていた勤務表の状態も消す
    setSession(null);
    clearSavedSession();
  }, []);

  const reauthenticating = useRef<Promise<boolean> | null>(null);
  const reauthenticate = useCallback(() => {
    if (!reauthenticating.current) {
      reauthenticating.current = loginWithFaceId()
        .then((result) => {
          if (!result.ok) return false;
          // 同じ人でも、画面の定義の控えには前のログインの記録が入っているので、読み直してもらう
          forgetAllAppData();
          forgetInitAppTexts();
          return true;
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
