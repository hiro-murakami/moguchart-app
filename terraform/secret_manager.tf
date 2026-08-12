# Secret Manager 関連のリソース定義

# フロントエンド用環境変数 (.env)
resource "google_secret_manager_secret" "frontend_env" {
  project   = var.project_id
  secret_id = "frontend-env"

  replication {
    auto {}
  }

  depends_on = [
    google_project_service.required_services["secretmanager.googleapis.com"]
  ]
}

# Functions 用環境変数 (.env)
resource "google_secret_manager_secret" "functions_env" {
  project   = var.project_id
  secret_id = "functions-env"

  replication {
    auto {}
  }

  depends_on = [
    google_project_service.required_services["secretmanager.googleapis.com"]
  ]
}
