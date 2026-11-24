// デモの勤怠 TiMS（L_Tims）。本物と同じ画面の ID で作る（近道 src/shortcuts/shortcuts.ts と同じ行き先になるように）:
//   frmLTiMSTop      … お知らせとメニュー
//   frmAttendance    … 勤務表（今日・未登録の日・月の日の一覧）
//   frmAttendanceDtl … 1日の勤怠実績の登録
//   frmApply         … 勤怠申請のメニューと、申請の状況
//   frmApply_zangyo  … 残業申請
//   frmApply_yukyu   … 有給休暇申請
import { DEMO_PERSON } from './demoAccount';
import { addDays, dayLabel, daysOfMonth, monthLabel, monthOf } from './demoDates';
import { esc, openAttrs } from './demoHtml';
import {
  ATTENDANCE_KINDS,
  attendanceMonths,
  PAID_LEAVE_DAYS,
  recordOf,
  statusOf,
  unregisteredDays,
  type Application,
  type DayStatus,
  type DemoState,
} from './demoStore';

export type DemoPage = { title: string; body: string; script?: string };

const STATUS_TAG: Record<DayStatus, string> = {
  registered: '<span class="tag ok">登録済み</span>',
  unregistered: '<span class="tag ng">未登録</span>',
  today: '<span class="tag wait">今日</span>',
  holiday: '<span class="tag off">休日</span>',
  future: '',
};

const KIND_NAME = { zangyo: '残業申請', yukyu: '有給休暇申請' } as const;

function applicationTag(a: Application): string {
  if (a.status === '承認済み') return '<span class="tag ok">承認済み</span>';
  if (a.status === '取り下げ') return '<span class="tag off">取り下げ</span>';
  return '<span class="tag wait">承認待ち</span>';
}

function dayRow(state: DemoState, day: string): string {
  const status = statusOf(state, day);
  const record = recordOf(state, day);
  const sub = record
    ? record.start
      ? `${record.kind}　${record.start}〜${record.end}（休憩 ${record.rest}）`
      : record.kind
    : status === 'holiday'
      ? '所定休日'
      : status === 'future'
        ? '予定なし'
        : 'まだ登録していません';
  const tappable = status !== 'future';
  return `<div class="row${tappable ? ' chev' : ''}" ${tappable ? openAttrs('frmAttendanceDtl', { day }) : ''}>
  <div class="main"><div class="title">${esc(dayLabel(day))}</div><div class="sub">${esc(sub)}</div></div>
  ${STATUS_TAG[status]}
</div>`;
}

function top(state: DemoState): DemoPage {
  const pending = state.applications.filter((a) => a.status === '承認待ち').length;
  return {
    title: '£-TiMS',
    body: `
<div class="pad muted">👤 ${esc(DEMO_PERSON)}（第1開発部）</div>
<h2>お知らせ</h2>
<div class="card">
  <div class="row"><div class="main"><div class="title">年末年始の勤怠締めについて</div><div class="sub">12月分の締めは 1月5日（月）です。早めの登録をお願いします。</div></div></div>
  <div class="row"><div class="main"><div class="title">在宅勤務の区分を追加しました</div><div class="sub">在宅で勤務した日は「在宅勤務」を選んでください。</div></div></div>
</div>
<div class="card">
  <div class="row chev" ${openAttrs('frmAttendance')}><div class="tile">🗓</div><div class="main"><div class="title">勤怠管理</div><div class="sub">勤務表・毎日の登録</div></div></div>
  <div class="row chev" ${openAttrs('frmApply')}><div class="tile">📝</div><div class="main"><div class="title">勤怠申請</div><div class="sub">残業・有給休暇の申請と状況</div></div>${pending ? `<span class="tag wait">承認待ち ${pending}</span>` : ''}</div>
</div>`,
  };
}

