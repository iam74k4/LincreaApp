// 「マイアプリ」の一覧を取ってくる。
//
// Web 版の一覧（/js/view/ApplicationList.js）と同じ問い合わせをする:
//   POST /application/find/   本文 status=01（稼働中のもの）
//   ヘッダー X-CSRF-Token に、/main/ の <html _t="..."> の値を入れる（なりすまし防止の合言葉）
//
// サーバーの返事（snake_case の生データ）は、ここでアプリ用の形（MyApp）に直してから渡す。
// 画面はサーバーの項目名や状態コードを知らなくてよい。
import { fetch } from 'expo/fetch';

import { SERVER_URL } from '../config';
import { landedOnLogin, SessionExpiredError } from './http';

// ---- アプリの中で使う形 ----

export type AppIconSpec = {
  /** FontAwesome のアイコン名（"desktop" など）。画面側で端末のアイコンに置き換える */
  name: string;
  color: string;
  background: string;
};

export type MyApp = {
  id: string;
  name: string;
  /** アプリケーション ID（L_HealthCare など）。起動 URL に使う */
  logicName: string;
  /** 起動するときに開くフォームの ID。起動 URL に使う */
  formName: string;
  description: string;
  icon: AppIconSpec;
  /** 稼働中か（本番で使える状態か） */
  isAvailable: boolean;
  /** 開発中の版があるか */
  isDeveloping: boolean;
  releasedAt: Date | null;
  releaseId: string;
  releaseNotes: string;
};

// ---- サーバーが返す形（使う項目だけ） ----

type RawApp = {
  id: string;
  application_name: string;
  application_logic_name: string;
  form_logic_name: string;
  description: string | null;
  icon: string | null;
  production_app_status: string | null;
  development_app_status: string | null;
  released_at: string | null;
  released_id: string | null;
  released_notes: string | null;
};

// 状態コード（Web 版の /js/cmn/module/constant.js の APP_STATUS）
const STATUS_AVAILABLE = '01';
const STATUS_DEVELOPING = '11';

export async function fetchMyApps(): Promise<MyApp[]> {
  const csrf = await fetchCsrfToken();
  const res = await fetch(`${SERVER_URL}/application/find/`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'X-CSRF-Token': csrf,
      Accept: 'application/json',
    },
    body: `status=${STATUS_AVAILABLE}`,
  });
  if (landedOnLogin(res) || res.status === 401) throw new SessionExpiredError();
  if (!res.ok) throw new Error(`一覧を読み込めませんでした（HTTP ${res.status}）`);

  const json = (await res.json()) as { data?: RawApp[] };
  return (json.data ?? []).map(toMyApp);
}

/** Web 版が毎回ヘッダーに付けている合言葉を、/main/ のページから読む */
async function fetchCsrfToken(): Promise<string> {
  const res = await fetch(`${SERVER_URL}/main/`, { credentials: 'include' });
  if (landedOnLogin(res)) throw new SessionExpiredError();
  const html = await res.text();
  const token = html.match(/<html[^>]*\s_t="([^"]+)"/)?.[1];
  if (!token) throw new Error('サーバーの合言葉（CSRF トークン）を読めませんでした。');
  return token;
}

function toMyApp(raw: RawApp): MyApp {
  return {
    id: raw.id,
    name: raw.application_name,
    logicName: raw.application_logic_name,
    formName: raw.form_logic_name,
    description: raw.description ?? '',
    icon: parseIcon(raw.icon),
    isAvailable: raw.production_app_status === STATUS_AVAILABLE,
    isDeveloping: raw.development_app_status === STATUS_DEVELOPING,
    releasedAt: raw.released_at ? new Date(raw.released_at) : null,
    releaseId: raw.released_id ?? '',
    releaseNotes: raw.released_notes ?? '',
  };
}

/** "fa fa-desktop,#ffffff,#88aad8" → { name: "desktop", color: "#ffffff", background: "#88aad8" } */
function parseIcon(value: string | null): AppIconSpec {
  const [classes = '', color, background] = (value ?? '').split(',').map((part) => part.trim());
  const name = classes.split(/\s+/).find((c) => c.startsWith('fa-'))?.slice(3) ?? '';
  return { name, color: color || '#ffffff', background: background || '#5182c5' };
}
