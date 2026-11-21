// 保存のあいだにアプリが裏に回っても、少しのあいだ動き続けられるよう、端末に頼む。
//
// iPhone は、アプリが裏に回るとすぐに止める。保存の途中で止められると、サーバーとのやりとりが切れて書きかけが残る。
// このアプリだけの小さな部品（modules/background-time。iOS の beginBackgroundTask）で、iOS が許すあいだ（30 秒ほど）続ける。
// Android は裏に回ってもすぐには止めないので、部品はない（何もしない）。Expo Go にも部品はない（何もしない）。
import { requireOptionalNativeModule } from 'expo';

type BackgroundTimeModule = {
  begin(key: string): void;
  end(key: string): void;
};

const native = requireOptionalNativeModule<BackgroundTimeModule>('MyAppBackgroundTime');

/** 名前 key で頼む。返した関数を呼ぶと返す（何度呼んでもよい） */
export function holdBackgroundTime(key: string): () => void {
  if (!native) return () => {};
  try {
    native.begin(key);
  } catch {
    return () => {};
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    try {
      native.end(key);
    } catch {
      // 返せなくても、時間が切れれば iOS に言われて返す
    }
  };
}
