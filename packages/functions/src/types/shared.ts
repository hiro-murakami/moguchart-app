// フロントエンドと共有する型定義
// 注意: ここにはバックエンド固有のライブラリ(firebase-admin等)をimportしないでください。

/** バージョン */
export const VERSION = '0.2.1'

/** Cloud Functions の呼び出しパラメータ */
export interface FunctionParam {
  /** 呼び出す関数名 */
  name: string
  /** 関数に渡すパラメータ */
  param: Object
}

/** Cloud Functions の呼び出し結果 */
export interface FunctionResult {
  /** 処理結果のステータス */
  status: 'succeeded' | 'failed'
  /** エラーメッセージなどの補足情報 */
  message?: string
  /** レスポンスデータ */
  data?: any
  /** サーバーのバージョン */
  version?: string
}

/** 利用可能な Cloud Functions の関数名一覧 */
export type FunctionName =
  | 'selectProjects'
  | 'selectGanttChart'
  | 'selectGanttRows'
  | 'upsertGanttTasks'
  | 'upsertGanttRow'
  | 'deleteProject'
  | 'deleteGanttRow'
  | 'deleteGanttTask'
  | 'updateGanttRowOrder'
  | 'upsertProject'
  | 'duplicateProject'
  | 'selectUser'
  | 'upsertUser'
  | 'getGanttDataJson'
  | 'restoreProject'

/** ユーザーの権限ロール */
export type Role = 'owner' | 'editor' | 'viewer'

/** 線の種類 */
export type BorderType = 'solid_thin' | 'solid_thick' | 'dashed_thin' | 'dashed_thick' | 'dotted_thin' | 'dotted_thick'

/** タスクバーの配色パレット */
export type ColorPalette = {
  /** テキスト色 */
  color: string
  /** 背景色 */
  backgroundColor: string
  /** 背景パターン（ストライプ等） */
  pattern?: {
    /** パターンの種類 */
    type: string
    /** パターンの色 */
    color: string
  }
  /** 枠線の種類 */
  borderType?: BorderType
  /** 枠線の色 */
  borderColor?: string
}

export type Label = {
  /** ラベル名 */
  name: string
  /** カラーコード */
  color: string
}

export type ProjectSettings = {
  /** ズームレベル（1日あたりのpx数） */
  pxPerDay?: number
  /** 選択されたラベル（フィルタリング用） */
  selectedLabels?: string[]
  /** 非表示行を表示するかどうか */
  showHiddenRows?: boolean
  /** 行ヘッダーの幅 */
  rowHeaderWidth?: number
}

/** ユーザー固有の設定属性 */
export type UserAttribute = {
  /** UIテーマ設定（light / dark / system） */
  theme?: 'light' | 'dark' | 'system'
  /** プロジェクトごとの設定 */
  projectSettings?: Record<string, ProjectSettings>
  /** 最終ログイン日時（ISO 8601形式） */
  lastLoginAt?: string
}

export type NewTaskTemplate = {
  /** タスク名 */
  name: string
  /** タスク期間（日数） */
  duration: number
  /** タスクの追加属性 */
  attribute: TaskAttribute
}

/** プロジェクトの追加属性 */
export type ProjectAttribute = {
  /** プロジェクトの説明 */
  description?: string
  /** プロジェクトで使用可能なカラーパレット一覧 */
  colorPalettes?: ColorPalette[]
  /** プロジェクトで使用可能なラベル一覧 */
  labels?: Label[]
  /** 新規タスクテンプレート一覧 */
  newTaskTemplates?: NewTaskTemplate[]
}

/** 行（グループ）の追加属性 */
export type RowAttribute = {
  /** 行の説明 */
  description?: string
}

/** タスクの追加属性 */
export type TaskAttribute = {
  /** タスクの説明 */
  description?: string
  /** タスクバーに適用するカラーパレット */
  colorPalette?: ColorPalette
  /** タスクに適用するラベル */
  labels?: Label[]
}

/** フロントエンドの編集用：行データ */
export interface EditingRowData {
  id: number
  name: string
  description?: string
}

/** フロントエンドの編集用：タスクデータ */
export interface EditingTaskData {
  id: string
  rowId: string
  name: string
  start: string
  end: string
  description?: string
  colorPalette?: ColorPalette
  labels?: Label[]
}

/** 簡易的な行情報（ドロップダウン選択用など） */
export interface SimpleRowData {
  id: string | number
  name: string
}

/** プロジェクトのアクセス権限管理 */
export type Authority = {
  /** オーナー権限を持つユーザーのメールアドレス一覧 */
  owners?: string[]
  /** 編集権限を持つユーザーのメールアドレス一覧 */
  editors?: string[]
  /** 閲覧権限を持つユーザーのメールアドレス一覧 */
  viewers?: string[]
}

/** ユーザー情報 */
export interface User {
  /** メールアドレス（一意識別子） */
  email: string
  /** 表示名 */
  displayName?: string
  /** ユーザー固有の設定 */
  attribute: UserAttribute
}

