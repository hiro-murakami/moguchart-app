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
  | 'updateGanttRowOrder'

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
  order: number
  tasks: GanttTask[]
}

export type GanttRowOrder = {
  id: number
  order: number
}

export type SelectGanttChart = () => Promise<GanttRow[]>
export type UpsertGanttTask = (param: GanttTask) => Promise<number>
export type UpsertGanttRow = (row: GanttRow) => Promise<number>
export type DeleteGanttRow = (id: number) => Promise<void>
export type DeleteGanttTask = (id: number) => Promise<void>
export type UpdateGanttRowOrder = (rows: GanttRowOrder[]) => Promise<void>

// --- フロントエンドとバックエンドで実装を共有しない型 ---
