import { auth } from '@/firebase'

/**
 * REST API（/api/v1/api-keys）との通信モジュール。
 * Firebase IDトークンを使って認証する。
 */

/** APIレスポンスの共通型 */
interface ApiResponse<T> {
  status: 'succeeded' | 'failed'
  data?: T
  message?: string
}

/** APIキーの型（一覧取得時はマスク済み） */
export interface ApiKeyItem {
  id: string
  key: string
  name: string
  scope: 'read' | 'read-write'
  active: boolean
  lastUsedAt: string | null
  createdAt: string
}

/** APIキー作成レスポンスの型（フルキーが含まれる） */
export interface ApiKeyCreated {
  id: string
  key: string
  name: string
  scope: 'read' | 'read-write'
  createdAt: string
}

/**
 * REST APIのベースURLを取得する。
 * publicApi.ts と同じルールに従う。
 */
const getBaseUrl = (): string => {
  if (import.meta.env.VITE_APP_MODE === 'mock') {
    const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID
    return `http://localhost:5001/${projectId}/asia-northeast1/api`
  }
  return ''
}

/**
 * Firebase IDトークンを取得する。
 */
const getIdToken = async (): Promise<string> => {
  const currentUser = auth.currentUser
  if (!currentUser) {
    throw new Error('ログインが必要です')
  }
  return currentUser.getIdToken()
}

/**
 * 認証付きfetchリクエストを送信する。
 */
const authenticatedFetch = async (
  path: string,
  options: RequestInit = {},
): Promise<Response> => {
  const token = await getIdToken()
  return fetch(`${getBaseUrl()}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })
}

/**
 * 自分のAPIキー一覧を取得する。
 */
export const fetchApiKeys = async (): Promise<ApiKeyItem[]> => {
  const res = await authenticatedFetch('/api/v1/api-keys')
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    throw new Error(json.message || 'APIキーの取得に失敗しました')
  }
  const json: ApiResponse<ApiKeyItem[]> = await res.json()
  if (json.status !== 'succeeded' || !json.data) {
    throw new Error(json.message || 'APIキーの取得に失敗しました')
  }
  return json.data
}

/**
 * 新しいAPIキーを作成する。
 * 作成直後のみフルキーが返される。
 */
export const createApiKey = async (
  name: string,
  scope: 'read' | 'read-write' = 'read-write',
): Promise<ApiKeyCreated> => {
  const res = await authenticatedFetch('/api/v1/api-keys', {
    method: 'POST',
    body: JSON.stringify({ name, scope }),
  })
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    throw new Error(json.message || 'APIキーの作成に失敗しました')
  }
  const json: ApiResponse<ApiKeyCreated> = await res.json()
  if (json.status !== 'succeeded' || !json.data) {
    throw new Error(json.message || 'APIキーの作成に失敗しました')
  }
  return json.data
}

/**
 * APIキーを無効化する（論理削除）。
 */
export const revokeApiKey = async (id: string): Promise<void> => {
  const res = await authenticatedFetch(`/api/v1/api-keys/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    throw new Error(json.message || 'APIキーの無効化に失敗しました')
  }
}
