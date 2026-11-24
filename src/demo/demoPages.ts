// デモのページを作る（アプリケーション ID と画面の ID から）。勤怠 TiMS は ./demoTims.ts、ほかはこのファイル。
//   L_Payslip          frmPayslipList（明細のパスワード → 一覧）・frmPayslipDtl（1件の明細）
//   L_Payslip_Juminzei frmJuminzei（住民税の通知書）
//   L_HealthCare       frmHealthTop（予約と結果）・frmHealthReserve（予約する）
//   L_ITEE             frmIteeSearch（資格取得者の検索）
//   YIF_walk_the_talk  frmWalkTop（今月の歩数とポイント）・frmWalkInput（1日の歩数の登録。端末の歩数を読む）
import { addDays, dayLabel, isWeekend, monthOf } from './demoDates';
import { demoDocument, esc, jsonForScript, openAttrs, yen } from './demoHtml';
import { DEMO_PAYSLIP_PASSWORD, payslips, QUALIFIED, total, type DemoState } from './demoStore';
import { timsPage, type DemoPage } from './demoTims';

export type DemoEnv = {
  /** 端末の歩数の記録から読めるか（src/platform/health.ts） */
  health: boolean;
  /** 歩数を読む先の呼び名（「ヘルスケア」など） */
  healthSource: string;
  bottomInset: number;
};

function payslipList(state: DemoState): DemoPage {
  if (!state.payslipUnlocked) {
    return {
      title: '給与・賞与明細',
      body: `
<form data-action="payslip.unlock">
  <h2>明細のパスワード</h2>
  <div class="card">
    <label class="field"><span>パスワード（デモでは ${esc(DEMO_PAYSLIP_PASSWORD)}）</span><input type="password" name="password" autocomplete="off" inputmode="numeric"></label>
  </div>
  <div class="error"></div>
  <button class="btn" type="submit">明細を見る</button>
</form>`,
    };
  }
  const rows = payslips(state)
    .map(
      (p) => `<div class="row chev" ${openAttrs('frmPayslipDtl', { id: p.id })}>
  <div class="tile">¥</div>
  <div class="main"><div class="title">${esc(p.title)}</div><div class="sub">支給日 ${esc(dayLabel(p.paidOn))}</div></div>
  <div class="value">${esc(yen(total(p.earnings) - total(p.deductions)))}</div>
</div>`,
    )
    .join('');
  return { title: '給与・賞与明細', body: `<h2>明細（新しい順）</h2><div class="card">${rows}</div>` };
}

function payslipDetail(state: DemoState, q: URLSearchParams): DemoPage {
  const slip = payslips(state).find((p) => p.id === q.get('id'));
  if (!state.payslipUnlocked || !slip) return { title: '明細', body: '<div class="card pad">明細が見つかりません。</div>' };
  const lines = (items: { label: string; amount: number }[], sumLabel: string) =>
    `<table class="lines">${items.map((l) => `<tr><td>${esc(l.label)}</td><td>${esc(yen(l.amount))}</td></tr>`).join('')}<tr class="sum"><td>${esc(sumLabel)}</td><td>${esc(yen(total(items)))}</td></tr></table>`;
  return {
    title: slip.title,
    body: `
<div class="card pad center">
  <div class="muted">差引支給額</div>
  <div class="big">${esc(yen(total(slip.earnings) - total(slip.deductions)))}</div>
  <div class="muted">支給日 ${esc(dayLabel(slip.paidOn))}</div>
</div>
<h2>支給</h2><div class="card">${lines(slip.earnings, '支給合計')}</div>
<h2>控除</h2><div class="card">${lines(slip.deductions, '控除合計')}</div>`,
  };
}

function juminzei(state: DemoState): DemoPage {
  const year = Number(state.today.slice(0, 4)) - (Number(state.today.slice(5, 7)) < 6 ? 1 : 0);
  const months = [6, 7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5];
  const amounts = months.map((m) => ({ label: `${m >= 6 ? year : year + 1}年${m}月`, amount: m === 6 ? 15800 : 15200 }));
  return {
    title: '住民税の通知書',
    body: `
<div class="card pad">
  <div class="title"><strong>令和${year - 2018}年度 特別徴収税額の決定通知書</strong></div>
  <div class="muted">特別徴収義務者: 株式会社（見本） / 市区町村: 東京都 見本区</div>
</div>
<h2>毎月の給与から引かれる額</h2>
<div class="card"><table class="lines">${amounts.map((a) => `<tr><td>${esc(a.label)}</td><td>${esc(yen(a.amount))}</td></tr>`).join('')}
<tr class="sum"><td>年税額</td><td>${esc(yen(amounts.reduce((s, a) => s + a.amount, 0)))}</td></tr></table></div>`,
  };
}

