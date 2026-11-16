// アプリの画面を、画面を重ねて開く。マイアプリから開いたときも、アプリの中から別の画面を開いたときも、ここに来る。
import { RunApp } from '../../../../components/RunApp';

export default function RunAppScreen() {
  return <RunApp sheet={false} />;
}
