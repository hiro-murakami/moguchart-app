variable "project_id" {
  description = "Google Cloud / Firebase のプロジェクト ID"
  type        = string
}

variable "region" {
  description = "GCP リソースのデフォルトリージョン"
  type        = string
  default     = "asia-northeast1"
}

variable "location_id" {
  description = "Firestore や Storage などマルチリージョン/単一リージョンのロケーション ID"
  type        = string
  default     = "asia-northeast1"
}

variable "environment" {
  description = "対象環境 (dev, stg, prod など)"
  type        = string
  default     = "prod"
}
