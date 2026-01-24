// フロントエンドと共有する型定義
// 注意: ここにはバックエンド固有のライブラリ(firebase-admin等)をimportしないでください。

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

export type FunctionName = 'selectGanttChart' | 'upsertGanttTask'

export interface GanttTask {
  id: number
  rowId: number
  name: string
  start: string
  end: string
}

export interface GanttRow {
  id: number
  label: string
  tasks: GanttTask[]
}

export type SelectGanttChart = () => Promise<GanttRow[]>
export type UpsertGanttTask = (param: GanttTask) => Promise<void>
