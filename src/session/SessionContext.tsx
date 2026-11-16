// 「いまログインしているか」を、アプリ全体で1か所に持つ。
// 画面はここを見て表示を切り替える（どの画面を出すかは src/app/_layout.tsx の守り役が決める）。
//
// 起動したときは、サーバーのログインがまだ有効か確かめて、有効ならログイン画面を飛ばす。
// 確かめている間は restoring が true（その間は画面を出さずに待つ）。
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { Session } from '../auth/api';
import { clearSavedSession, restoreSession, saveSession } from '../auth/savedSession';
import { discardOld } from '../files';
import { forgetAllAppData } from '../webview/appDataCache';
import { forgetAllInitApps, forgetInitAppTexts } from '../webview/initAppCache';

type SessionContextValue = {
  session: Session | null;
  restoring: boolean;
  signIn: (session: Session) => void;
  signOut: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    let active = true;
    restoreSession().then((restored) => {
      if (!active) return;
      setSession((current) => current ?? restored); // 確かめている間にログインしていたら、そちらを優先
      setRestoring(false);
    });
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
    forgetAllAppData();
    forgetAllInitApps(); // 画面の定義の控えと、裏で読む画面の覚え書き
    discardOld(true); // 受け取った明細などのファイルも残さない
    setSession(null);
    clearSavedSession();
  }, []);

  // 中身が変わらない限り同じ値を渡す（使う側の再描画や useEffect の空回りを防ぐ）
  const value = useMemo(() => ({ session, restoring, signIn, signOut }), [session, restoring, signIn, signOut]);
  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): SessionContextValue {
  const value = use(SessionContext);
  if (!value) throw new Error('useSession は SessionProvider の中で使ってください');
  return value;
}
