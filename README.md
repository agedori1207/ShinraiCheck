# ShinraiCheck

公開されている情報を複数ソースから取得し、主張が正しい可能性を透明なルールで推定するMVPです。

- Webサイト: Next.js
- 共通判定API: Next.js Route Handler (`POST /api/analyze`)
- iPhone: SwiftUI（同じAPIを利用）
- 無料検索元: 日本語Wikipedia Action API + GDELT DOC 2.0 API
- APIキー: 不要

## 実装済み機能

1. 情報が正しい可能性を0〜100で推定
2. 判定理由を文章と点数内訳で表示
3. 判定に使ったソースを全件表示
4. 政府・大学・報道機関を高め、X・YouTube等を低く重み付け
5. 支持・反証・中立を分けて表示
6. 独立ドメイン数による裏取り評価
7. 同じドメイン内の複数ページを重複加算しない
8. モバイル対応Web UI
9. SwiftUI版iPhoneクライアント

## 無料版の検索方法

### 日本語Wikipedia

日本語の主張に関連する項目と概要を取得します。一般知識や固有名詞の特定に使います。

### GDELT

世界のニュース記事を検索し、記事タイトル、URL、媒体ドメイン、言語、発信国を取得します。Wikipediaで見つかった英語版の項目名を使って、GDELTの英語中心の検索を補助します。

> Wikipediaは一次資料ではありません。GDELTは記事本文を提供する検索エンジンではなく、報道記事のメタデータを返します。判定後は必ず原文を確認してください。

## Web版の起動

```bash
cd web
npm install
cp .env.example .env.local
npm run dev
```

APIキーの入力は不要です。`.env.local`は検索件数を変更したい場合だけ編集します。

ブラウザで `http://localhost:3000` を開きます。

## iPhone版

### 必要なもの

- macOS
- Xcode
- XcodeGen（`brew install xcodegen`）

```bash
cd ios
xcodegen generate
open ShinraiCheck.xcodeproj
```

`ios/ShinraiCheck/APIClient.swift` の `baseURL` を、Web版を公開したHTTPS URLに変更してください。

> iPhone実機から `localhost` はPCを指しません。Render等にWeb版を公開して、そのURLを設定します。

## 公開前に追加したいもの

- API利用回数制限（IP・端末・アカウント単位）
- reCAPTCHA等の自動アクセス対策
- 判定結果のアプリ側キャッシュ
- 個人情報を保存しない方針とプライバシーポリシー
- 利用規約と「真偽を断定しない」表示
- 媒体評価リストの管理画面・変更履歴
- 同一記事の転載・通信社配信をまとめるクラスタリング
- 記事本文と一次資料の取得
- 日本語NLI（含意・矛盾判定）または人手レビュー
- 医療・法律・災害・選挙など高リスク分野の追加警告

## 重要な設計判断

Yahoo!ニュースは大手サービスですが、記事の多くは他社配信です。そのため本MVPではYahoo!ニュースを「集約サイト」とし、東奥日報など編集主体が明確な媒体より低く設定しています。実用版ではYahoo!記事ページから元配信社を特定し、その配信社の評価を採用してください。

同じサイトの関連記事が多数見つかっても、独立した裏取りとはみなしません。支持・反証の点数には、各ドメインで最も強い1件だけを加算します。

## 限界

- 完全なWeb検索ではありません。
- GDELTは英語検索が中心で、日本語の地域ニュースを拾えない場合があります。
- Wikipediaは共同編集であり、一次資料ではありません。
- 記事本文ではなくタイトルと概要・メタデータを中心に評価します。
- 「100%正しい」という断定はせず、取得できた公開情報に基づく推定として表示します。

## GitHub + RenderでWeb版を公開する

このリポジトリにはRender Blueprint用の `render.yaml` と、GitHub Actions用の `.github/workflows/ci.yml` が含まれています。

### 1. GitHubへ登録

GitHubで新しいリポジトリ（例: `ShinraiCheck`）を作成し、このフォルダ全体を `main` ブランチへpushします。

```bash
git init
git add .
git commit -m "Initial ShinraiCheck MVP"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/ShinraiCheck.git
git push -u origin main
```

### 2. Renderへデプロイ

1. Render Dashboardで **New > Blueprint** を選択
2. GitHubアカウントを接続
3. 上で作成したリポジトリを選択
4. Blueprintを適用

**環境変数やAPIキーの入力は不要です。**

Renderはリポジトリ直下の `render.yaml` を読み取り、`web` フォルダをNode.js Web Serviceとしてビルドします。`main` ブランチへのpushごとに自動デプロイされます。

### 3. デプロイ後の確認

- Web画面: `https://<Renderのサービス名>.onrender.com`
- ヘルスチェック: `https://<Renderのサービス名>.onrender.com/api/health`
- 判定API: `POST https://<Renderのサービス名>.onrender.com/api/analyze`

### 4. iPhone版の接続先を変更

`ios/ShinraiCheck/APIClient.swift` の `baseURL` をRenderのURLに変更します。

```swift
var baseURL = "https://<Renderのサービス名>.onrender.com"
```

### GitHub Actions

pushまたはPull Requestのたびに、次を自動実行します。

- ESLint
- TypeScript型チェック
- Next.js本番ビルド
