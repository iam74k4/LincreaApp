# Android で配る（準備はできている。まだ Google Play には出していない）

iOS と同じコード（src/）で動く。端末ごとの違いは、決まった1か所ずつに閉じ込めてある（AGENTS.md の Rules）。
Android のエミュレーター（Android 16・API 36）で、作って動かすところまでは確かめてある（下の「確かめたこと」）。
Google Play に出す前に、下の「Google Play に出す前にすること」と、実機での確かめをする。

## もうできているもの

- パッケージ名 `com.iam74k4.LincreaApp`（app.json の `android.package`。iOS のバンドル ID と同じ）。
  **Google Play に一度出すと変えられない**。小文字だけ（`com.iam74k4.lincreaapp` など）にするなら、最初に出す前に変える
- アイコン（adaptive icon。app.json の `android.adaptiveIcon`）、通知のアイコン（白と透明の画像。expo-notifications の `icon`）
- 要らない権限を外す（app.json の `android.blockedPermissions`。ほかのアプリの上に重ねる・古い保存場所・写真を読む。
  写真を読む権限は expo-screen-capture が足すが、このアプリは使わない。Google Play の審査で理由を聞かれる）。
  依存を足したら、`npx expo prebuild --platform android` で作った AndroidManifest.xml の権限を見直す。
  **スクリーンショットの検知（`DETECT_SCREEN_CAPTURE`）は外さない**: expo-screen-capture は、Android 14 以上では起動のときに必ず
  スクリーンショットの知らせを受ける登録をするので、この権限がないと起動してすぐ落ちる（エミュレーターで確かめた）。
  インストールのときに許される権限で、許可の画面は出ない
- 給与明細・健康診断・受け取った PDF の画面は、「最近使ったアプリ」に写らない（そのあいだはスクリーンショットも撮れない。src/platform/privacyScreen.ts）
- 通知のチャンネル（Android 13 以上で、通知の許可を尋ねるのに要る。src/attendance/attendanceReminder.ts）
- 生体認証: 強い生体認証（指紋・3D の顔）だけを使う。保存のときの確かめの画面は1回（src/auth/faceId.ts）
- PDF: Android の WebView は PDF を描けないので、端末の PDF を開けるアプリで開く（src/platform/files.ts の `PDF_IN_APP`）
- 読み込みの失敗の文、アイコン、WebView のページが落ちたときの読み直し、検索バーを閉じたとき
- ダークモード: Android のテーマは端末の明るさに合わせる（Expo のひな形の `DayNight`）。React Native の `useColorScheme` も端末に合わせる。
  `npx expo prebuild` が出す「userInterfaceStyle: Install expo-system-ui」の知らせは、明るさを**固定する**ときに要るというもので、
  このアプリ（`automatic`）は入れなくてよい（expo-system-ui は iPhone にも入り、起動のときに下地の色を固定するので入れていない）
- **ページに入れるスクリプトの順番**: react-native-webview（14.0.1）の Android は、ページが動き出したあとにスクリプトを入れていた（iOS は前）。
  patches/react-native-webview+14.0.1.patch で、Android でも `WebViewCompat.addDocumentStartJavaScript` を使い、ページより前に入れる
  （「開いた元のウインドウの代わり」・画面の定義の控え・見た目の直しが、ページより遅れない）。
  この仕組みのない古い WebView（`WebViewFeature.DOCUMENT_START_SCRIPT` がない Android System WebView）では、今までどおりページが動き出したときに入れる。
  同じ直しで、**ページからの知らせの送り元**（`nativeEvent.url`）も iOS に合わせる: 元の Android は「サイトの名前」（https://…）しか渡さず、
  アプリは送り元のページの URL（/runapp/<アプリ>/）でどのアプリの知らせかを決める（src/webview/origin.ts の trustedSenderApp）ので、
  歩数・申請・明細のパスワードなどの知らせが、ログインのあと全部捨てられてしまう。いちばん外の枠からの知らせはページの URL を、
  iframe からの知らせと、ページの URL が送り元のサイトとちがうとき（移った直後）は、サイトの名前だけを渡す（どのアプリのものとも信じない）。
  この仕組み（WebMessageListener）のない古い WebView（Android System WebView 84 ごろより前）は、どの枠から来たかが分からないので、
  いつもサイトの名前だけを渡す（そこでは、歩数・申請などのアプリごとの知らせは使えない。Google Play で WebView を新しくすれば使える）。
  react-native-webview を上げるときは、上の版がこの2つを持っているかを見て、直しを作り直すか外す
