# TestFlight で配る（develop に入ったら自動で）

LINCREA は TestFlight で配る。develop にプルリクエストをマージすると、GitHub Actions が Xcode で版を作り、TestFlight に出す。
使う人は、iPhone の TestFlight アプリから入れる。**デベロッパモードも、iPhone の登録（UDID）も要らない。**
版を作るのも送るのも GitHub の中だけで行う（Expo のクラウド・EAS は使わない。eas.json もない）。

## 流れ

```
作業ブランチ ──プルリクエスト（チェック。check.yml）──▶ develop にマージ
                                                    │
                  GitHub Actions「TestFlight に出す」（.github/workflows/testflight.yml。macOS 26・Xcode 26）
                                                    │ 1. チェック（型・lint・テスト・ページのスクリプト）
                                                    │ 2. ビルド番号を決める（作った日時。例 261121.1830）
                                                    │ 3. ios フォルダを作る（npx expo prebuild）→ CocoaPods
                                                    │ 4. Xcode で作る（署名は Xcode が API キーで自動で用意）
                                                    │ 5. App Store Connect に送る
                                                    ▼ 20〜40 分
                  App Store Connect（Apple の処理に 10〜30 分）→ TestFlight → 使う人の iPhone
```

- プルリクエストでも同じ手順が動くが、署名せずに作れるかだけを確かめる（送らない）。作れなくなる直しは、マージの前に分かる
- 手順書だけの変更（`docs/`・`*.md`）では、版を作らない
- 続けてマージしたときは、前のが終わってから次を作る
- 進み具合は GitHub の「Actions」、できあがりは App Store Connect の「TestFlight」で見る
- 手で始めることもできる（Actions →「TestFlight に出す」→「Run workflow」）
  - develop を選び「TestFlight に送る」をつけたまま → いつもと同じく出す
  - ほかのブランチ、または「TestFlight に送る」を外す → 署名せずに作れるかだけを確かめる（送らない）。Xcode を上げるときなどに使う

## ブランチの役割（develop と main）

| ブランチ | 役割 | 入ると起きること |
| --- | --- | --- |
| `claude/…` などの作業ブランチ | 直しを作る場所 | プルリクエストを出すと、チェック（check.yml）が動く |
| **develop** | 直しをまとめる場所。**TestFlight の版の元** | マージするたびに、新しい版が TestFlight に出る（社内の人が使っている版） |
| **main** | **App Store に公開した版の記録**（いまはまだない） | 何も自動では起きない。App Store に出すと決めたときに作る |

- いまは App Store には出していない。使う人には TestFlight で配っている（develop が、そのまま使われている版）
- App Store に公開するときは:
  1. TestFlight で確かめた develop を、main にマージする（main には直接 push しない）
  2. App Store Connect で、その TestFlight の版（同じビルド番号）を選んで、審査に出す。版は作り直さない（TestFlight の版と App Store の版は同じもの）
- main は「お客さんに出した版」、develop は「社内で試している版」。直しは、いつも develop に入れてから main へ

## 使う人に入れてもらう（TestFlight）

1. iPhone に **TestFlight**（App Store にある Apple のアプリ）を入れる
2. 招待のメールか、公開リンクを開いて「インストール」
3. TestFlight アプリの LINCREA の画面で「自動アップデート」をオンにしておく（新しい版が出ると、勝手に入れ替わる）

| テスター | 人数 | 何が要るか |
| --- | --- | --- |
| 内部テスター | 100 人まで | App Store Connect のユーザーとして招く（「ユーザとアクセス」）。Apple の審査なし。版ができたらすぐ届く |
| 外部テスター | 10,000 人まで | メールか公開リンクで招く（App Store Connect のアカウントは要らない）。版ごとに Apple の簡単な審査（ふつう 1 日以内） |

- 社内の人は、内部グループ **「社内」**（自動配信）に入っている。新しい版ができると、全員に自動で届く
  - 人を足すとき: App Store Connect の「ユーザとアクセス」で招く → TestFlight の「社内」→「テスター」の＋で選ぶ（招待のメールが届く）
