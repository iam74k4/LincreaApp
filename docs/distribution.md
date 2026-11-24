# TestFlight で配る（develop に入ったら自動で）

LINCREA は TestFlight で配る。develop にプルリクエストをマージすると、GitHub Actions が Xcode で版を作り、TestFlight に出す。
使う人は、iPhone の TestFlight アプリから入れる。**デベロッパモードも、iPhone の登録（UDID）も要らない。**
版を作るのも送るのも GitHub の中だけで行う（Expo のクラウド・EAS は使わない。eas.json もない）。

## 流れ

```
作業ブランチ ──プルリクエスト（チェック。check.yml / 作れるかの確かめ。testflight.yml の build）──▶ develop にマージ
                                                    │
                  GitHub Actions「TestFlight に出す」の release（.github/workflows/testflight.yml。macOS 26・Xcode 26）
                                                    │ 0. いまの develop の先頭か確かめる（古い実行のやり直しでは送らない）
                                                    │ 1. チェック（型・lint・テスト・ページのスクリプト）
                                                    │ 2. ビルド番号とコミットを決める（作った日時。例 261121.1830・1a2b3c4）
                                                    │ 3. ios フォルダを作る（npx expo prebuild）→ CocoaPods
                                                    │ 4. Xcode で作る（署名は Xcode が API キーで自動で用意。キーは Environment「testflight」）
                                                    │ 5. App Store Connect に送る。JavaScript のソースマップを Actions に残す
                                                    │ 6. 4 で Xcode が作った開発用の証明書を、Apple から取り消す（増えすぎると 4 が止まる）
                                                    ▼ 20〜40 分
                  App Store Connect（Apple の処理に 10〜30 分）→ TestFlight → 使う人の iPhone
```

- プルリクエストでは、同じ手順で、署名せずに作れるかだけを確かめる（build。送らない。API キーは読めない）。作れなくなる直しは、マージの前に分かる
  - ただし、署名・書き出し・Apple の受け付けの確かめ（使い道の説明・プライバシーの書類が足りないなど）はしないので、
    プルリクエストが通っても、送るときに断られることはある（下の「止まったとき」）
  - 新しく push したら、前の確かめはやめる（古いコードを作らない）
- 手順書・テスト・道具だけの変更（`docs/`・`*.md`・`src/__tests__/`・`scripts/`・`.claude/`・`LICENSE`・`.gitignore`）では、版を作らない
- 送るのは、develop と hotfix/… をまたいで1つずつ（ビルド番号が重ならないように）。続けてマージしたときは、前のが終わってから次を作る。**3つ以上を続けてマージすると、間のものは作られない**
  （GitHub は、待っている実行を1つしか持たない）。最後のものに、それまでの直しが全部入っているので、届く中身は同じ
- **毎月 1 日 9:00 にも、develop の版を作り直して送る**（TestFlight の版は 90 日で使えなくなるため。マージがない月も切らさない）
  - 毎月の版も、まず「先行」に届く。**「社内」には、毎月1回は新しい版を足す**（足さないと、「社内」の版が 90 日で切れる。下の「使う人に入れてもらう」）
  - GitHub は、公開リポジトリに 60 日なにも入らないと、この毎月の実行を止める（止めたら、メールが届く）。
    そのときは Actions →「TestFlight に出す」→「Enable workflow」で戻す
  - Environment「testflight」に Required reviewers を付けていると、毎月の実行も「Approve」を押すまで待つ
- 進み具合は GitHub の「Actions」、できあがりは App Store Connect の「TestFlight」で見る
- 手で始めることもできる（Actions →「TestFlight に出す」→「Run workflow」）
  - develop を選び「TestFlight に送る」をつけたまま → いつもと同じく出す
  - `hotfix/…` を選び「TestFlight に送る」をつけたまま → 急ぎの直しを出す（下の「直しを届ける」）
  - ほかのブランチ、または「TestFlight に送る」を外す → 署名せずに作れるかだけを確かめる（送らない）。Xcode を上げるときなどに使う
