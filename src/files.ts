// ページから受け取ったファイル（PDF・CSV・Excel など）を、一時的な場所に置く・消す。
//
// 給与明細などの個人の情報が入るので、置くのはアプリの一時的な場所（キャッシュ）だけ。
// 見せるのは iPhone の標準のプレビュー（Quick Look）。残しておきたいときは、使う人がそこの共有のボタンから
// 「ファイル」に保存する。プレビューを閉じたことはアプリに分からないので、次のファイルを置くときに
// 古いもの（10 分より前）を消し、ログアウトしたときはすべて消す。
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

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

/** ファイル名に使えない文字を除き、拡張子をそろえる。名前がなければ fallback（画面の名前と日時）にする */
export function fileName(name: string, mime: string, fallback: string): string {
  const ext = EXTENSIONS[mime] ?? '';
  let base = (name || fallback).replace(/[\\/:*?"<>|\r\n\t]/g, '_').trim() || 'download';
  if (ext && !base.toLowerCase().endsWith(`.${ext}`)) base = `${base.replace(/\.(pdf|bin|dat)$/i, '')}.${ext}`;
  return base;
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

/** 古い（10 分より前に置いた）ファイルを消す。all なら、すべて消す */
export function discardOld(all = false): void {
  try {
    const root = new Directory(Paths.cache, FOLDER);
    if (!root.exists) return;
    for (const entry of root.list()) {
      const savedAt = Number(entry.name);
      if (all || !Number.isFinite(savedAt) || Date.now() - savedAt > KEEP_MS) entry.delete();
    }
  } catch {
    // 消せなくても困らない（キャッシュは iPhone も消す）
  }
}

/** iPhone の標準のプレビュー（Quick Look）で見せる。見せられないときは、共有の画面を出す */
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

/** iPhone の共有の画面（「ファイル」に保存・AirDrop・プリントなど）を出す */
export async function shareFile(uri: string, mime: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) return;
  await Sharing.shareAsync(uri, {
    mimeType: mime,
    UTI: mime === 'application/pdf' ? 'com.adobe.pdf' : undefined,
  });
}
