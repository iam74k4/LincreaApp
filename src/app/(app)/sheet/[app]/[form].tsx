// アプリの画面を、いまの画面の上にシートで重ねて開く（勤怠実績登録から、その場で残業申請を作るときなど）。
// 下に引っぱるか、左上の × で閉じると、元の画面に戻る。
import { RunApp } from '../../../../components/RunApp';

export default function SheetAppScreen() {
  return <RunApp sheet />;
}
