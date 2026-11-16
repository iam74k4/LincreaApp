// つなぎ先。ここだけ変えれば別の環境（検証用のサーバーなど）に向けられる。
export const SERVER_URL = 'https://lincrea-all.ezcraft.com';

/** ロゴの下に出す名前。Web 版と同じく、サブドメインをそのまま使う */
export const WORKSPACE_NAME = new URL(SERVER_URL).hostname.split('.')[0];