- 古い実行を「Re-run」しても、その実行のコミットが develop の先頭でなければ、送らずに止まる（前の版が、新しい番号で届かないように）。
  手順書だけのマージのあと（版は作らないが、develop の先頭は進む）なども同じ。出し直すときは「Run workflow」で develop を選ぶ（いまの先頭を送る）

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
| 外部テスター | 10,000 人まで | メールか公開リンクで招く（App Store Connect のアカウントは要らない）。版ごとに Apple の簡単な審査（ふつう 1 日以内）。審査ではデモのアカウントを渡す（下の「外部テストの審査」） |

- **先に少人数で確かめてから、全員に配る**（保存は本物の勤怠のデータに書き込むので、まちがった版が全員に一度に届かないように）:
  | グループ | 配り方 | 入る人 |
  | --- | --- | --- |
  | **「先行」**（内部。自動配信） | 版ができたら、すぐ自動で届く | 作る人と、2〜3 人の協力者 |
  | **「社内」**（内部。自動配信を**オフ**） | 「先行」で 1〜2 日使って問題がなければ、App Store Connect の TestFlight →「社内」→「ビルド」の＋で、その版を足す | ほかの全員 |
  - 設定（App Store Connect で一度だけ）: TestFlight →「社内」→「グループの設定」で「自動配信」をオフ → 内部グループ「先行」を作り、自動配信をオンにする
  - 人を足すとき: App Store Connect の「ユーザとアクセス」で招く（役割は **Developer**、アクセスできるアプリは LINCREA だけ）→
    TestFlight の「先行」か「社内」→「テスター」の＋で選ぶ（招待のメールが届く）。内部テスターは 100 人まで
- TestFlight の版は **90 日で使えなくなる**。毎月 1 日に自動で作り直して「先行」に届く（上の「流れ」）。
  「社内」は手で足すので、**毎月1回は「社内」に新しい版を足す**（足し忘れると、「社内」の人のアプリが 90 日で起動できなくなる）
- 前の配り方（EAS のリンク・Ad Hoc。版10 まで）で入れていた人は、TestFlight から入れ直す（同じアプリなので上書きされ、ログインの情報も残る）

## 外部テストの審査（デモのアカウント）

外部テスターに配る版は、Apple が中を見て審査する。会社の EZCraft には審査用のアカウントを作れないので、
**決まったユーザー名とパスワードでログインすると、サーバーにつながずに見本のデータで動く「デモ」になる**（src/demo/）。
ログインがないと「中を確かめられない」（Guideline 2.1(a) Information Needed）で断られる（2026-11-24 に一度断られた）。

- ユーザー名 `appreview`、パスワード `LincreaDemo2026`（src/demo/demoAccount.ts。リポジトリは公開なので誰でも分かるが、見本のデータしか出ない）
- デモで見られるもの: マイアプリの一覧と「よく使う」、勤怠 TiMS（お知らせ・勤務表・1日の登録・残業と有給の申請・申請の状況と取り下げ）、
  給与・賞与明細（明細のパスワードは `1234`）、住民税の通知書、健康診断（予約と結果）、資格取得者の検索、
  Walk the Talk（ヘルスケアから歩数を読んで登録）
- 登録・申請は、アプリのメモリの中の見本に入るだけ（アプリを閉じるか、ログアウトすると初めに戻る）。Face ID でのログインは、デモでは使わない
- 画面の上に「デモ: 見本のデータです」と出る

**App Store Connect に入れる**: TestFlight →「テスト情報」→「ベータ版 App Review 情報」→「サインインが必要」にチェック →
「ユーザ名」と「パスワード」に上のものを入れ、「メモ」に次を貼って「保存」。断られていたら、そのメッセージに返信する（英語でよい）。

```
LINCREA is an internal app for employees of our company (a mobile client for our
company portal). Accounts are issued by the company, so we cannot provide a real
account. Signing in with the credentials above opens a demo mode with sample data:
no company server is contacted and nothing is saved.

Things to try after signing in:
- My Apps: the list of portal apps and the shortcuts at the top
- Attendance (勤怠 TiMS): timesheet, register a day (勤怠実績登録),
  overtime / paid leave requests and their status (cancel a pending request)
- Payslips (給与・賞与明細): password for opening payslips is 1234
- Health check (健康診断): book a checkup and see last year's results
- Walk the Talk: open a day and tap "ヘルスケアから読み込む" to read that day's
  step count from HealthKit (read only; the app never writes to HealthKit)
- Face ID sign-in is available for real accounts only
```

