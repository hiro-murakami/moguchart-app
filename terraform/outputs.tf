output "project_id" {
  description = "GCP / Firebase プロジェクト ID"
  value       = var.project_id
}

output "firebase_web_app_id" {
  description = "登録された Firebase Web アプリのアプリ ID"
  value       = google_firebase_web_app.default.app_id
}

output "firestore_database_name" {
  description = "Firestore データベース名"
  value       = google_firestore_database.default.name
}

output "storage_bucket_name" {
  description = "Firebase Storage バケット名"
  value       = google_firebase_storage_bucket.default.bucket_id
}