const PLACES = ['本社 健康管理室', '提携クリニック（新宿）'];
const TIMES = ['09:00', '10:30', '13:30', '15:00'];

function healthTop(state: DemoState): DemoPage {
  const r = state.reservation;
  const year = Number(state.today.slice(0, 4));
  return {
    title: '健康診断',
    body: `
<h2>${year}年度の予約</h2>
${
  r
    ? `<div class="card">
  <div class="row"><div class="main"><div class="title">${esc(dayLabel(r.day))} ${esc(r.time)}</div><div class="sub">${esc(r.place)}</div></div><span class="tag ok">予約済み</span></div>
</div>
<button class="btn danger" data-action="health.cancel" data-confirm="予約を取り消しますか？">予約を取り消す</button>`
    : `<div class="card pad">まだ予約していません。受診の日にちと会場を選んでください。</div>
<a class="btn" ${openAttrs('frmHealthReserve', {}, { sheet: true })}>予約する</a>`
}
<h2>${year - 1}年度の結果</h2>
<div class="card"><table class="lines">
<tr><td>総合判定</td><td><span class="tag ok">A 異常なし</span></td></tr>
<tr><td>身長</td><td>170.2 cm</td></tr>
<tr><td>体重</td><td>64.8 kg</td></tr>
<tr><td>BMI</td><td>22.4</td></tr>
<tr><td>血圧</td><td>118 / 76 mmHg</td></tr>
<tr><td>視力（右 / 左）</td><td>1.2 / 1.0</td></tr>
</table></div>`,
  };
}

function healthReserve(state: DemoState): DemoPage {
  const days: string[] = [];
  for (let d = addDays(state.today, 7); days.length < 8; d = addDays(d, 1)) if (!isWeekend(d)) days.push(d);
  return {
    title: '健康診断の予約',
    body: `
<form data-action="health.reserve" data-back="1">
  <div class="card">
    <label class="field"><span>日にち</span><select name="day">${days.map((d) => `<option value="${esc(d)}">${esc(dayLabel(d))}</option>`).join('')}</select></label>
    <label class="field"><span>時間</span><select name="time">${TIMES.map((t) => `<option>${esc(t)}</option>`).join('')}</select></label>
    <label class="field"><span>会場</span><select name="place">${PLACES.map((p) => `<option>${esc(p)}</option>`).join('')}</select></label>
  </div>
  <div class="error"></div>
  <button class="btn" type="submit">予約する</button>
</form>`,
  };
}

function itee(): DemoPage {
  const rows = QUALIFIED.map(
    (p) => `<div class="row" data-search="${esc(`${p.name} ${p.department} ${p.exams.join(' ')}`)}">
  <div class="main"><div class="title">${esc(p.name)}</div><div class="sub">${esc(p.department)}・${esc(p.exams.join('、'))}</div></div>
</div>`,
  ).join('');
  return {
    title: '資格取得者の検索',
    body: `
<div class="pad"><input type="search" id="q" placeholder="名前・部署・試験の名前で探す" autocomplete="off"></div>
<div class="card" id="list">${rows}</div>
<div class="pad muted center hidden" id="none">当てはまる人はいません。</div>`,
    script: `
(function () {
  var q = document.getElementById('q');
  var rows = document.querySelectorAll('#list .row');
  q.addEventListener('input', function () {
    var text = q.value.trim().toLowerCase();
    var shown = 0;
    Array.prototype.forEach.call(rows, function (r) {
      var hit = !text || r.getAttribute('data-search').toLowerCase().indexOf(text) >= 0;
      r.classList.toggle('hidden', !hit);
      if (hit) shown++;
    });
    document.getElementById('list').classList.toggle('hidden', shown === 0);
    document.getElementById('none').classList.toggle('hidden', shown > 0);
  });
})();`,
  };
}

/** 1,000 歩で 1 ポイント（見本の決まり） */
const pointsOf = (steps: number) => Math.floor(steps / 1000);