function attendance(state: DemoState, q: URLSearchParams): DemoPage {
  const months = attendanceMonths(state);
  const month = months.includes(q.get('month') ?? '') ? (q.get('month') as string) : monthOf(state.today);
  const index = months.indexOf(month);
  const prev = months[index - 1];
  const next = months[index + 1];
  const days = daysOfMonth(month);
  const missing = unregisteredDays(state).filter((d) => monthOf(d) === month || month === monthOf(state.today));
  const isCurrent = month === monthOf(state.today);
  const todayRecord = recordOf(state, state.today);
  return {
    title: '勤務表',
    body: `
<div class="pad" style="display:flex;align-items:center;justify-content:space-between">
  ${prev ? `<a class="btn small sub" ${openAttrs('frmAttendance', { month: prev })}>‹ 前の月</a>` : '<span></span>'}
  <strong>${esc(monthLabel(month))}</strong>
  ${next ? `<a class="btn small sub" ${openAttrs('frmAttendance', { month: next })}>次の月 ›</a>` : '<span></span>'}
</div>
${
  isCurrent
    ? `<h2>今日</h2>
<div class="card">${dayRow(state, state.today)}</div>
${todayRecord ? '' : `<a class="btn" ${openAttrs('frmAttendanceDtl', { day: state.today })}>今日の勤怠を登録する</a>`}`
    : ''
}
${
  missing.length
    ? `<h2>過ぎたのに未登録の日（${missing.length}日）</h2>
<div class="card">${missing.map((d) => dayRow(state, d)).join('')}</div>`
    : ''
}
<h2>${esc(monthLabel(month))}の日</h2>
<div class="card">${days.map((d) => dayRow(state, d)).join('')}</div>`,
  };
}

function attendanceDetail(state: DemoState, q: URLSearchParams): DemoPage {
  const day = q.get('day') ?? state.today;
  if (day > state.today) {
    return { title: '勤怠実績登録', body: '<div class="card pad">先の日は、まだ登録できません。</div>' };
  }
  const record = recordOf(state, day) ?? { kind: '出勤', start: '09:00', end: '18:00', rest: '01:00', note: '' };
  const options = ATTENDANCE_KINDS.map((k) => `<option${k === record.kind ? ' selected' : ''}>${esc(k)}</option>`).join('');
  return {
    title: '勤怠実績登録',
    body: `
<form data-action="attendance.save" data-back="1">
  <input type="hidden" name="day" value="${esc(day)}">
  <h2>${esc(dayLabel(day))}</h2>
  <div class="card">
    <label class="field"><span>区分</span><select name="kind" id="kind">${options}</select></label>
    <div id="times">
      <label class="field"><span>出勤</span><input type="time" name="start" value="${esc(record.start || '09:00')}"></label>
      <label class="field"><span>退勤</span><input type="time" name="end" value="${esc(record.end || '18:00')}"></label>
      <label class="field"><span>休憩</span><input type="time" name="rest" value="${esc(record.rest || '01:00')}"></label>
    </div>
    <label class="field"><span>備考</span><textarea name="note" maxlength="200" placeholder="（任意）">${esc(record.note)}</textarea></label>
  </div>
  <div class="error"></div>
  <button class="btn" type="submit">登録</button>
</form>
<a class="btn sub" ${openAttrs('frmApply_zangyo', { day }, { sheet: true })}>この日の残業を申請する</a>`,
    script: `
(function () {
  var kind = document.getElementById('kind');
  var times = document.getElementById('times');
  function sync() {
    var working = kind.value === '出勤' || kind.value === '在宅勤務';
    times.classList.toggle('hidden', !working);
    Array.prototype.forEach.call(times.querySelectorAll('input'), function (i) { i.disabled = !working; });
  }
  kind.addEventListener('change', sync);
  sync();
})();`,
  };
}

