// フォルダの層の決まり（AGENTS.md の「Architecture」）を、import を読んで確かめる。
// 上の層は下の層を使ってよい。下の層は上の層を使わない（同じ層どうしはよい）。
//
//   7 app/          ルート（画面を出すだけ）
//   6 screens/      画面
//   5 components/   画面の部品
//   4 myApps/ shortcuts/ attendance/ session/   機能（相手の API に依存しない）
//   3 auth/ webview/                             ログインの流れ / EZCraft のページとの連携
//   2 api/                                       外部 API（http.ts は共通。相手ごとに api/<相手>/）
//   1 models/ platform/ core/ shims/             相手に依存しない型 / 端末ごとの部品 / 設定・時計・テーマ
import { readdirSync, readFileSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';
import ts from 'typescript';

const ROOT = join(__dirname, '..', '..');
const SRC = join(ROOT, 'src');

const LAYERS: Record<string, number> = {
  app: 7,
  screens: 6,
  components: 5,
  myApps: 4,
  shortcuts: 4,
  attendance: 4,
  session: 4,
  auth: 3,
  webview: 3,
  api: 2,
  models: 1,
  platform: 1,
  core: 1,
  shims: 1,
};
/** 画面の側（外部 API の相手ごとのフォルダを、直接は使わない） */
const UI = new Set(['app', 'screens', 'components']);

type Import = { from: string; spec: string; target: string | null; typeOnly: boolean };

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== '__tests__') walk(p, out);
    } else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

function resolveFile(from: string, spec: string): string | null {
  const base = resolve(dirname(from), spec);
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    try {
      readFileSync(c);
      return c;
    } catch {
      // 次の候補
    }
  }
  return null;
}

const files = walk(SRC);
const imports: Import[] = files.flatMap((f) => {
  const sf = ts.createSourceFile(f, readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true);
  const found: Import[] = [];
  for (const st of sf.statements) {
    if ((ts.isImportDeclaration(st) || ts.isExportDeclaration(st)) && st.moduleSpecifier && ts.isStringLiteral(st.moduleSpecifier)) {
      const spec = st.moduleSpecifier.text;
      const typeOnly = ts.isImportDeclaration(st) ? !!st.importClause?.isTypeOnly : st.isTypeOnly;
      found.push({ from: f, spec, target: spec.startsWith('.') ? resolveFile(f, spec) : null, typeOnly });
    }
  }
  return found;
});

const rel = (p: string) => relative(ROOT, p);
const layerOf = (p: string) => relative(SRC, p).split('/')[0];

test('src/ のファイルは、どれも決まった層のフォルダの中にある（直下や知らないフォルダに置かない）', () => {
  const stray = files.filter((f) => !(layerOf(f) in LAYERS)).map(rel);
  expect(stray).toEqual([]);
});

test('import の先が、どれも見つかる', () => {
  expect(imports.filter((i) => i.spec.startsWith('.') && !i.target).map((i) => `${rel(i.from)} -> ${i.spec}`)).toEqual([]);
});

test('下の層から、上の層を使わない', () => {
  const upward = imports
    .filter((i) => i.target && i.target.startsWith(SRC))
    .filter((i) => LAYERS[layerOf(i.target!)] > LAYERS[layerOf(i.from)])
    .map((i) => `${rel(i.from)} (${layerOf(i.from)}) -> ${rel(i.target!)} (${layerOf(i.target!)})`);
  expect(upward).toEqual([]);
});

/** 外部 API の相手ごとのフォルダ（src/api/<相手>/ の中）のファイルか */
const isProviderFile = (p: string) => {
  const r = relative(join(SRC, 'api'), p);
  return !r.startsWith('..') && r.includes('/');
};
/** 相手ごとのフォルダを直接使ってよいファイル: 外部 API そのもの・ログインの流れ・EZCraft のページとの連携・機能の「取り先」（*Source.ts） */
const mayUseProvider = (p: string) => ['api', 'auth', 'webview'].includes(layerOf(p)) || /Source\.tsx?$/.test(p);

test('外部 API の相手ごとのフォルダ（src/api/<相手>/）は、決まったところからしか使わない（画面・機能は *Source.ts を通す）', () => {
  const direct = imports
    .filter((i) => i.target && isProviderFile(i.target) && !mayUseProvider(i.from))
    .map((i) => `${rel(i.from)} -> ${rel(i.target!)}`);
  expect(direct).toEqual([]);
});

test('画面の側（app・screens・components）には、*Source.ts を置かない（取り先は機能のフォルダで決める）', () => {
  expect(files.filter((f) => UI.has(layerOf(f)) && /Source\.tsx?$/.test(f)).map(rel)).toEqual([]);
});

test('ページに入れるスクリプト（src/webview/page/）は、React・React Native・Expo を使わない（ページの中で動く文字を作るだけ）', () => {
  const page = join(SRC, 'webview', 'page');
  const runtime = imports
    .filter((i) => i.from.startsWith(page) && !i.typeOnly)
    // 外の部品（パッケージ）と、page/ の外のファイル（AsyncStorage などを読み込むことがある）。page/ の外は型だけ使ってよい
    .filter((i) => !i.target || !i.target.startsWith(page))
    .map((i) => `${rel(i.from)} -> ${i.spec}`);
  expect(runtime).toEqual([]);
});

test('実行時に読み込み合う（循環する）ファイルがない（型だけの import は数えない）', () => {
  const graph = new Map<string, string[]>();
  for (const i of imports) {
    if (!i.target || i.typeOnly || !i.target.startsWith(SRC)) continue;
    graph.set(i.from, [...(graph.get(i.from) ?? []), i.target]);
  }
  const state = new Map<string, 'open' | 'done'>();
  const cycles: string[] = [];
  const stack: string[] = [];
  const visit = (f: string) => {
    state.set(f, 'open');
    stack.push(f);
    for (const t of graph.get(f) ?? []) {
      if (state.get(t) === 'open') cycles.push([...stack.slice(stack.indexOf(t)), t].map(rel).join(' -> '));
      else if (!state.has(t)) visit(t);
    }
    stack.pop();
    state.set(f, 'done');
  };
  for (const f of files) if (!state.has(f)) visit(f);
  expect(cycles).toEqual([]);
});