function walkTop(state: DemoState): DemoPage {
  const month = monthOf(state.today);
  const monthSteps = Object.entries(state.steps)
    .filter(([d]) => monthOf(d) === month)
    .reduce((s, [, n]) => s + n, 0);
  const week = Array.from({ length: 7 }, (_, i) => addDays(state.today, -i));
  const rows = week
    .map((d) => {
      const steps = Object.hasOwn(state.steps, d) ? state.steps[d] : null;
      return `<div class="row chev" ${openAttrs('frmWalkInput', { day: d })}>
  <div class="main"><div class="title">${esc(dayLabel(d))}</div><div class="sub">${steps === null ? 'まだ登録していません' : `${pointsOf(steps)} ポイント`}</div></div>
  ${steps === null ? '<span class="tag ng">未登録</span>' : `<div class="value">${esc(steps.toLocaleString('ja-JP'))} 歩</div>`}
</div>`;
    })
    .join('');
  return {
    title: 'Walk the Talk',
    body: `
<div class="card pad center">
  <div class="muted">今月の歩数</div>
  <div class="big">${esc(monthSteps.toLocaleString('ja-JP'))}<span style="font-size:17px"> 歩</span></div>
  <div class="muted">${pointsOf(monthSteps)} ポイント（1,000 歩で 1 ポイント）</div>
</div>
<h2>この1週間（押すと登録できます）</h2>
<div class="card">${rows}</div>`,
  };
}

function walkInput(state: DemoState, q: URLSearchParams, env: DemoEnv): DemoPage {
  const day = q.get('day') ?? state.today;
  const steps = Object.hasOwn(state.steps, day) ? String(state.steps[day]) : '';
  return {
    title: '歩数の登録',
    body: `
<form data-action="walk.save" data-back="1">
  <input type="hidden" name="day" value="${esc(day)}">
  <h2>${esc(dayLabel(day))}</h2>
  <div class="card">
    <label class="field"><span>歩数</span><input type="number" name="steps" id="steps" inputmode="numeric" min="0" max="100000" value="${esc(steps)}" placeholder="0"></label>
  </div>
  ${
    env.health
      ? `<button class="btn sub" type="button" id="read">${esc(env.healthSource)}から読み込む</button>
  <p class="muted" style="margin:0 20px 12px">この iPhone の${esc(env.healthSource)}から、この日の歩数を読み取ります（読むだけで、書き込みません）。</p>`
      : `<p class="muted" style="margin:0 20px 12px">この端末では${esc(env.healthSource)}を使えないので、歩数を手で入れてください。</p>`
  }
  <div class="error"></div>
  <button class="btn" type="submit">登録</button>
</form>`,
    script: env.health
      ? `
(function () {
  var day = ${jsonForScript(day)};
  var source = ${jsonForScript(env.healthSource)};
  var button = document.getElementById('read');
  button.addEventListener('click', function () {
    button.disabled = true;
    window.demoSteps(day, function (steps) {
      button.disabled = false;
      if (steps === null) { window.demoToast(source + 'から読めませんでした。'); return; }
      document.getElementById('steps').value = String(steps);
      window.demoToast(source + 'から ' + steps.toLocaleString('ja-JP') + ' 歩を読み込みました。');
    });
  });
})();`
      : undefined,
  };
}

function pageOf(state: DemoState, appId: string, form: string, q: URLSearchParams, env: DemoEnv): DemoPage | null {
  switch (appId) {
    case 'L_Tims':
      return timsPage(state, form, q);
    case 'L_Payslip':
      return form === 'frmPayslipList' ? payslipList(state) : form === 'frmPayslipDtl' ? payslipDetail(state, q) : null;
    case 'L_Payslip_Juminzei':
      return form === 'frmJuminzei' ? juminzei(state) : null;
    case 'L_HealthCare':
      return form === 'frmHealthTop' ? healthTop(state) : form === 'frmHealthReserve' ? healthReserve(state) : null;
    case 'L_ITEE':
      return form === 'frmIteeSearch' ? itee() : null;
    case 'YIF_walk_the_talk':
      return form === 'frmWalkTop' ? walkTop(state) : form === 'frmWalkInput' ? walkInput(state, q, env) : null;
    default:
      return null;
  }
}

/** デモのページ（上のバーの名前と HTML）。知らない画面は「デモでは開けません」 */
export function demoPage(state: DemoState, appId: string, form: string, query: string, env: DemoEnv): { title: string; html: string } {
  const page = pageOf(state, appId, form, new URLSearchParams(query), env) ?? {
    title: '',
    body: '<div class="card pad">この画面は、デモでは開けません。</div>',
  };
  return { title: page.title, html: demoDocument({ appId, body: page.body, script: page.script, bottomInset: env.bottomInset }) };
}

/** 歩数を読んでよい日か（今日から 30 日前まで。未来の日は読まない） */
export function demoStepsDayAllowed(state: DemoState, day: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && day <= state.today && day >= addDays(state.today, -30);
}
