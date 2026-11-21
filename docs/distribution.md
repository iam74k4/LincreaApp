# 登録した iPhone に配る（EAS のリンク）

登録した iPhone だけに、リンクから LINCREA を入れてもらう（Apple の Ad Hoc 配布。EAS の「社内配布」）。
App Store の審査は通さない。コマンドは、このフォルダ（LincreaApp）で打つ。

## 1. 新しい人の iPhone を登録する（1台につき1回）

1. Mac で、登録用のリンクを作る

   ```bash
   npx eas-cli@latest device:create
   ```

   「Website」を選ぶと、リンクと QR コードが出る。

2. 相手に、そのリンクを **iPhone の Safari** で開いてもらう
   - 「構成プロファイルのダウンロードを許可しますか？」→「許可」
   - 設定アプリを開き、上に出る「プロファイルがダウンロードされました」→「インストール」→ パスコード
   - 画面に iPhone の番号（UDID）が出たら、登録は済み。プロファイルは「設定 → 一般 → VPN とデバイス管理」から消してよい

3. 登録した iPhone は、次に作る版から入れられる（すでに配った版には入らない。下の 2. で作り直す）

登録できるのは、iPhone で **1年に100台まで**。消しても、枠が戻るのは開発者の会員を更新したとき。

## 2. 版を作って配る

```bash
npx eas-cli@latest build --platform ios --profile preview
```

- Expo のクラウドで作る（15〜30分ほど）。登録した iPhone を選ぶ画面が出たら、配る相手の iPhone を選ぶ
- 終わると、入れるためのリンクと QR コードが出る（expo.dev のビルドのページにも出る）
- 相手は、そのリンクを **iPhone の Safari** で開いて「インストール」を押す。ホーム画面に LINCREA が出る
- デベロッパモードは要らない（配る用の署名のため）
- 作った版は **1年で使えなくなる**。その前に作り直して、入れ直してもらう
- 無料の枠では、iOS は15回まで作れる

リンクは、知っている人なら誰でもダウンロードできる（動くのは登録した iPhone だけ）。会社の人にだけ渡す。

## 3. 直しを送る（作り直さずに）

画面や文言、EZCraft のページに入れるスクリプト（src/webview/）など、JavaScript だけの直しは、作り直さずに送れる。

```bash
npx eas-cli@latest update --channel preview --environment preview --message "直した内容"
```

- アプリは、開いたときに新しい直しを裏で受け取り、**次に開いたとき** に切り替わる
- 送る前に、`npm test`・`npx tsc --noEmit`・`npx expo lint`・`npm run check:pages` を通す
- どの直しで動いているかは、ログイン画面とマイアプリのいちばん下に出る（例: `v1.0.0 · preview · 11/19 14:05 更新（a1b2c3d4）`。
  まだ直しを受け取っていなければ「組み込み」）。問い合わせのときは、ここを見てもらう

### まずい直しを送ってしまったとき

前の直しに戻す（新しい版を作らずに、すぐ戻せる）:

```bash
npx eas-cli@latest update:rollback --platform ios --message "戻した理由"
```

- 一覧から、戻したい直し（いちばん新しいもの）を選ぶ。その前の直しが、もう一度送られる（前がなければ、配った版に入っていた中身に戻る）
- 戻したあと、利用者はアプリを2回開き直すと切り替わる（1回目で受け取り、2回目で切り替わる）
- 送った直しの一覧は expo.dev のプロジェクトの「Updates」で見られる

### 作り直しが要るとき

次のような、アプリの中の仕組み（ネイティブ）を変えたときは、2. で作り直して入れ直してもらう。

- パッケージを足した・上げた（`npx expo install …`）
- app.json の plugins・権限・アイコン・名前を変えた
- modules/ や patches/ を変えた

作り直しが要る変更かどうかは、自動で見分ける（app.json の `runtimeVersion` が `fingerprint`）。
作り直しが要る変更の後に送った直しは、古い版のアプリには届かない（届いて壊れることはない）。

## Mac なしで（スマホから）

2. と 3. は、GitHub の Actions からも始められる。スマホの GitHub アプリ（またはブラウザ）で、
LincreaApp →「Actions」→ 下のどちらかを選ぶ →「Run workflow」。

| Actions の名前 | すること | ファイル |
| --- | --- | --- |
| iPhone に配る版を作る | 2. と同じ。登録した iPhone を、新しいものも含めて全部入れて作る。develop の中身を、チェックが通ったら作る | .github/workflows/eas-preview-build.yml |
| 直しを送る | 3. と同じ。develop にある今の中身を、チェックが通ったら送る。「直した内容」を書いて始める | .github/workflows/eas-update.yml |
| チェック | develop への push とプルリクエストのたびに、自動で動く（型・lint・テスト・ページのスクリプト） | .github/workflows/check.yml |

- 「Run workflow」で develop 以外のブランチを選ぶと、配る版も直しも作らずに止まる（作りかけの直しを、配った iPhone に送らないため）

- 「iPhone に配る版を作る」は、EAS に作業を頼んだら終わる。できあがりは、expo.dev のプロジェクトの「Builds」で見る（15〜30分ほど）。
  そのビルドのページのリンクを、相手に送る
- 新しい人の iPhone は、1. で作った登録用のリンクを送れば登録できる（リンクに期限はない）。
  登録が済んだら「iPhone に配る版を作る」を押す。同じリンクで登録できなかったときは、Mac で 1. をやり直して新しいリンクを作る

### 最初に一度だけ（済んでいなければ）

1. **App Store Connect の API キーを EAS に預ける**（Mac で。新しい iPhone を、ビルドのたびに自動で入れるため）

   ```bash
   npx eas-cli@latest credentials --platform ios
   ```

   「preview」→「App Store Connect: Manage your API Key」→ 新しいキーを作る（Apple ID でログインする）。
   キーは Expo のサーバーに暗号化して置かれる。Admin の権限なので、要らなくなったら App Store Connect の「ユーザとアクセス → 統合」で取り消す
2. **Expo のアクセストークンを GitHub に預ける**（スマホでもできる）
   - expo.dev → アカウントの設定 →「Access tokens」→ 新しいトークンを作る
   - GitHub の LincreaApp →「Settings」→「Secrets and variables」→「Actions」→「New repository secret」。
     名前は `EXPO_TOKEN`、値は作ったトークン

## App Store・TestFlight に出すとき

`eas.json` の `production` を使う（版の番号は EAS が上げる）。

```bash
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest submit --platform ios --profile production
```