/** プロジェクト情報 */
export interface Project {
  /** プロジェクトID */
  id: string
  /** プロジェクト名 */
  name: string
  /** プロジェクト開始日（YYYY-MM-DD形式） */
  start: string
  /** プロジェクト終了日（YYYY-MM-DD形式） */
  end: string
  /** プロジェクトの追加属性 */
  attribute: ProjectAttribute
  /** 公開フラグ */
  public: boolean
  /** アクセス権限 */
  authority: Authority
  /** 現在のユーザーのロール */
  role: Role
  /** 複製元プロジェクトのID */
  originalId?: string
}

/** ガントチャートの行（タスクグループ） */
export interface GanttRow {
  /** 行ID */
  id: number
  /** 所属プロジェクトID */
  projectId: string
  /** 行名 */
  name: string
  /** 表示順序 */
  order: number
  /** 表示/非表示フラグ */
  visible: boolean
  /** 行の追加属性 */
  attribute: RowAttribute
  /** 行に含まれるタスク一覧 */
  tasks: GanttTask[]
}

/** ガントチャートのタスク */
export interface GanttTask {
  /** タスクID */
  id: number
  /** 所属する行のID */
  rowId: number
  /** タスク名 */
  name: string
  /** タスク開始日（YYYY-MM-DD形式） */
  start: string
  /** タスク終了日（YYYY-MM-DD形式） */
  end: string
  /** タスクの追加属性 */
  attribute: TaskAttribute
}

/** ガントチャートの行並び順 */
export type GanttRowOrder = {
  /** 行ID */
  id: number
  /** 表示順序 */
  order: number
}

/** プロジェクト一覧を取得する関数の型 */
export type SelectProjects = (_?: any, email?: string) => Promise<Project[]>
/** ガントチャートデータ（行・タスク）を取得する関数の型 */
export type SelectGanttChart = (projectId: string) => Promise<GanttRow[]>
/** 指定した行ID一覧でガントチャートの行データ（タスク含む）を取得する関数の型 */
export type SelectGanttRows = (params: { projectId: string; rowIds: number[] }) => Promise<GanttRow[]>
/** タスクを作成または更新する関数の型（作成時はタスクIDを返す） */
export type UpsertGanttTasks = (tasks: GanttTask[], email?: string) => Promise<number[]>
/** 行を作成または更新する関数の型（作成時は行IDを返す） */
export type UpsertGanttRow = (row: GanttRow | GanttRow[], email?: string) => Promise<number | number[]>
/** プロジェクトを削除する関数の型 */
export type DeleteProject = (id: string, email?: string) => Promise<void>
/** 行を一括削除する関数の型 */
export type DeleteGanttRow = (ids: number[], email?: string) => Promise<void>
/** タスクを一括削除する関数の型 */
export type DeleteGanttTask = (ids: number[], email?: string) => Promise<void>
/** 行の並び順を更新する関数の型 */
export type UpdateGanttRowOrder = (rowOrders: GanttRowOrder[], email?: string) => Promise<void>
/** プロジェクトを作成または更新する関数の型（プロジェクトIDを返す） */
export type UpsertProject = (project: Project, email?: string) => Promise<string>

/** プロジェクトを複製する関数の型（新しいプロジェクトIDを返す） */
export type DuplicateProject = (
  args: {
    /** 複製元プロジェクトID */
    originalProjectId: string
    /** 新しいプロジェクトのデータ */
    newProjectData: Project
  },
  email?: string,
) => Promise<string>

/** ユーザー情報を取得する関数の型 */
export type SelectUser = (email: string) => Promise<User | null>
/** ユーザー情報を作成または更新する関数の型 */
export type UpsertUser = (user: User, email?: string) => Promise<void>

/** JSONとして出力・入力するガントチャートデータの型 */
export interface GanttDataJson {
  /** バージョン情報 */
  version: string
  /** プロジェクトデータ */
  project: any
  /** 行とタスクのデータ */
  rows: any[]
}

/** プロジェクトとガントチャートデータを取得する関数の型 */
export type GetGanttDataJson = (projectId: string, email?: string) => Promise<GanttDataJson>

/** プロジェクトとガントチャートデータを復元する関数の型 */
export type RestoreProject = (data: GanttDataJson & { force?: boolean }, email?: string) => Promise<string>

// --- フロントエンドとバックエンドで実装を共有しない型 ---

// --- リアルタイムコラボレーション用型定義 ---

/** 編集イベントの種類 */
export type EditEventType = 'task_upsert' | 'task_delete' | 'row_upsert' | 'row_delete' | 'row_reorder' | 'full_reload'

/** プレゼンス情報（現在プロジェクトを開いているユーザー） */
export interface PresenceData {
  /** 表示名 */
  displayName: string
  /** 最終アクティブ日時（ISO 8601形式） */
  lastActiveAt: string
  /** アバター表示色 */
  color: string
  /** アバター画像URL（Google認証のプロフィール画像等） */
  avatarUrl?: string
  /** 現在編集中のタスクID一覧（ダイアログ表示中やドラッグ中のタスク） */
  editingTaskIds?: string[]
}

/** 編集イベント（Firestore経由でリアルタイム同期） */
export interface EditEvent {
  /** イベント種別 */
  type: EditEventType
  /** 操作を行ったユーザーのメールアドレス */
  userEmail: string
  /** イベント発生日時（ISO 8601形式） */
  timestamp: string
  /** 操作の詳細データ */
  payload?: Record<string, any>
}
