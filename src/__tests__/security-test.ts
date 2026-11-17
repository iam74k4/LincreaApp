// セキュリティチェックで直したところ（外からのリンク・WebView の行き先・外で開くリンク・PDF を見る画面）。
import { redirectSystemPath } from '../app/+native-intent';
import { isInside } from '../files';
import { depositLaunch, takeLaunch } from '../launch';
import { depositHandoff, takeHandoff } from '../webview/handoff';
import { isServerUrl, mayNavigate, mayOpenOutside } from '../webview/origin';

jest.mock('expo-crypto', () => {
  let n = 0;
  return { randomUUID: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}` };
});
jest.mock('expo-file-system', () => ({ Directory: jest.fn(), File: jest.fn(), Paths: {} }));
jest.mock('expo-sharing', () => ({}));

describe('外からアプリを開くリンク（+native-intent）', () => {
  test('起動したリンクは、中身を見ずに最初の画面から始める', () => {
    expect(redirectSystemPath({ path: 'logindemo://run/L_Tims/frmLTiMSTop?auto=frmLTiMSTop_btnApply', initial: true })).toBe('/');
  });
  test('開いているときに来たリンクでは、何もしない', () => {
    expect(redirectSystemPath({ path: 'logindemo://run/L_Tims/frmApply_zangyo?launch=x', initial: false })).toBeNull();
    expect(redirectSystemPath({ path: 'logindemo://file?uri=file:///etc/passwd', initial: false })).toBeNull();
  });
});

describe('近道の指示の預かり所（src/launch.ts）', () => {
  test('預けた指示は、渡された番号でだけ取り出せる', () => {
    const id = depositLaunch({ steps: ['frmLTiMSTop_btnApply'], ready: 'LOGIN_USER', label: '勤怠申請', prefill: { date: '2026/11/18' } });
    expect(takeLaunch(id)).toEqual({ steps: ['frmLTiMSTop_btnApply'], ready: 'LOGIN_USER', label: '勤怠申請', prefill: { date: '2026/11/18' } });
    expect(takeLaunch('frmLTiMSTop_btnApply')).toBeNull();
    expect(takeLaunch(undefined)).toBeNull();
  });
  test('番号は推測できない形（UUID）で、続き番号ではない', () => {
    const id = depositLaunch({});
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(['1', '2', '3']).not.toContain(id);
  });
  test('部品 ID の形でないボタンと、長すぎる値は使わない', () => {
    const id = depositLaunch({ steps: ['ok_1', "x');alert(1)//"], prefill: { a: 'short', b: 'x'.repeat(41) } });
    expect(takeLaunch(id)).toMatchObject({ steps: ['ok_1'], prefill: { a: 'short' } });
  });
  test('開いた元から預かったもの（ログインした人の情報）の番号も、推測できない形', () => {
    const id = depositHandoff({ appData: '{}', name: null, params: null });
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(takeHandoff('1')).toBeNull();
  });
});

describe('WebView の行き先と知らせ（src/webview/origin.ts）', () => {
  test('会社のサイトのページだけを、会社のサイトと見なす', () => {
    expect(isServerUrl('https://lincrea-all.ezcraft.com/runapp/L_Tims/frmLTiMSTop/')).toBe(true);
    expect(isServerUrl('https://lincrea-all.ezcraft.com.evil.example/')).toBe(false);
    expect(isServerUrl('https://lincrea-all.ezcraft.com@evil.example/')).toBe(false);
    expect(isServerUrl('http://lincrea-all.ezcraft.com/')).toBe(false);
    expect(isServerUrl('https://lincrea-all.ezcraft.com:8443/')).toBe(false);
    expect(isServerUrl('https://other.ezcraft.com/')).toBe(false);
    expect(isServerUrl('not a url')).toBe(false);
    expect(isServerUrl(undefined)).toBe(false);
  });
  test('画面全体は、会社のサイトと about:blank だけに移る', () => {
    expect(mayNavigate('https://lincrea-all.ezcraft.com/main/', true)).toBe(true);
    expect(mayNavigate('about:blank', true)).toBe(true);
    expect(mayNavigate('https://example.com/', true)).toBe(false);
    expect(mayNavigate('data:text/html,<script>1</script>', true)).toBe(false);
    expect(mayNavigate('javascript:alert(1)', true)).toBe(false);
    expect(mayNavigate('blob:https://example.com/x', true)).toBe(false);
  });
  test('枠の中の小さな枠（iframe）は止めない（アプリの仕組みは、いちばん外の枠にしか入らない）', () => {
    expect(mayNavigate('https://example.com/embed', false)).toBe(true);
  });
  test('アプリの外で開くのは https のページだけ', () => {
    expect(mayOpenOutside('https://example.com/help')).toBe(true);
    expect(mayOpenOutside('http://example.com/')).toBe(false);
    expect(mayOpenOutside('tel:0312345678')).toBe(false);
    expect(mayOpenOutside('sms:090')).toBe(false);
    expect(mayOpenOutside('otherapp://do-something')).toBe(false);
    expect(mayOpenOutside('javascript:alert(1)')).toBe(false);
  });
});

describe('PDF を見る画面が開くファイル（src/files.ts の isInside）', () => {
  const folder = 'file:///var/mobile/Containers/Data/Application/X/Library/Caches/myapp-files';
  test('受け取ったファイルを置く場所の中だけ', () => {
    expect(isInside(`${folder}/1794930000000/給与明細.pdf`, folder)).toBe(true);
    expect(isInside(`${folder}-other/a.pdf`, folder)).toBe(false);
    expect(isInside('file:///var/mobile/Containers/Data/Application/X/Library/Cookies/Cookies.binarycookies', folder)).toBe(false);
  });
  test('「..」で外に出るものと、file:// でないものは開かない', () => {
    expect(isInside(`${folder}/../Preferences/a.plist`, folder)).toBe(false);
    expect(isInside(`${folder}/%2E%2E/a.plist`, folder)).toBe(false);
    expect(isInside('https://example.com/a.pdf', folder)).toBe(false);
  });
});