App Store に出すときの「App Review に関する情報」にも、同じものを入れる。

## 版の名前と番号

- 表に出る版（1.0.0）は app.json の `version`。上げるときは app.json を書き換えて develop へ
  - **いつ上げるか**: App Store の審査に出したら、すぐ develop の `version` を次（1.0.0 → 1.0.1 や 1.1.0）に上げる。
    審査に通った版の番号のまま送ると、Apple に断られる（その番号の版はもう締め切られている。ITMS-90186・90062）
- ビルド番号は、Actions が作った日時で決める（日本時間の「年月日.時分」。例 `261121.1830`）。app.json には書かない
- 作ったコミットも、Actions が app.json の `extra.gitSha` に入れる（app.json には書かない）
- アプリのログイン画面とマイアプリのいちばん下に `v1.0.0（261121.1830・1a2b3c4）` と出る（ビルド番号と、コミットの先頭 7 文字）。
  問い合わせのときは、ここを見てもらう。コミットから、その版のコードを `git show 1a2b3c4` でたどれる

## 直しを届ける

直しは、いつも develop にマージして、TestFlight の新しい版で届ける（作り直さずに送る仕組み・eas update はやめた）。
マージから「先行」の iPhone に届くまで、1 時間ほど。

### まちがった版が届いたとき（戻す）

1. **それ以上広げない**: App Store Connect の TestFlight →「iOS」→ まちがった版 →「テストを中止」（Expire Build）。
   その版は、もう誰も入れられなくなる（入れた人の iPhone では起動できなくなる）
2. **前の版に戻してもらう**: 使う人は、TestFlight アプリの LINCREA →「以前のビルド」から、1 つ前の版を入れ直す
   （「社内」のグループには、まだ前の版しか足していなければ、そのままでよい）
3. **直す**: `git revert` で、まちがったコミットを取り消すプルリクエストを作り、develop にマージする（新しい版が届く）

### 急ぎの直し（develop に、まだ出したくない直しが入っているとき）

1. App Store / 「社内」に出している版のコミット（版の名前のかっこの中）から、`hotfix/…` のブランチを作り、直しを入れる
2. その版がもう App Store の審査に通っていたら、`hotfix/…` の app.json の `version` を上げる（1.0.0 → 1.0.1。同じ番号のままだと Apple に断られる）
3. Actions →「TestFlight に出す」→「Run workflow」→ ブランチに `hotfix/…` を選び、「TestFlight に送る」をつけて実行
4. 直しを develop にも入れる（`hotfix/…` から develop へのプルリクエスト。develop の `version` が hotfix より小さければ、合わせて上げる）
- `hotfix/…` から送れるのは、Environment「testflight」が `hotfix/*` を許しているから（下の「最初に一度だけ」）。
  書き込みのできる人なら誰でもこのブランチを作れるので、Required reviewers を付けておくと安全

## 落ちた・おかしいと言われたとき（調べる）

- まず版の名前（`v1.0.0（261121.1830・1a2b3c4）`）を聞く。どのコードの版かが分かる
- **落ちた**: App Store Connect の TestFlight →「クラッシュ」に、使う人が送ったクラッシュの記録と感想が届く（Xcode の Organizer でも見られる）。
  ネイティブ（Swift・Objective-C）の場所は、送った記号の情報（ExportOptions.plist の uploadSymbols）で読める
- **画面を描けなかった**: アプリは落ちずに「表示できませんでした」と、エラーの文と版の名前を出す（src/components/AppErrorScreen.tsx）。
  そのスクリーンショットを送ってもらう
- **JavaScript の場所**: その版の Actions の実行の「Artifacts」に `sourcemap-<ビルド番号>-<コミット>`（JavaScript のソースマップ）が 90 日残る。
  エラーの場所（main.jsbundle の行と列）を、ソースマップでコードの場所に直して読む。
  **App Store の審査に出した版は、90 日より長く使われるので、そのソースマップをダウンロードして、別の場所に残しておく**
  （残し忘れたときは、同じコミットから作り直すと、ふつうは同じソースマップになる。部品の版が同じなら）
- いまは、落ちたこと・エラーを自動で知らせる仕組み（Sentry など）は入れていない。使う人が増えたら入れる（Expo のプラグインがある。アカウントと DSN が要る）

## 止まったとき

