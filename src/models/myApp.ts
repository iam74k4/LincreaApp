// アプリの中で使う「マイアプリ」の形。どの外部 API から取ってきても、この形に直してから渡す
// （いまは EZCraft の一覧の問い合わせ。src/api/ezcraft/myApps.ts）。画面や機能は、サーバーの項目名や状態コードを知らなくてよい。

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
