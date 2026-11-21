// 給与・賞与明細: パスワードを Face ID で入れる（src/auth/payslipPassword.ts。ページの側は appStyles.ts の L_Payslip）。
//   - Face ID で開けるなら、ページに伝える（ダイアログを開くと、ページが Face ID を頼んでくる）
//   - 頼まれたら、Face ID で本人か確かめて、覚えておいたパスワードを欄に入れて開く
//   - 手で入れて明細が開けたら、次から Face ID を使うか聞く（使っていれば、覚えているパスワードを入れ替える）
// 明細の画面（PAYSLIP_APP）でないときは、何もしない。
import { useCallback, useEffect, useRef, useState, type ComponentRef, type RefObject } from 'react';
import { Alert } from 'react-native';
import type { WebView } from 'react-native-webview';

import type { Biometry } from '../../auth/faceId';
import {
  declinePayslipFaceId,
  enablePayslipFaceId,
  payslipBiometry,
  payslipBiometryToOffer,
  readPayslipPassword,
  renewPayslipPassword,
} from '../../auth/payslipPassword';
import { pwBioJs, pwFillJs } from '../../webview/page/bridgeJs';

/** 給与・賞与明細のアプリケーション ID（パスワードを Face ID で入れる） */
const PAYSLIP_APP = 'L_Payslip';

/** 手で入れたパスワードを、明細が届いたときに「正しかった」と見なせる長さ */
const TYPED_VALID_MS = 60_000;

export type PayslipPassword = {
  /** この画面が明細の画面か */
  payslip: boolean;
  /** ページが整った（ready）。Face ID で開けるかを伝え直す */
  onPageReady: () => void;
  /** ページが Face ID を頼んできた（pwFaceId）。確かめて、覚えておいたパスワードを欄に入れる */
  fillPassword: () => Promise<void>;
  /** 手で入れて「開く」を押した（pwTyped） */
  notePasswordTyped: (value: string) => void;
  /** 明細が届いた（パスワードが正しかった）。手で入れたものなら、Face ID で覚えるか聞く */
  afterPayslipOpened: () => Promise<void>;
};

export function usePayslipPassword(webRef: RefObject<ComponentRef<typeof WebView> | null>, appId: string, username: string): PayslipPassword {
  const payslip = appId === PAYSLIP_APP;
  const [pwBio, setPwBio] = useState<Biometry | null>(null);
  /** 手で入れて「開く」を押したパスワードと、その時刻（明細が届いたら、正しかったと分かる） */
  const typedPassword = useRef<{ value: string; at: number } | null>(null);
  useEffect(() => {
    if (!payslip || !username) return;
    let alive = true;
    payslipBiometry(username).then((kind) => {
      if (alive) setPwBio(kind);
    });
    return () => {
      alive = false;
    };
  }, [payslip, username]);
  const tellPwBio = useCallback(
    (kind: Biometry | null) => {
      webRef.current?.injectJavaScript(`${pwBioJs(kind)}window.__myappAppUpdate && window.__myappAppUpdate(); true;`);
    },
    [webRef],
  );
  useEffect(() => {
    if (payslip) tellPwBio(pwBio);
  }, [payslip, pwBio, tellPwBio]);

  const onPageReady = () => {
    if (payslip) tellPwBio(pwBio);
  };
  const fillPassword = async () => {
    if (!payslip) return; // 明細の画面でなければ、パスワードを渡さない（知らせの受け付けとは別に、ここでも守る）
    typedPassword.current = null; // 前に手で入れたもの（違っていたかもしれない）は使わない
    const result = await readPayslipPassword(username);
    webRef.current?.injectJavaScript(pwFillJs(result.ok ? result.password : null));
    if (result.ok || result.reason === 'cancel') return;
    const kind = pwBio ?? '生体認証';
    setPwBio(null);
    if (result.reason === 'reset') {
      Alert.alert(`${kind} の登録が変わりました`, `パスワードを入れて開いてください。開けたら、また ${kind} を使えるようにできます。`);
    }
  };
  const notePasswordTyped = (value: string) => {
    if (!payslip) return;
    typedPassword.current = { value, at: Date.now() };
  };
  const afterPayslipOpened = async () => {
    const typed = typedPassword.current;
    typedPassword.current = null;
    if (!typed || !username || Date.now() - typed.at > TYPED_VALID_MS) return;
    if (await payslipBiometry(username)) {
      await renewPayslipPassword(username, typed.value);
      return;
    }
    const kind = await payslipBiometryToOffer(username);
    if (!kind) return;
    const use = await new Promise<boolean>((resolve) =>
      Alert.alert(
        `次から ${kind} で開きますか？`,
        `パスワードを、この端末に ${kind} 付きで覚えておきます。次からはパスワードを入れずに明細を開けます。`,
        [
          { text: '使わない', style: 'cancel', onPress: () => resolve(false) },
          { text: `${kind} を使う`, onPress: () => resolve(true) },
        ],
        { cancelable: false },
      ),
    );
    if (!use) {
      await declinePayslipFaceId(username);
      return;
    }
    if (await enablePayslipFaceId(username, typed.value, kind)) setPwBio(kind);
  };

  return { payslip, onPageReady, fillPassword, notePasswordTyped, afterPayslipOpened };
}