function apply(state: DemoState): DemoPage {
  const rows = state.applications
    .map(
      (a) => `<div class="row">
  <div class="main"><div class="title">${esc(KIND_NAME[a.kind])}</div>
  <div class="sub">${esc(dayLabel(a.day))}・${esc(a.kind === 'zangyo' ? `${a.detail} まで` : a.detail)}</div>
  <div class="sub">${esc(a.reason)}</div></div>
  ${applicationTag(a)}
  ${a.status === '承認待ち' ? `<button class="btn small danger" data-action="apply.cancel" data-data="${esc(JSON.stringify({ id: a.id }))}" data-confirm="この申請を取り下げますか？">取り下げ</button>` : ''}
</div>`,
    )
    .join('');
  return {
    title: '勤怠申請',
    body: `
<div class="card">
  <div class="row chev" ${openAttrs('frmApply_zangyo')}><div class="tile">⏱</div><div class="main"><div class="title">残業申請</div><div class="sub">決められた時間より長く働くとき</div></div></div>
  <div class="row chev" ${openAttrs('frmApply_yukyu')}><div class="tile">🏖</div><div class="main"><div class="title">有給休暇申請</div><div class="sub">残り ${PAID_LEAVE_DAYS} 日</div></div></div>
</div>
<h2>申請の状況</h2>
<div class="card">${rows || '<div class="pad muted">申請はありません。</div>'}</div>`,
  };
}

function zangyo(state: DemoState, q: URLSearchParams): DemoPage {
  const day = q.get('day') ?? state.today;
  return {
    title: '残業申請',
    body: `
<form data-action="apply.create" data-back="1">
  <input type="hidden" name="kind" value="zangyo">
  <div class="card">
    <label class="field"><span>日付</span><input type="date" name="day" value="${esc(day)}" max="${esc(addDays(state.today, 31))}"></label>
    <label class="field"><span>終わる予定の時刻</span><input type="time" name="detail" value="20:00"></label>
    <label class="field"><span>理由</span><textarea name="reason" maxlength="200" placeholder="例: リリース前の確認のため"></textarea></label>
  </div>
  <p class="muted" style="margin:0 20px 12px">申請すると、上長に承認の依頼が届きます。</p>
  <div class="error"></div>
  <button class="btn" type="submit">申請</button>
</form>`,
  };
}

function yukyu(state: DemoState): DemoPage {
  const pending = state.applications.filter((a) => a.kind === 'yukyu' && a.status === '承認待ち').length;
  return {
    title: '有給休暇申請',
    body: `
<div class="card pad center">
  <div class="muted">有給休暇の残り</div>
  <div class="big">${PAID_LEAVE_DAYS}<span style="font-size:17px"> 日</span></div>
  ${pending ? `<div class="muted">申請中 ${pending} 件</div>` : ''}
</div>
<form data-action="apply.create" data-back="1">
  <input type="hidden" name="kind" value="yukyu">
  <div class="card">
    <label class="field"><span>日付</span><input type="date" name="day" value="${esc(addDays(state.today, 7))}" min="${esc(addDays(state.today, 1))}"></label>
    <div class="field" style="padding:10px 16px"><div class="muted" style="margin-bottom:6px">取る時間</div>
      <div class="seg">
        <label><input type="radio" name="detail" value="全日" checked><span>全日</span></label>
        <label><input type="radio" name="detail" value="午前"><span>午前</span></label>
        <label><input type="radio" name="detail" value="午後"><span>午後</span></label>
      </div>
    </div>
    <label class="field"><span>理由</span><textarea name="reason" maxlength="200">私用のため</textarea></label>
  </div>
  <div class="error"></div>
  <button class="btn" type="submit">申請</button>
</form>`,
  };
}

/** 勤怠 TiMS のデモのページ。知らない画面なら null */
export function timsPage(state: DemoState, form: string, q: URLSearchParams): DemoPage | null {
  switch (form) {
    case 'frmLTiMSTop':
      return top(state);
    case 'frmAttendance':
      return attendance(state, q);
    case 'frmAttendanceDtl':
      return attendanceDetail(state, q);
    case 'frmApply':
      return apply(state);
    case 'frmApply_zangyo':
      return zangyo(state, q);
    case 'frmApply_yukyu':
      return yukyu(state);
    default:
      return null;
  }
}
