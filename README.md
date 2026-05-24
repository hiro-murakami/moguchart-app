# MoguChart App

ガントチャートツール「[MoguChart](https://moguchart.jp)」のアプリケーションリポジトリです。
本プロジェクトは、フロントエンドとバックエンド（Firebase Functions）を管理するモノレポ構成となっています。

## 📁 プロジェクト構成

本リポジトリは `pnpm workspaces` を使用して以下のパッケージを管理しています。

* **`packages/frontend`**: Vue 3 + Vuetify 3 + Pinia + Vite で構築されたフロントエンドアプリケーション。
* **`packages/functions`**: Firebase Functions で動作する API バックエンド。Prisma を用いてデータベース（MariaDB）と接続します。

---

## 🛠 開発セットアップ

### 前提条件

* Node.js (v24 推奨、`.node-version` 参照)
* pnpm (パッケージマネージャー)
* Firebase CLI
* Google Cloud SDK (Secret Manager から環境変数を取得する場合に必要)

### 1. 依存関係のインストール

プロジェクトのルートディレクトリで以下を実行します。

```bash
pnpm install
```

### 2. 環境変数の設定

本プロジェクトでは、各パッケージに必要な環境変数（`.env` ファイル）を Google Secret Manager から取得するスクリプトを用意しています。

以下のコマンドを実行して、ローカルに `.env` ファイルを生成してください。

```bash
# GCP_PROJECT_ID に対象の Firebase/GCP プロジェクトIDを指定します
GCP_PROJECT_ID="your-firebase-project-id" pnpm run setup:env
```

※ もしくは、`packages/frontend` および `packages/functions` 内にある `.env.example` ファイルを参考に、手動でそれぞれのディレクトリに `.env` ファイルを作成することも可能です。

### 3. ローカル開発サーバーの起動

#### 全て一括で起動する場合 (フロントエンド + Firebase Emulator)

```bash
pnpm run dev
```

#### 個別に起動する場合

* **フロントエンドのみ（モックモード）**:
  ```bash
  pnpm --filter frontend run dev
  ```
* **Firebase エミュレータのみ**:
  ```bash
  pnpm run serve:functions
  ```

---

## 🚀 デプロイ

本番環境へのデプロイは以下のコマンドで行います（事前に `firebase login` 等での認証が必要です）。

```bash
# フロントエンドと Functions の両方をデプロイ
pnpm run deploy:all

# Functions のみデプロイ
pnpm run deploy:functions

# フロントエンド（Hosting）のみデプロイ
pnpm run deploy:frontend
```

---

## 📄 ライセンス

本プロジェクトは [MIT License](LICENSE) の元で公開されています。