- GitHub の「Actions」→ 赤くなった実行 → 赤い段のログを見る
- 「TestFlight に送る」で Apple に断られたときは、ログに `code = 90683` のような番号と、理由の文が出る
  - **90683（Missing purpose string）**: Info.plist に、使い道の説明（`NS…UsageDescription`）が足りない。
    使っていない機能でも、部品が触れていれば要る（例: ヘルスケアは読むだけだが、書く説明 `NSHealthUpdateUsageDescription` も要った）。
    app.json の `ios.infoPlist` に足して、develop へ
  - **91053（Missing API declaration）**: プライバシーの書類（PrivacyInfo）に、使っている API の理由が足りない。app.json の `ios.privacyManifests` に足す
- **証明書が増えすぎて送れない**（「作る（署名して archive）」が `Choose a certificate to revoke. Your account has reached the maximum number of certificates.` で止まる）:
  署名は、Actions の実行ごとに Apple に用意してもらう。archive のとき Xcode が開発用の証明書を1つ作るが、秘密鍵は実行環境といっしょに消えるので、二度と使えない。
  そのため、実行の最後の「開発用の証明書を取り消す」が、その実行で作ったものを取り消す（.github/testflight/revoke-dev-certs.mjs）。
  これが入る前（2026-11-24 まで）は取り消していなかったので、10 回ほど送ったところで上限に達して止まった
  - 止まったら: Apple Developer（developer.apple.com）→「Certificates, Identifiers & Profiles」→「Certificates」で、
    種類が「Development」のものを開いて「Revoke」で取り消し、Actions の「Run workflow」で develop を出し直す。
    自分の Mac で使っている証明書（Xcode →「設定」→「Accounts」→「Manage Certificates」に出るもの）は残す。
    取り消しても、Xcode が次に要るときに作り直すだけ。「Distribution」の証明書には触れない
  - 「開発用の証明書を取り消す」が黄色の警告（取り消せなかった）を出していたら、上と同じく手で取り消す
- **Xcode を上げる時期**: 2027 年 4 月からは iOS 27 SDK（Xcode 27）で作った版しか送れない（いまは Xcode 26。Apple の警告）。
  それまでに testflight.yml の `runs-on` を Xcode 27 の環境にし、「送る」を外した手動の実行で作れるかを確かめてから切り替える。
  実行環境の Xcode は、GitHub が macOS の環境を新しくしたときに変わることがある（ログの「CocoaPods の控えの鍵を決める」の先頭に、使った Xcode の版が出る。
  Xcode が変わったら、CocoaPods の控えも作り直す）

## 最初に一度だけ

1. **App Store Connect にアプリを作る**
   - App Store Connect →「アプリ」→「＋」→「新規アプリ」。プラットフォーム iOS、名前 LINCREA、言語 日本語、
     バンドル ID `com.iam74k4.LincreaApp`、SKU は自由（`lincrea` など）
2. **App Store Connect の API キーを作って、GitHub に預ける**（署名の用意と、送るのに使う）
   - App Store Connect →「ユーザとアクセス」→「統合」→「App Store Connect API」→「チームキー」→「＋」。アクセスは **Admin**
     （Xcode が配布用の証明書を用意するのに要る）。キーのファイル（AuthKey_XXXX.p8）は一度しかダウンロードできない
   - **キーは、GitHub の Environment「testflight」にだけ置く**（リポジトリ全体の Secrets には置かない）
     1. GitHub の LincreaApp →「Settings」→「Environments」→「New environment」→ 名前 `testflight`
     2. 「Deployment branches and tags」→「Selected branches and tags」→ `develop` と `hotfix/*` を足す
        （ほかのブランチ・プルリクエストの Actions からは、キーを読めない）
     3. （できれば）「Required reviewers」に自分を入れる（送る前に、Actions の画面で「Approve」を押すまで待つ。
        依存の部品が乗っ取られても、知らないうちにキーを使われないように）
     4. 同じ画面の「Environment secrets」→「Add environment secret」で、3つ入れる
        | 名前 | 中身 |
        | --- | --- |
        | `ASC_KEY_ID` | キー ID（10 文字） |
        | `ASC_ISSUER_ID` | 発行者 ID（App Store Connect の同じ画面の上に出る） |
        | `ASC_KEY_P8` | AuthKey_XXXX.p8 の中身（`-----BEGIN PRIVATE KEY-----` から最後の行まで） |
     5. 前にリポジトリの Secrets（「Secrets and variables」→「Actions」→「Repository secrets」）に入れていたら、3つとも消す
        （残っていると、どのブランチの Actions からも読める。同じブランチの中なら、プルリクエストでも読めてしまう）
     - **1〜5 は、この仕組み（Environment を使う testflight.yml）を develop に入れる前に済ませる**。Environment がないまま動くと、
       GitHub が決まりのない Environment を自動で作り、リポジトリの Secrets を使って動いてしまう（守りにならないのに、何も警告しない）
   - （任意）使う Xcode を決めておくなら、「Secrets and variables」→「Actions」→「Variables」に `XCODE_APP`（例 `/Applications/Xcode_26.2.app`）を入れる。
     入れなければ、実行環境の決まりの Xcode を使う（GitHub が環境を新しくすると変わる）
   - リポジトリは Public だが、Secrets は外から見えない（よそからのプルリクエスト（fork）の Actions には渡らない）
   - キーは Admin なので、送るときに動く部品（npm・CocoaPods の部品）すべてが、そのあいだキーに触れうる。
     上の 3（Required reviewers）と、依存を増やすときの確かめ（AGENTS.md）で守る