- **歩数（ヘルスコネクト）**: modules/health に Android の部品（Kotlin。Health Connect の歩数を読むだけ）がある。iPhone と同じ3つの関数
  （isAvailable・requestStepsAccess・stepsOnDay）と、呼び名（`sourceName`「ヘルスコネクト」。ページの知らせに出す）。
  - Android 9 以上で、ヘルスコネクトが使える端末だけ（Android 14 以上は端末に入っている。13 以下は Google Play の「ヘルスコネクト」のアプリが要る）。
    使えなければ、iPhone の Expo Go と同じく、歩数は手で打つ
  - 権限は `android.permission.health.READ_STEPS` だけ（modules/health/android/src/main/AndroidManifest.xml）。
    ヘルスコネクトの権限の画面から開く「使い道の説明」の画面も、その部品にある（HealthPermissionsRationaleActivity。決まりで要る）
  - 許可の求め方: Android 14 以上は、端末のふつうの権限として Expo の権限の仕組みで求める。
    ヘルスコネクトの contract（PermissionController）は Android 14 以上で requestPermissions になるが、Expo の activity result の
    仕組みは onActivityResult しか受けないので、答えが届かずに待ち続ける（エミュレーターで確かめた）。
    Android 13 までは、ヘルスコネクトのアプリの画面を開く contract を使う（こちらは onActivityResult で答えが届く）
  - 1日の歩数は、ヘルスコネクトの画面と同じく、スマートフォンと腕時計などの記録元を重ねずに足す（aggregate の COUNT_TOTAL）
- **アップロード鍵での署名**: plugins/withAndroidReleaseSigning.js が、作るたびに android/app/build.gradle に署名の設定を入れる
  （android フォルダは作り直すたびに消えるので、設定はここに置く）。鍵の場所とパスワードは環境変数で渡す:
  `ANDROID_UPLOAD_KEYSTORE`（鍵のファイルの場所）・`ANDROID_UPLOAD_KEYSTORE_PASSWORD`・`ANDROID_UPLOAD_KEY_ALIAS`・`ANDROID_UPLOAD_KEY_PASSWORD`。
  4つがそろっていなければ、Expo のひな形のデバッグ用の鍵で署名する（手元とプルリクエストでの確かめ用。Google Play は受け付けない）
- **versionCode**: Actions が、作った時の「1970 年からの分」（例 29412345）を app.json の `android.versionCode` に入れる
  （.github/actions/prepare-android。iOS のビルド番号の形 261121.1830 を整数にすると、Google Play の上限 2,100,000,000 を超えるので使わない）。
  app.json には書かない。アプリの下の版の名前には、この番号とコミットが出る（src/core/appVersion.ts）
- **Actions のワークフロー**（.github/workflows/android.yml。GitHub の ubuntu の実行環境）:
  - プルリクエスト: `build` … 作れるかだけを確かめる（デバッグ用の鍵。Secrets を使わない。20〜30 分ほど）
  - 手で始める（Actions →「Android の版を作る」→「Run workflow」で develop か hotfix/… を選ぶ）: `release` … チェック →
    アップロード鍵で署名した .aab を作る → デバッグ用の鍵・ちがう鍵で署名されていないかを確かめる → .aab を Actions の成果物（Artifacts）に 14 日残す
    （ソースマップと R8 の対応表は、別の成果物に 90 日）。Google Play にはまだ自動では送らない。
    リポジトリが Public なので、成果物は GitHub にログインしただれでも落とせる（中身はこのリポジトリのコードから作れるもので、鍵は入っていない）

## Google Play に出す前にすること（持ち主がする）

1. **アップロード鍵を作る**（手元の Mac で。1回だけ。リポジトリの外に置く。`*.keystore` は .gitignore 済み）:

   ```bash
   keytool -genkeypair -v -storetype PKCS12 -keystore ~/lincrea-upload.keystore -alias upload -keyalg RSA -keysize 4096 -validity 10000
   ```

   鍵のファイルとパスワードは、パスワードの管理アプリなどに控える（なくすと、Google Play のサポートで鍵の差し替えを頼むことになる）。
2. **GitHub に預ける**: Settings → Environments →「New environment」で `google-play` を作り、「Deployment branches and tags」を
   「Selected branches and tags」にして `develop` と `hotfix/*` を足す。Environment secrets に4つを入れる:
   - `ANDROID_UPLOAD_KEYSTORE_BASE64` … `base64 -i ~/lincrea-upload.keystore | pbcopy` で写したもの
   - `ANDROID_UPLOAD_KEYSTORE_PASSWORD`・`ANDROID_UPLOAD_KEY_ALIAS`（上の例では `upload`）・`ANDROID_UPLOAD_KEY_PASSWORD`

   リポジトリの変数（Settings → Secrets and variables → Actions → Variables）に `ANDROID_UPLOAD_CERT_SHA256` も入れる
   （ちがう鍵の Secrets で作ったら、Actions が止める）。値は次の「SHA256:」の行:

   ```bash
   keytool -list -v -keystore ~/lincrea-upload.keystore -alias upload
   ```
3. **.aab を作る**: Actions →「Android の版を作る」→「Run workflow」で develop を選ぶ。終わったら、実行のページの Artifacts から
   `android-<versionCode>-<コミット>` を落とす（中身が app-release.aab）
4. **Play Console に入れる**: アプリを作り（パッケージ名は上のもの）、「Play App Signing」を使う（Google が配る鍵を預かり、上の鍵はアップロード用になる）。
   最初の .aab は「内部テスト」に手で入れる
