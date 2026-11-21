// ページから受け取ったファイル（PDF・CSV・Excel など）を、一時的な場所に置く・消す。
//
// 給与明細などの個人の情報が入るので、置くのはアプリの一時的な場所（キャッシュ）だけ。
// 見せるのは、PDF はアプリの画面（src/screens/FileScreen.tsx。PDF_IN_APP の端末だけ）、ほかは端末の標準のプレビュー
// （iPhone は Quick Look、Android は PDF などを開けるアプリ）。
// 残しておきたいときは、使う人が共有のボタンから保存する。見終わったことはアプリに分からないので、
// 次のファイルを置くときに古いもの（10 分より前）を消し、ログアウトしたときはすべて消す。
import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * PDF を、アプリの画面（WebView）で見せられるか。iPhone の WebView は PDF を描ける。
 * Android の WebView は PDF を描けず、アプリのファイルを読むことも許していない（react-native-webview が file:// を閉じる）ので、
 * Android は端末の標準のプレビュー（openFile）で開く
 */
export const PDF_IN_APP = Platform.OS === 'ios';

const FOLDER = 'myapp-files';
const KEEP_MS = 10 * 60 * 1000;

/** 中身の種類から、ファイルの拡張子を決める（名前に拡張子がないとき） */
const EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'text/csv': 'csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls',
  'application/zip': 'zip',
};

/** 拡張子から中身の種類（EXTENSIONS の逆引き） */
const MIME_BY_EXTENSION: Record<string, string> = Object.fromEntries(Object.entries(EXTENSIONS).map(([mime, ext]) => [ext, mime]));

/**
 * 中身の種類を、名前の拡張子で補う。ページが種類を言わないファイルは octet-stream（何でもあり）で届く。
 * Android は、開くアプリを探すのに種類が要る（octet-stream だと探せず、共有の画面になる）。
 * iPhone は補わない: Quick Look は拡張子で見分けるので種類は要らず、種類を変えると、共有の画面に回ったとき
 * expo-sharing が種類の拡張子をつけた名前（実績.XLSX.xlsx など）で渡してしまう
 */
export function mimeFor(name: string, mime: string): string {
  if (Platform.OS !== 'android' || (mime && mime !== 'application/octet-stream')) return mime;
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1].toLowerCase() ?? '';
  return (Object.hasOwn(MIME_BY_EXTENSION, ext) ? MIME_BY_EXTENSION[ext] : undefined) ?? (mime || 'application/octet-stream');
}

/** ファイル名に使えない文字を除き、拡張子をそろえる。名前がなければ fallback（画面の名前と日時）にする */
export function fileName(name: string, mime: string, fallback: string): string {
  const ext = EXTENSIONS[mime] ?? '';
  let base = (name || fallback).replace(/[\\/:*?"<>|\r\n\t]/g, '_').trim() || 'download';
  if (ext && !base.toLowerCase().endsWith(`.${ext}`)) base = `${base.replace(/\.(pdf|bin|dat)$/i, '')}.${ext}`;
  return base;
}

/** 受け取ったファイルを置く場所の中のファイルか（PDF を見る画面は、ここのファイルしか開かない。src/screens/FileScreen.tsx） */
export function isReceivedFile(uri: string | undefined): boolean {
  if (typeof uri !== 'string') return false;
  try {
    return isInside(uri, new Directory(Paths.cache, FOLDER).uri);
  } catch {
    return false;
  }
}

/** uri が、folder（file:// の場所）の中にあるか。「..」で外に出るものは入れない */
export function isInside(uri: string, folder: string): boolean {
  if (!uri.startsWith('file://') || /(^|\/)\.\.(\/|$)/.test(decodeURIComponent(uri))) return false;
  const base = folder.endsWith('/') ? folder : `${folder}/`;
  return uri.startsWith(base);
}

/** 受け取った中身（base64）を、一時的な場所にファイルとして置く。置いたファイルを返す */
export async function saveIncoming(base64: string, name: string): Promise<File> {
  discardOld();
  const folder = new Directory(Paths.cache, FOLDER, String(Date.now())); // 同じ名前のファイルが重ならないように、毎回別のフォルダ
  folder.create({ intermediates: true });
  const file = new File(folder, name);
  await file.write(base64, { encoding: 'base64' });
  return file;
}

/** いま画面で見ているファイル（置き場のフォルダの名前 → 見ている画面の数）。古くなっても消さない */
const inUse = new Map<string, number>();

/**
 * いま見ているファイルとして押さえる（PDF の画面を開いているあいだ。src/screens/FileScreen.tsx）。返した関数を呼ぶと外す。
 * 押さえていないと、10 分を過ぎてアプリが裏に回ったときに消え、共有のボタンが使えなくなる
 */
export function holdFile(uri: string): () => void {
  const name = new RegExp(`/${FOLDER}/([^/]+)/`).exec(uri)?.[1];
  if (!name) return () => {};
  inUse.set(name, (inUse.get(name) ?? 0) + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const left = (inUse.get(name) ?? 1) - 1;
    if (left > 0) inUse.set(name, left);
    else inUse.delete(name);
  };
}

/** 古い（10 分より前に置いた）ファイルを消す（いま見ているものは残す）。all なら、すべて消す（ログアウト） */
export function discardOld(all = false): void {
  try {
    const root = new Directory(Paths.cache, FOLDER);
    if (!root.exists) return;
    for (const entry of root.list()) {
      if (!all && inUse.has(entry.name)) continue;
      const savedAt = Number(entry.name);
      if (all || !Number.isFinite(savedAt) || Date.now() - savedAt > KEEP_MS) entry.delete();
    }
  } catch {
    // 消せなくても困らない（キャッシュは iPhone も消す）
  }
}

/** 端末の標準のプレビュー（iPhone は Quick Look、Android は開けるアプリ）で見せる。見せられないときは、共有の画面を出す */
export async function openFile(file: File, title: string, mime: string): Promise<void> {
  try {
    if (await File.canPreview(file, { mimeType: mime })) {
      await File.preview(file, { title, mimeType: mime });
      return;
    }
  } catch {
    // プレビューできない（古い Expo Go など）→ 共有の画面へ
  }
  await shareFile(file.uri, mime);
}

/** 端末の共有の画面（iPhone は「ファイル」に保存・AirDrop・プリントなど。Android は保存・送る）を出す */
export async function shareFile(uri: string, mime: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) return;
  await Sharing.shareAsync(uri, {
    mimeType: mime,
    UTI: mime === 'application/pdf' ? 'com.adobe.pdf' : undefined,
  });
}
