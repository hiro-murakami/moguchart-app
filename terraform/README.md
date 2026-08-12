# Terraform による GCP / Firebase リソース管理

`moguchart-app` の GCP および Firebase リソースを Terraform (IaC) で管理するための設定です。

## 📋 必須要件

- **Terraform CLI**: `v1.5.0` 以上
- **gcloud CLI**: インストール済みかつ `gcloud auth application-default login` で認証済みであること
- **適切な IAM 権限**: 対象 GCP プロジェクトの `Project Owner` または `Editor` + 各種設定権限

---

## 🚀 使い方

### 1. 初期設定

`terraform/` ディレクトリに移動し、変数を定義します。

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
```

`terraform.tfvars` を開き、自身の GCP / Firebase プロジェクト ID (`project_id`) を設定します。

```hcl
project_id  = "your-firebase-project-id"
region      = "asia-northeast1"
location_id = "asia-northeast1"
environment = "dev"
```

### 2. Provider と Backend の初期化

```bash
terraform init
```

### 3. 実行計画の確認

```bash
terraform plan
```

### 4. リソースの適用

```bash
terraform apply
```

---

## ⚠️ 既存の GCP / Firebase リソースのインポート (`terraform import`)

既に手動や Firebase CLI で作成済みのリソースが存在する場合、新規作成しようとするとエラーが発生します。
その場合は以下のコマンドで Terraform State に既存リソースを取り込んでください。

### 例 1: Firebase Project のインポート
```bash
terraform import google_firebase_project.default projects/YOUR_PROJECT_ID
```

### 例 2: Firebase Web App のインポート
```bash
# App ID は Firebase Console のプロジェクト設定で確認できます
terraform import google_firebase_web_app.default projects/YOUR_PROJECT_ID/webApps/YOUR_APP_ID
```

### 例 3: Firestore Database のインポート
```bash
terraform import google_firestore_database.default projects/YOUR_PROJECT_ID/databases/(default)
```

### 例 4: Secret Manager のインポート
```bash
terraform import google_secret_manager_secret.database_url projects/YOUR_PROJECT_ID/secrets/DATABASE_URL
```

---

## 💡 リモートバックエンド（GCS）への移行について

複数メンバーでの開発や CI/CD で運用する場合、`versions.tf` または `main.tf` に以下のような GCS バックエンド設定を追加することを推奨します。

```hcl
terraform {
  backend "gcs" {
    bucket = "your-terraform-state-bucket"
    prefix = "moguchart-app/state"
  }
}
```
