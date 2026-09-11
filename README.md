# MoguChart App

ガントチャートツール「[MoguChart](https://moguchart.jp)」のアプリケーションリポジトリです。
本リポジトリは、フロントエンドおよび Firebase Functions によるバックエンド API を統合管理するモノレポ構成（`pnpm workspaces`）となっています。

---

## 📚 ドキュメント案内

| ドキュメント | 説明 |
| :--- | :--- |
| 📖 [操作マニュアル](docs/operation-manual.md) | 基本操作、WBS・階層管理、進捗管理、矩形選択、ミニマップ、画像添付、共同編集などの詳細ガイド |
| 📝 [リリースノート](docs/release-notes.md) | 各バージョンの変更履歴・新機能・改善項目 |
| 🌐 [REST API 仕様書](docs/openapi.yaml) | OpenAPI 3.0 形式による REST API エンドポイント仕様 |
| ☁️ [Terraform ガイド](terraform/README.md) | GCP / Firebase インフラリソースの IaC 管理設定 |
| 📑 [GAS 連携テンプレート](docs/gas-template/) | Google スプレッドシート等とのデータ連携スクリプト（Clasp 対応） |

---

## ✨ 主な機能

### 1. 高度なガントチャート機能（コアライブラリ連携）
- **高速な仮想スクロール** — `@mogura/moguchart-core` を採用し、大量のタスクや行があっても滑らかに動作
- **WBS（階層ツリー構造・行の開閉）** — `parentId` による無制限の親子階層（大工程 ＞ 中工程 ＞ 詳細タスクなど）のツリー構造に対応。行ヘッダーのインデント表示、開閉トグルアイコン（▼/▶）による展開/折りたたみ、階層構造を維持した安全なドラッグ＆ドロップ並び替え（子タスクブロック連動移動・循環参照防止）
- **サマリータスク（自動集計＆描画）** — 子階層を持つ親行において、配下タスクの期間（最小開始日〜最大終了日）および加重平均進捗率を自動集計してサマリーバー（ブラケット形状）を描画。プロジェクト既定色および行単位でのサマリー色カスタマイズ、通常タスクとの共存描画、表示設定からの表示/非表示切り替えに対応
- **全体の表示倍率（ズーム）とフォントサイズ連動** — 50%〜200%の全体スケーリング。カレンダー横幅だけでなく行ヘッダー幅、バーの高さ、フォントサイズ（`--moguchart-font-scale` によるタスク名・行名・ラベル・バッジ等の一括スケーリング）が自然に連動。Chrome風ズームUI（ステップ伸縮、ワンクリックリセット、ショートカット `Cmd+0` / `Ctrl+0`）、ホイール操作（Ctrl/Cmd）によるスムーズなズーム
- **カレンダー横幅プリセット** — 全体ズームとは独立して、日・月・時間単位ごとに5段階（極小・小・中・大・特大）の基準カレンダー横幅を個別に選択可能
- **柔軟なタイムライン** — 日単位 / 週単位 / 月単位 / 時間単位表示の切り替え、全タスクの表示領域フィット
- **インタラクティブなタスク操作** — ドラッグ＆ドロップによる移動・行間移動（横方向限定移動への制限設定あり）、ハンドルによる期間リサイズ（日・時間・月単位スナップ対応）
- **タスク進捗率の管理・ドラッグ編集** — タスクバー上への進捗インジケーター描画、ドラッグハンドルによる直感的な進捗変更（5%スナップ）、サマリータスクへの進捗ラベル表示設定、プロジェクトごとの進捗管理ON/OFF切り替え
- **矩形範囲選択（ラバーバンド選択）** — 空白背景ドラッグによる複数タスク一括選択、Shift / Ctrl / Cmd キーによる追加選択、一括移動・複製・削除
- **ミニマップ（鳥瞰ビュー）** — チャート全体を俯瞰できるフローティング小窓、サマリータスク・進捗率・マイルストーンの反映、ドラッグによるスクロール同期・パン操作、クリックジャンプ、ドラッグリサイズ、コンパクトな不透明度調整（20%〜100%）、折りたたみ
- **タスク・行の画像管理** — クリップボード（Ctrl+V）からの直接貼り付け、ドラッグ＆ドロップアップロード、自動圧縮、サムネイル表示、ライトボックス拡大表示
- **マイルストーン＆マーカー** — プロジェクトマイルストーン（縦線＋バッジ）および行タイムライン上のマーカー（三角形アイコン＋ラベル）
- **依存関係線** — タスク間の依存関係を矢印付き曲線（逆方向はS字カーブ）で描画、クリティカルパス（最長チェーン）の自動検出とハイライト（サマリータスクは集計タスクのため依存線を自動抑止）
- **高画質エクスポート** — PNG 画像および PDF 形式でのガントチャート全体出力（スクロール位置を保持）

### 2. リアルタイム共同編集 & 権限管理
- **リアルタイム同期 & プレゼンス** — Firestore を活用した複数メンバー間でのリアルタイム共同編集、アクティブユーザーのアバター表示
- **ロール別アクセス制御** — オーナー、編集者、閲覧者の3段階の権限管理
- **タスク担当者（Assignees）機能** — 閲覧者権限のユーザーであっても、自身が担当するタスクの進捗率のみ直接ドラッグ編集またはダイアログから更新可能

### 3. データ連携 & バックアップ
- **REST API (OpenAPI 3.0準拠)** — プロジェクト・行・タスク・コメントの個別 CRUD、APIキー認証（発行・失効UI）、レートリミット（60req/分）
- **一般公開プロジェクト** — ログイン不要で閲覧できる公開 URL 発行、公開プロジェクト専用の軽量 REST API
- **プロジェクト ZIP アーカイブ** — 添付画像ファイルを含めたプロジェクト全体の完全な ZIP ダウンロードおよびリストア（復元）。親子階層（WBS）関係やサマリー色設定も完全に保持・復元
- **スナップショット** — プロジェクトの状態を任意のタイミングで保存・復元（親子階層構造を含む）
- **Google Apps Script (GAS) 連携** — Google スプレッドシート等からのプロジェクトデータ同期

---

## 📁 プロジェクト構成

本リポジトリは `pnpm workspaces` によるモノレポ構成を採用しています。

```
moguchart-app/
├── packages/
│   ├── frontend/         # Vue 3 + Vuetify 4 + Pinia + Vite フロントエンド
│   └── functions/        # Firebase Functions (Node.js 24) + Prisma + MariaDB バックエンド
├── docs/                 # 操作マニュアル、リリースノート、OpenAPI仕様、GAS連携
├── terraform/            # GCP / Firebase インフラストラクチャ (IaC)
└── scripts/              # バージョン同期スクリプト等
```

### パッケージ詳細

* **`packages/frontend`**:
  - **フレームワーク**: Vue 3 (Composition API / `<script setup>`) + Vuetify 4 + Pinia + Vite 8
  - **コアコンポーネント**: `@mogura/moguchart-core` (Lit 製 Web Component)
  - **主要機能**: ガントチャート UI、WBS 階層ツリー・サマリータスク、リアルタイムコラボレーション、画像アップロード・プレビュー、APIキー管理、モックモード起動対応
* **`packages/functions`**:
  - **ランタイム**: Firebase Functions v2 (Node.js 24) + Express 5
  - **ORM / DB**: Prisma 7 + MariaDB
  - **主要機能**: REST API、Firebase Auth 認証・認可、APIキー検証・レートリミット、画像付き ZIP アーカイブ処理、匿名データ自動クリーンアップ

---

## 🛠 開発セットアップ

### 前提条件

* **Node.js**: `v24` 推奨（プロジェクトルートの `.node-version` 参照）
* **パッケージマネージャー**: `pnpm@11`（`pnpm@11.21.0` 以上）
* **Firebase CLI**: `firebase-tools`（最新版）
* **Google Cloud SDK (`gcloud`)**: Secret Manager からの環境変数取得や認証に必要
* **MariaDB**: ローカル開発または Functions 実行時に必要

### 1. 依存関係のインストール

プロジェクトルートで以下を実行します。

```bash
pnpm install
```

### 2. 環境変数の設定

本プロジェクトでは、Google Secret Manager から環境変数（`.env` ファイル）を一括取得するスクリプトが用意されています。

```bash
# GCP_PROJECT_ID に対象の Firebase / GCP プロジェクトIDを指定して実行
GCP_PROJECT_ID="your-firebase-project-id" pnpm run setup:env
```

※ 手動で設定する場合は、`packages/frontend/.env.example` および `packages/functions/.env.example` を参考に、それぞれのディレクトリに `.env` ファイルを作成してください。

### 3. データベースのセットアップ (Prisma)

`packages/functions` で使用する Prisma クライアントの生成およびマイグレーションを実行します。

```bash
# Prisma クライアントの生成
pnpm --filter functions run prisma:generate

# ローカルデータベースへのマイグレーション適用（ローカル開発時）
pnpm --filter functions run migrate:local

# シードデータの投入（任意）
pnpm --filter functions run seed:local
```

### 4. ローカル開発サーバーの起動

#### 全て一括で起動する場合 (フロントエンド + Firebase Emulator)

```bash
pnpm run dev
```

#### 個別に起動する場合

* **フロントエンドのみ（モックモード）**:
  Firebase バックエンドを起動せず、フロントエンド単体ですぐに動作確認できます。
  ```bash
  pnpm --filter frontend run dev
  ```
* **Firebase エミュレータのみ**:
  ```bash
  pnpm run serve:functions
  ```

---

## 📜 主な npm スクリプト

プロジェクトルートから実行可能な主なコマンドです。

| コマンド | 説明 |
| :--- | :--- |
| `pnpm run dev` | フロントエンドと Functions エミュレータを並列起動 |
| `pnpm run build` | 全パッケージ（フロントエンド、Functions）を一括ビルド |
| `pnpm run setup:env` | Secret Manager から各パッケージの `.env` を取得・生成 |
| `pnpm run serve:functions` | Firebase Functions エミュレータを起動 |
| `pnpm run deploy:all` | フロントエンドと Functions の両方を本番環境へデプロイ |
| `pnpm run deploy:functions` | Functions のみをデプロイ |
| `pnpm run deploy:frontend` | フロントエンド（Firebase Hosting）のみをデプロイ |
| `pnpm run refresh:packages` | `node_modules` とロックファイルをクリアして再インストールし、Prisma を再生成 |
| `pnpm run sync-version` | ルートの `package.json` のバージョンを各サブパッケージに同期 |
| `pnpm run gas:push` | Google Apps Script のコードを Clasp 経由でリモートへプッシュ |
| `pnpm run gas:pull` | Google Apps Script のコードをリモートからプル |

---

## ☁️ インフラ管理 (Terraform)

GCP および Firebase リソース（Firestore、Cloud Storage、Secret Manager 等）は `terraform/` ディレクトリでコード化されています。
詳細は [terraform/README.md](terraform/README.md) を参照してください。

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```

---

## 📄 ライセンス

本プロジェクトは [MIT License](LICENSE) の元で公開されています。