- TestFlight の版は **90 日で使えなくなる**。develop にマージするたびに新しい版ができるので、ふだんは気にしなくてよい
- 前の配り方（EAS のリンク・Ad Hoc。版10 まで）で入れていた人は、TestFlight から入れ直す（同じアプリなので上書きされ、ログインの情報も残る）

## 版の名前と番号

- 表に出る版（1.0.0）は app.json の `version`。上げるときは app.json を書き換えて develop へ
- ビルド番号は、Actions が作った日時で決める（日本時間の「年月日.時分」。例 `261121.1830`）。app.json には書かない
- アプリのログイン画面とマイアプリのいちばん下に `v1.0.0（261121.1830）` と出る。問い合わせのときは、ここを見てもらう

## 直しを届ける

直しは、いつも develop にマージして、TestFlight の新しい版で届ける（作り直さずに送る仕組み・eas update はやめた）。
急ぐときも同じ（マージから iPhone に届くまで、1 時間ほど）。

## 止まったとき

- GitHub の「Actions」→ 赤くなった実行 → 赤い段のログを見る
- 「TestFlight に送る」で Apple に断られたときは、ログに `code = 90683` のような番号と、理由の文が出る
  - **90683（Missing purpose string）**: Info.plist に、使い道の説明（`NS…UsageDescription`）が足りない。
    使っていない機能でも、部品が触れていれば要る（例: ヘルスケアは読むだけだが、書く説明 `NSHealthUpdateUsageDescription` も要った）。
    app.json の `ios.infoPlist` に足して、develop へ
- **Xcode を上げる時期**: 2027 年 4 月からは iOS 27 SDK（Xcode 27）で作った版しか送れない（いまは Xcode 26。Apple の警告）。
  それまでに testflight.yml の `runs-on` を Xcode 27 の環境にし、「送る」を外した手動の実行で作れるかを確かめてから切り替える

## 最初に一度だけ

1. **App Store Connect にアプリを作る**
   - App Store Connect →「アプリ」→「＋」→「新規アプリ」。プラットフォーム iOS、名前 LINCREA、言語 日本語、
     バンドル ID `com.iam74k4.LincreaApp`、SKU は自由（`lincrea` など）
2. **App Store Connect の API キーを作って、GitHub に預ける**（署名の用意と、送るのに使う）
   - App Store Connect →「ユーザとアクセス」→「統合」→「App Store Connect API」→「チームキー」→「＋」。アクセスは **Admin**
     （Xcode が配布用の証明書を用意するのに要る）。キーのファイル（AuthKey_XXXX.p8）は一度しかダウンロードできない
   - GitHub の LincreaApp →「Settings」→「Secrets and variables」→「Actions」→「New repository secret」で、3つ入れる
     | 名前 | 中身 |
     | --- | --- |
     | `ASC_KEY_ID` | キー ID（10 文字） |
     | `ASC_ISSUER_ID` | 発行者 ID（App Store Connect の同じ画面の上に出る） |
     | `ASC_KEY_P8` | AuthKey_XXXX.p8 の中身（`-----BEGIN PRIVATE KEY-----` から最後の行まで） |
   - リポジトリは Public だが、Secrets は外から見えない（プルリクエストの Actions にも渡らない。送るのは develop だけ）
3. **Apple の契約**: App Store Connect の上に契約の知らせが出ているときは、アカウント保持者が「ビジネス」で同意する（同意していないと、送れないことがある）

### もう使わないもの

- 版を作る・送るのに、Expo のクラウド（EAS）は使わなくなった。2026-11-21 に片づけた:
  - GitHub の Secret `EXPO_TOKEN` … 消した
  - EAS に預けていた App Store Connect の API キー（[Expo] EAS Submit …）… App Store Connect で無効にした
  - 前のプロジェクト @iam74k4/login-demo … 残っていれば、Expo の Settings →「Advanced」→「Delete project」で消してよい
- Expo のプロジェクト @iam74k4/lincrea（app.json の `owner`・`extra.eas.projectId`）は、Expo Go を外のネットワーク
  （Tailscale・トンネル）から開くときだけ使う（docs/device-testing.md）。それも使わないなら、プロジェクトと app.json の2つを消してよい
- Expo の仕組み（Expo SDK・Expo Router・`npx expo prebuild` など）は、アプリの土台なので、そのまま使う
