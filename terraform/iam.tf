# Cloud Functions 実行用の最小権限サービスアカウント定義

resource "google_service_account" "functions_runtime" {
  project      = var.project_id
  account_id   = "moguchart-functions-sa"
  display_name = "MoguChart Cloud Functions Runtime SA"
  description  = "Dedicated least-privilege runtime service account for MoguChart Cloud Functions v2"
}

# Cloud SQL クライアント接続権限
resource "google_project_iam_member" "functions_cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.functions_runtime.email}"
}

# Firestore 読み書き権限（ACL同期・レート制限用）
resource "google_project_iam_member" "functions_datastore_user" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.functions_runtime.email}"
}

# Firebase Auth トークン検証参照権限
resource "google_project_iam_member" "functions_firebaseauth_viewer" {
  project = var.project_id
  role    = "roles/firebaseauth.viewer"
  member  = "serviceAccount:${google_service_account.functions_runtime.email}"
}

# Cloud Logging 出力権限
resource "google_project_iam_member" "functions_log_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.functions_runtime.email}"
}

# Secret Manager: Functions 用シークレットのみ参照許可（フロントエンド用シークレット等と分離）
resource "google_secret_manager_secret_iam_member" "functions_env_accessor" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.functions_env.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.functions_runtime.email}"
}

# Storage バケット単位のオブジェクト操作権限（プロジェクト全体ではなく対象バケットに限定）
resource "google_storage_bucket_iam_member" "functions_storage_object_user" {
  bucket = google_firebase_storage_bucket.default.bucket_id
  role   = "roles/storage.objectUser"
  member = "serviceAccount:${google_service_account.functions_runtime.email}"
}
