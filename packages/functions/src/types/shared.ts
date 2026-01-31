// フロントエンドと共有する型定義
// 注意: ここにはバックエンド固有のライブラリ(firebase-admin等)をimportしないでください。

export interface FunctionParam {
  name: string
  param: Object
}

export interface FunctionResult {
  status: 'succeeded' | 'failed'
  message?: string
  data?: any
}

export type FunctionName =
  | 'selectProjects'
  | 'selectGanttChart'
  | 'upsertGanttTask'
  | 'upsertGanttRow'
  | 'deleteGanttRow'
  | 'deleteGanttTask'
  | 'updateGanttRowOrder'

export type Role = 'owner' | 'editor' | 'viewer'

export interface Project {
  id: string
  name: string
  start: string
  end: string
  attribute: Object
}

export interface GanttRow {
  id: number
  projectId: string
  name: string
  order: number
  tasks: GanttTask[]
}

export interface GanttTask {
  id: number
  rowId: number
  name: string
  start: string
  end: string
}

export type GanttRowOrder = {
  id: number
  order: number
}

export type SelectProjects = () => Promise<Project[]>
export type SelectGanttChart = (projectId: string) => Promise<GanttRow[]>
export type UpsertGanttTask = (
  task: GanttTask,
  email?: string,
) => Promise<number>
export type UpsertGanttRow = (row: GanttRow, email?: string) => Promise<number>
export type DeleteGanttRow = (id: number, email?: string) => Promise<void>
export type DeleteGanttTask = (id: number, email?: string) => Promise<void>
export type UpdateGanttRowOrder = (
  rowOrders: GanttRowOrder[],
  email?: string,
) => Promise<void>

// --- フロントエンドとバックエンドで実装を共有しない型 ---
