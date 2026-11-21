// つなぎ先。ここだけ変えれば別の環境（検証用のサーバーなど）に向けられる。
// 外部 API を足すときは、その API のつなぎ先もここに並べる（使うのは src/api/<相手>/ だけ。AGENTS.md の Architecture）。

/** EZCraft（LINCREA の Web 版）のサーバー。ページも、アプリが自分でする問い合わせも、ここ（src/api/ezcraft/） */
export const SERVER_URL = 'https://lincrea-all.ezcraft.com';
