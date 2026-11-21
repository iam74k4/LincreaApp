// 見た目の直しの道具（src/webview/page/layout.ts）と、組み立てた見た目の直し（src/webview/page/ezcraftSkin.ts）。
import { scoped } from '../webview/page/layout';
import { buildSkinScript } from '../webview/page/ezcraftSkin';

/** 前後の空白（最後の改行）は比べない */
const css = (scope: string, text: string) => scoped(scope, text).trim();

describe('scoped: CSS の各ルールに、条件（祖先のセレクター）を付ける', () => {
  test('カンマで並べたセレクターの、それぞれに付ける', () => {
    expect(css(':root.x', 'a, b { color: red; }')).toBe(':root.x a,\n:root.x b { color: red; }');
  });
  test(':is( ) の中のカンマでは分けない（分けると、ルールが強くなりすぎる）', () => {
    expect(css(':root.x', '#a :is(.b, .c) .d { color: red; }')).toBe(':root.x #a :is(.b, .c) .d { color: red; }');
  });
  test('[ ] の中のカンマでも分けない', () => {
    expect(css(':root.x', '[data-x="a,b"] { color: red; }')).toBe(':root.x [data-x="a,b"] { color: red; }');
  });
  test('コメントは消して、ルールごとに付ける', () => {
    expect(css(':root.x', '/* メモ, です */ a { color: red; } b { color: blue; }')).toBe(':root.x a { color: red; }\n:root.x b { color: blue; }');
  });
});

/** 組み立てたスクリプトの中の、確かめる部品 ID の一覧（開発中だけ入る） */
function checkIds(appId: string): string[] | null {
  const m = /var CHECK_IDS = (.*);/.exec(buildSkinScript(appId));
  return m ? JSON.parse(m[1]) : null;
}

describe('buildSkinScript: ページに入れるスクリプト', () => {
  test.each(['L_Tims', 'YIF_walk_the_talk', 'L_Payslip', 'L_HealthCare'])('%s のスクリプトは、JavaScript として読める', (appId) => {
    expect(() => new Function(buildSkinScript(appId))).not.toThrow();
  });

  test('見つからない部品を確かめる一覧に、名前で指している部品が入る', () => {
    const ids = checkIds('YIF_walk_the_talk');
    expect(ids).toEqual(expect.arrayContaining(['stepCount_id_2026Walk_lbl_sum_week_steps', 'weeklyStepCount_id_2026Walk_btn_register']));
    // 途中までの名前（「…_」で終わるもの）は入れない
    expect(ids?.some((id) => id.endsWith('_'))).toBe(false);
  });

  test('後ろに番号を足して使う名前（\'#frmAttendanceDtl_txtPrj\' + n）は、部品の名前として数えない', () => {
    const ids = checkIds('L_Tims');
    expect(ids).not.toContain('frmAttendanceDtl_txtPrj');
    expect(ids).not.toContain('frmAttendanceDtl_chkTW');
    expect(ids).toContain('frmAttendanceDtl_btnIns');
  });
});
