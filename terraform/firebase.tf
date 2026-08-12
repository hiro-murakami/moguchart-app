# GCP プロジェクトへの Firebase 有効化
resource "google_firebase_project" "default" {
  provider = google-beta
  project  = var.project_id

  depends_on = [
    google_project_service.required_services["firebase.googleapis.com"]
  ]
}

# Firebase Web アプリケーションの登録
resource "google_firebase_web_app" "default" {
  provider     = google-beta
  project      = var.project_id
  display_name = "moguchart-app-${var.environment}"

  depends_on = [
    google_firebase_project.default
  ]
}

# Firestore Database (FIRESTORE_NATIVE)
resource "google_firestore_database" "default" {
  provider                    = google-beta
  project                     = var.project_id
  name                        = "(default)"
  location_id                 = var.location_id
  type                        = "FIRESTORE_NATIVE"
  concurrency_mode            = "PESSIMISTIC"
  app_engine_integration_mode = "ENABLED"

  depends_on = [
    google_project_service.required_services["firestore.googleapis.com"]
  ]
}

# Firestore セキュリティルールの管理
resource "google_firebaserules_ruleset" "firestore" {
  provider = google-beta
  project  = var.project_id

  source {
    files {
      name    = "firestore.rules"
      content = file("${path.module}/../firestore.rules")
    }
  }

  depends_on = [
    google_project_service.required_services["firebaserules.googleapis.com"]
  ]
}

resource "google_firebaserules_release" "firestore" {
  provider     = google-beta
  project      = var.project_id
  name         = "cloud.firestore"
  ruleset_name = google_firebaserules_ruleset.firestore.name

  depends_on = [
    google_firestore_database.default
  ]
}

# Firebase Storage バケットの有効化・設定
resource "google_firebase_storage_bucket" "default" {
  provider  = google-beta
  project   = var.project_id
  bucket_id = "${var.project_id}.appspot.com"

  depends_on = [
    google_firebase_project.default,
    google_project_service.required_services["firebasestorage.googleapis.com"]
  ]
}

# Storage セキュリティルールの管理
resource "google_firebaserules_ruleset" "storage" {
  provider = google-beta
  project  = var.project_id

  source {
    files {
      name    = "storage.rules"
      content = file("${path.module}/../storage.rules")
    }
  }

  depends_on = [
    google_project_service.required_services["firebaserules.googleapis.com"]
  ]
}

resource "google_firebaserules_release" "storage" {
  provider     = google-beta
  project      = var.project_id
  name         = "firebase.storage/${google_firebase_storage_bucket.default.bucket_id}"
  ruleset_name = google_firebaserules_ruleset.storage.name
}