5. 送るのを自動にするなら（2回目から）: Google Cloud のサービスアカウントを Play Console に招き、その JSON を `google-play` の Secrets に足して、
   android.yml の release の最後に「内部テストへ送る」手順を足す

### Google Play の決まり

- 社内の人だけに配るなら、Managed Google Play の「限定公開アプリ（private app）」が合う（一般の公開はしない）
- 個人の開発者アカウントで一般に公開するには、12 人以上・14 日以上の「クローズドテスト」が先に要る
- 「データ セーフティ」の回答: 歩数（「健康とフィットネス」）を会社のサーバーに送る（Walk the Talk）。名前と結びつく。アプリの機能のため。
  プライバシーポリシーの URL も要る
- **ヘルスコネクトの「プライバシー ポリシー」の画面**: ヘルスコネクトの許可の画面の「privacy policy」は、アプリの
  HealthPermissionsRationaleActivity を開く。いまは歩数の扱い（読むもの・使い道・送り先・アプリに残さないこと・やめ方）を書いてある。
  プライバシーポリシーの URL ができたら、この画面にそのリンク（または全文）を足す（Google Play の審査は、ここにポリシーがあるかを見る）
- **ヘルスコネクトの申告**: Play Console の「アプリのコンテンツ」→「健康に関するアプリ」で、歩数を読む理由（Walk the Talk の歩数の登録）を答える。
  答えて通るまで、ヘルスコネクトの権限は Google Play の版では使えないことがある

## 手元で作る（確かめる）

JDK 17 と Android SDK（Homebrew の `openjdk@17` と `android-commandlinetools`）が要る。

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
```

```bash
npx expo prebuild --platform android --clean --no-install && (cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a)
```

できた android/app/build/outputs/apk/release/app-release.apk を、エミュレーターに `adb install -r` で入れる。

## 確かめたこと（エミュレーター。2026-11-21）

Android 16（API 36）・Pixel 7 のエミュレーターに、Release の版（arm64-v8a）を入れて確かめた。

- 起動して、ログインの画面が出る（ライト・ダーク。アプリを開いたまま端末をダークにしても追いつく。上の時刻の文字の色も変わる）
- 電波がないときにログインすると「通信できませんでした。電波のよい所でもう一度お試しください。」が出る
- ページに入れるスクリプト（直しの入った react-native-webview）: 確かめ用の画面（確かめたあとに消した）で、
  ページの `<head>` の最初のスクリプトより先に動く・1回だけ動く（onPageStarted で2回目を入れない）・iframe の中では動かない
  （`injectedJavaScriptBeforeContentLoadedForMainFrameOnly` の決まりどおり）・https のページへ移ったあとも動く、を確かめた
- 歩数: `isAvailable` は true、呼び名は「ヘルスコネクト」。初めてのときにヘルスコネクトの許可の画面が出て（歩数を読むだけ）、
  そこの「privacy policy」から使い道の説明の画面が開く。「許可」でも「許可しない」でも答えが返る（歩数の記録のないエミュレーターなので 0）
- 見つけて直したもの: 上の「スクリーンショットの検知」の権限で起動してすぐ落ちる／Android 14 以上で許可の答えが届かない／
  使い道の説明の画面の文字が上の時刻に重なる（Android 15 からは画面の端まで描くので、そのぶん空けた）／ダークでスイッチの「切」の地が見えない／
  ページからの知らせの送り元がサイトの名前だけで、アプリごとの知らせが全部捨てられる（レビューで見つけ、確かめ用の画面で直ったことを確かめた）

確かめていないもの: ログインしたあとの画面（会社のアカウントが要る）、Android 9〜13（ヘルスコネクトのアプリの画面を開く道）、実機

## 実機で確かめること

- ログイン（パスワード・指紋 / 顔）、ログアウト、次の起動でログインしたままか
- 近道（勤務表・残業申請・有給休暇申請）で、目的の画面が開くか（ページに入れるスクリプトの順番の影響を受ける）
- 保存（登録・削除）と、保存の途中で戻ったとき（Android は裏で続けず、終わってから戻る。src/components/SavePark.tsx の `CAN_PARK`）
- 給与明細の PDF が開くか、パスワードを指紋で入れられるか、明細の画面が「最近使ったアプリ」に写らないか
- 勤怠登録の通知が届くか（通知の許可の画面が出るか）
- 電波がないとき・機内モードで、「インターネットにつながっていません」が出るか
- Walk the Talk の歩数入力で、ヘルスコネクトの許可の画面が出て、歩数が入るか（ヘルスコネクトに歩数のある端末で）

## まだないもの（iPhone も同じ）

- **ログアウトで Cookie を消す**: ログアウトの通信が届かなかったとき、サーバーのログインが端末に残る（次の起動で気づいて終わらせる。
  src/auth/savedSession.ts）。Cookie を消すネイティブの部品が要る（いまは入れていない）
