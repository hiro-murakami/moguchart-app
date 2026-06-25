import type { Project, GanttRow } from '@functions/types/shared'

/**
 * 公開プロジェクト用APIのベースURL。
 * Firebase Hosting の rewrite により `/api/**` は Cloud Functions に転送されるため、
 * 同一オリジンの相対パスで呼び出せる。
 * 開発時（Vite devサーバー）はプロキシ設定またはエミュレータ経由で接続する。
 */
const getBaseUrl = (): string => {
  if (import.meta.env.VITE_APP_MODE === 'mock') {
    // エミュレータ使用時は Cloud Functions のエミュレータを直接指す
    const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID
    return `http://localhost:5001/${projectId}/asia-northeast1/api`
  }
  // 本番 / Hosting プレビュー: 同一ドメインなので相対パスでOK
  return ''
}

interface ApiResponse<T> {
  status: 'succeeded' | 'failed'
  data?: T
  message?: string
}

/**
 * 公開プロジェクトのプロジェクト情報を取得する（認証不要）
 */
export const fetchPublicProject = async (projectId: string): Promise<Project | null> => {
  try {
    const res = await fetch(`${getBaseUrl()}/api/v1/public/projects/${projectId}`)
    if (!res.ok) {
      return null
    }
    const json: ApiResponse<Project> = await res.json()
    if (json.status === 'succeeded' && json.data) {
      return json.data
    }
    return null
  } catch (error) {
    console.error('[PublicAPI] Failed to fetch public project:', error)
    return null
  }
}

/**
 * 公開プロジェクトのガントチャートデータを取得する（認証不要）
 */
export const fetchPublicGanttChart = async (projectId: string): Promise<GanttRow[] | null> => {
  try {
    const res = await fetch(`${getBaseUrl()}/api/v1/public/projects/${projectId}/gantt`)
    if (!res.ok) {
      return null
    }
    const json: ApiResponse<GanttRow[]> = await res.json()
    if (json.status === 'succeeded' && json.data) {
      return json.data
    }
    return null
  } catch (error) {
    console.error('[PublicAPI] Failed to fetch public gantt chart:', error)
    return null
  }
}
