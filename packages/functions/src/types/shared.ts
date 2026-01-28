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

export type FunctionName =
  | 'selectGanttChart'
  | 'upsertGanttTask'
  | 'upsertGanttRow'
  | 'deleteGanttRow'
  | 'deleteGanttTask'

export interface GanttTask {
  id: number
  rowId: number
  name: string
  start: string
  end: string
}

export interface GanttRow {
  id: number
  name: string
  tasks: GanttTask[]
}

export type SelectGanttChart = () => Promise<GanttRow[]>
export type UpsertGanttTask = (param: GanttTask) => Promise<number>
export type UpsertGanttRow = (param: GanttRow) => Promise<number>
export type DeleteGanttRow = (id: number) => Promise<number>
export type DeleteGanttTask = (id: number) => Promise<number>
