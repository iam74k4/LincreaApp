// ページが開こうとした先（新しいウインドウ）の種類（src/webview/origin.ts の resolveTarget）。
import { SERVER_URL } from '../core/config';
import { leavesForOtherApp, resolveTarget, runappOf, trustedSenderApp } from '../webview/origin';

describe('resolveTarget', () => {
  it('EZCraft のアプリの画面は runapp（アプリ・フォーム・引数を分ける）', () => {
    expect(resolveTarget(`${SERVER_URL}/runapp/L_Tims/frmAttendance/?date=2026%2F11%2F19`)).toEqual({
      kind: 'runapp',
      app: 'L_Tims',
      form: 'frmAttendance',
      query: 'date=2026%2F11%2F19',
    });
  });

  it('相対の URL は、会社のサイトのものとして読む（末尾の / はなくてもよい）', () => {
    expect(resolveTarget('/runapp/L_Payslip/frmTop')).toEqual({ kind: 'runapp', app: 'L_Payslip', form: 'frmTop', query: '' });
  });

  it('大文字の /RunApp/ も、アプリの画面として開く（runappOf と同じ見方）', () => {
    expect(resolveTarget(`${SERVER_URL}/RunApp/L_Tims/frmTop/`)).toMatchObject({ kind: 'runapp', app: 'L_Tims', form: 'frmTop' });
  });

  it('アプリ・フォームの名前は、%エンコードを戻す', () => {
    expect(resolveTarget('/runapp/L%5FTims/frm%20A/')).toMatchObject({ app: 'L_Tims', form: 'frm A' });
  });

  it('会社のサイトの、ほかのページは page（パスと引数）', () => {
    expect(resolveTarget(`${SERVER_URL}/main/?tab=1`)).toEqual({ kind: 'page', path: '/main/?tab=1' });
    expect(resolveTarget('/runapp/L_Tims/')).toEqual({ kind: 'page', path: '/runapp/L_Tims/' });
  });

  it('ほかのサイトは external（アプリの外で開く）', () => {
    expect(resolveTarget('https://example.com/help')).toEqual({ kind: 'external', url: 'https://example.com/help' });
    // 同じ名前を含んでいても、ホストが違えばほかのサイト
    expect(resolveTarget(`https://evil.example/?u=${SERVER_URL}`)).toMatchObject({ kind: 'external' });
  });

  it('読めない URL・壊れた %（%E0 など）は null（例外にしない。ページが作りそこなった URL で落ちないように）', () => {
    expect(resolveTarget('http://[bad')).toBeNull();
    expect(resolveTarget('/runapp/%E0/frmTop/')).toBeNull();
  });
});

describe('runappOf（どのアプリのどの画面の URL か）', () => {
  it('/runapp/<アプリ>/<画面>/ から、アプリと画面を取り出す（引数があってもよい）', () => {
    expect(runappOf(`${SERVER_URL}/runapp/L_Tims/frmAttendance/?date=1`)).toEqual({ app: 'L_Tims', form: 'frmAttendance' });
    expect(runappOf('/runapp/L%5FPayslip/LP%20main/')).toEqual({ app: 'L_Payslip', form: 'LP main' });
  });

  it('runapp でない・壊れた % は null（例外にしない）', () => {
    expect(runappOf(`${SERVER_URL}/main/`)).toBeNull();
    expect(runappOf('/runapp/%E0/x/')).toBeNull();
    expect(runappOf('/runapp/L_Tims/%E0/')).toBeNull();
  });
});

describe('runappOf は、URL のパスの頭だけを見る', () => {
  it('引数（?…）の中や、パスの途中の /runapp/ には当てない', () => {
    expect(runappOf(`${SERVER_URL}/main/?next=/runapp/L_Payslip/LP_main/`)).toBeNull();
    expect(runappOf(`${SERVER_URL}/x/runapp/L_Payslip/LP_main/`)).toBeNull();
  });
  it('大文字・小文字は区別しない（/RunApp/ でもよい）', () => {
    expect(runappOf(`${SERVER_URL}/RunApp/L_Tims/frmTop/`)).toEqual({ app: 'L_Tims', form: 'frmTop' });
  });
});

describe('trustedSenderApp（知らせを、どのアプリのページとして信じるか）', () => {
  const PAYSLIP = `${SERVER_URL}/runapp/L_Payslip/LP_main/`;
  const OTHER = `${SERVER_URL}/runapp/X_Other/frmTop/`;

  it('画面のアプリのページから来た知らせは、そのアプリのものとして信じる', () => {
    expect(trustedSenderApp(PAYSLIP, `${SERVER_URL}/runapp/L_Payslip/LP_detail/?id=1`)).toBe('L_Payslip');
  });

  it('ほかのアプリの画面のページが、URL を明細のアプリに書き換えて（history.replaceState）送ってきても、信じない', () => {
    expect(trustedSenderApp(OTHER, PAYSLIP)).toBe('');
  });

  it('明細の画面でも、送ってきたページがほかのアプリ・runapp でないなら信じない', () => {
    expect(trustedSenderApp(PAYSLIP, OTHER)).toBe('');
    expect(trustedSenderApp(PAYSLIP, `${SERVER_URL}/main/`)).toBe('');
  });

  it('/page の画面（runapp でない）は、どのアプリでもない', () => {
    expect(trustedSenderApp(`${SERVER_URL}/main/files/`, PAYSLIP)).toBe('');
  });

  it('送り元が「サイトの名前だけ」（Android の iframe・移った直後の知らせ。patches/react-native-webview）なら、どのアプリでもない', () => {
    const origin = new URL(SERVER_URL).origin;
    expect(trustedSenderApp(PAYSLIP, origin)).toBe('');
    expect(trustedSenderApp(PAYSLIP, `${origin}/`)).toBe('');
  });
});

describe('leavesForOtherApp（画面の中で、ほかのアプリの画面へ移ろうとしているか）', () => {
  const TIMS = `${SERVER_URL}/runapp/L_Tims/frmLTiMSTop/`;

  it('いちばん外の枠が、ほかのアプリの runapp へ移るなら true（新しい画面として開く）', () => {
    expect(leavesForOtherApp(TIMS, `${SERVER_URL}/runapp/L_Payslip/LP_main/`, true)).toBe(true);
    expect(leavesForOtherApp(TIMS, `${SERVER_URL}/runapp/L_Payslip/LP_main/`, undefined)).toBe(true);
  });

  it('同じアプリの別の画面・runapp でないページ・小さな枠（iframe）・ほかのサイトは false（そのまま）', () => {
    expect(leavesForOtherApp(TIMS, `${SERVER_URL}/runapp/L_Tims/frmAttendance/`, true)).toBe(false);
    expect(leavesForOtherApp(TIMS, `${SERVER_URL}/RunApp/l_tims/frmApply/`, true)).toBe(false);
    expect(leavesForOtherApp(TIMS, `${SERVER_URL}/login`, true)).toBe(false);
    expect(leavesForOtherApp(TIMS, `${SERVER_URL}/runapp/L_Payslip/LP_main/`, false)).toBe(false);
    expect(leavesForOtherApp(TIMS, 'https://example.com/runapp/L_Payslip/LP_main/', true)).toBe(false);
  });
});
