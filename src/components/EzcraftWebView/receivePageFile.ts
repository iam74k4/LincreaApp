// ページが作った PDF・CSV・Excel を受け取り、一時的な場所に置いて見せる（src/platform/files.ts）。
// PDF はアプリの画面（WebView で見られる端末だけ。PDF_IN_APP。左上で戻れる。src/screens/FileScreen.tsx）、
// ほかは端末の標準のプレビュー（どちらも共有のボタンから保存・プリントなどができる）。
import { Alert } from 'react-native';
import { router } from 'expo-router';

import { fileName, mimeFor, openFile, PDF_IN_APP, saveIncoming } from '../../platform/files';

/** ページから届いたファイル（中身は base64） */
export type PageFile = { base64: string; name: string; mime: string };

/**
 * 受け取ったファイルを置いて、見せる。名前がなければ「画面の名前_日時」にする。
 * beforeShow は、置けたあと・見せる前に呼ぶ（明細なら、手で入れたパスワードを Face ID で覚えるか聞く）
 */
export async function receivePageFile({ base64, name, mime }: PageFile, screenName: string, beforeShow?: () => Promise<void>): Promise<void> {
  const d = new Date();
  const two = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}_${two(d.getHours())}${two(d.getMinutes())}`; // 20261116_1240
  const saved = fileName(name, mime, `${screenName}_${stamp}`);
  try {
    const file = await saveIncoming(base64, saved);
    if (beforeShow) await beforeShow();
    if (PDF_IN_APP && (mime === 'application/pdf' || /\.pdf$/i.test(saved))) {
      router.push({ pathname: '/file', params: { uri: file.uri, title: saved.replace(/\.pdf$/i, ''), mime: 'application/pdf' } });
      return;
    }
    await openFile(file, saved.replace(/\.[a-z0-9]+$/i, ''), mimeFor(saved, mime));
  } catch (e) {
    Alert.alert('ファイルを開けませんでした', e instanceof Error ? e.message : String(e));
  }
}
