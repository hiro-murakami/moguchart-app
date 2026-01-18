// フロントエンドと共有する型定義
// 注意: ここにはバックエンド固有のライブラリ(firebase-admin等)をimportしないでください。

export interface SharedUser {
  id: string
  email: string
  displayName?: string
  createdAt: string // JSONシリアライズ後の型(Dateではなくstring)にすることを推奨
}

export interface ApiResponse<T> {
  data: T
  status: 'success' | 'error'
}

export interface FunctionParam {
  name: string
  email: string
  param: Object
}

export interface FunctionResult {
  status: 'success' | 'failed'
  message?: string
  data?: any
}

export type FunctionName = 'selectGanttChart' | 'upsertGanttChart'

export interface Task {
  id: string
  name: string
  start: string
  end: string
}

export interface Row {
  id: string
  label: string
  tasks: Task[]
}

export interface GanttChart {
  id: number
  data: Row[]
}
