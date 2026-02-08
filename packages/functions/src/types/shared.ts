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
  | 'deleteProject'
  | 'deleteGanttRow'
  | 'deleteGanttTask'
  | 'updateGanttRowOrder'
  | 'upsertProject'
  | 'duplicateProject'
  | 'selectUser'
  | 'upsertUser'

export type Role = 'owner' | 'editor' | 'viewer'

export type ColorPalette = {
  color: string
  backgroundColor: string
  pattern?: {
    type: string
    color: string
  }
}

export type UserAttribute = {
  theme?: 'light' | 'dark' | 'system'
}

export type ProjectAttribute = {
  description?: string
  colorPalettes?: ColorPalette[]
}

export type RowAttribute = {
  description?: string
}

export type TaskAttribute = {
  description?: string
  colorPalette?: ColorPalette
}

export type Authority = {
  owners?: string[]
  editors?: string[]
  viewers?: string[]
}

export interface User {
  email: string
  displayName?: string
  attribute: UserAttribute
}

export interface Project {
  id: string
  name: string
  start: string
  end: string
  attribute: ProjectAttribute
  public: boolean
  authority: Authority
  role: Role
  originalId?: string
}

export interface GanttRow {
  id: number
  projectId: string
  name: string
  order: number
  visible: boolean
  attribute: RowAttribute
  tasks: GanttTask[]
}

export interface GanttTask {
  id: number
  rowId: number
  name: string
  start: string
  end: string
  attribute: TaskAttribute
}

export type GanttRowOrder = {
  id: number
  order: number
}

export type SelectProjects = (_?: any, email?: string) => Promise<Project[]>
export type SelectGanttChart = (projectId: string) => Promise<GanttRow[]>
export type UpsertGanttTask = (task: GanttTask, email?: string) => Promise<number>
export type UpsertGanttRow = (row: GanttRow | GanttRow[], email?: string) => Promise<number | number[]>
export type DeleteProject = (id: string, email?: string) => Promise<void>
export type DeleteGanttRow = (ids: number[], email?: string) => Promise<void>
export type DeleteGanttTask = (id: number, email?: string) => Promise<void>
export type UpdateGanttRowOrder = (rowOrders: GanttRowOrder[], email?: string) => Promise<void>
export type UpsertProject = (project: Project, email?: string) => Promise<string>

export type DuplicateProject = (
  args: {
    originalProjectId: string
    newProjectData: Project
  },
  email?: string,
) => Promise<string>

export type SelectUser = (email: string) => Promise<User | null>
export type UpsertUser = (user: User, email?: string) => Promise<void>

// --- フロントエンドとバックエンドで実装を共有しない型 ---