3. **Apple の契約**: App Store Connect の上に契約の知らせが出ているときは、アカウント保持者が「ビジネス」で同意する（同意していないと、送れないことがある）

## App Store に出す前に（審査の準備。まだ出していない）

社内の人だけが使うアプリは、ふつうに App Store に出すと、審査で断られることが多い（ガイドライン 3.2。決まった会社の人だけが使うもの）。
出すと決めたら、まず配り方を決め、次のものを用意する。

- **配り方**: Apple Business Manager の「カスタム App」（決まった会社にだけ配る）か、「非表示（unlisted）」の配布を申し込む。
  ふつうの公開は、会社の外の人も使えるようにするときだけ
- **審査用のアカウント**: デモのアカウント（上の「外部テストの審査」）を、App Store Connect の「App Review に関する情報」に入れる
- **プライバシーポリシーとサポートの URL**: ヘルスケアを使うアプリは、プライバシーポリシーが要る
- **App のプライバシー**（App Store Connect の「App のプライバシー」）: 歩数（ヘルスケア → 「健康とフィットネス」の「フィットネス」）を、
  名前と結びつけて会社のサーバーに送っている（Walk the Talk）。アプリの機能のため・追跡には使わない、と答える。
  アプリの中のプライバシーの書類（app.json の `ios.privacyManifests`）にも、同じことを書いてある。
  ほかに、ログインのユーザー名（「識別子」の「ユーザ ID」。アプリの機能のため・名前と結びつく）も答えるかを、審査に出す前に決める
  （決めたら、app.json の `ios.privacyManifests` にも同じものを足す）
- **輸出の規制**（暗号）: 通信の暗号（HTTPS）とログインだけなので「使っていない」（app.json の `usesNonExemptEncryption: false`）
- **アカウントの削除**: アプリの中でアカウントを作らない（会社が作る）ので、削除の仕組みは要らない
- 審査に出したら、すぐ develop の `version` を上げる（上の「版の名前と番号」）

## Android で配る（まだ配っていない）

Android の版を出すときの手順と、まだないものは docs/android-release.md。

### もう使わないもの

- 版を作る・送るのに、Expo のクラウド（EAS）は使わなくなった。2026-11-21 に片づけた:
  - GitHub の Secret `EXPO_TOKEN` … 消した
  - EAS に預けていた App Store Connect の API キー（[Expo] EAS Submit …）… App Store Connect で無効にした
  - 前のプロジェクト @iam74k4/login-demo … 残っていれば、Expo の Settings →「Advanced」→「Delete project」で消してよい
- Expo のプロジェクト @iam74k4/lincrea（app.json の `owner`・`extra.eas.projectId`）は、Expo Go を外のネットワーク
  （Tailscale・トンネル）から開くときだけ使う（docs/device-testing.md）。それも使わないなら、プロジェクトと app.json の2つを消してよい
- Expo の仕組み（Expo SDK・Expo Router・`npx expo prebuild` など）は、アプリの土台なので、そのまま使う
