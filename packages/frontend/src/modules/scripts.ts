import { functions } from '@/firebase'
import type {
  DeleteGanttRow,
  DeleteGanttTask,
  DeleteProject,
  FunctionName,
  FunctionParam,
  FunctionResult,
  GanttRow,
  Project,
  SelectGanttChart,
  SelectGanttRows,
  SelectProjects,
  SelectUser,
  SelectUsers,
  UpdateGanttRowOrder,
  UpsertGanttRow,
  UpsertGanttTasks,
  UpsertProject,
  UpsertUser,
  DuplicateProject,
  User,
  GetGanttDataJson,
  RestoreProject,
  CreateSnapshot,
  LoadSnapshot,
  GanttDataJson,
  TaskComment,
  SelectTaskComments,
  UpsertTaskComment,
  DeleteTaskComment,
  ListSnapshots,
  SnapshotInfo,
} from '@functions/types/shared'
import { VERSION } from '@functions/types/shared'
import { httpsCallable } from 'firebase/functions'

const callFunction = async <T>(name: FunctionName, param = {}) => {
  const callable = httpsCallable<FunctionParam, FunctionResult>(functions, 'gantt-functions')

  try {
    const result = await callable({ name, param })

    if (result.data.version && result.data.version !== VERSION) {
      window.alert('バージョンが一致しません。画面をリロードしてください')
      // バージョン不一致の場合は後続の処理を行わずにエラーを投げる
      throw new Error('バージョンが一致しません。画面をリロードしてください。')
    }

    if (result.data.status === 'failed') {
      throw new Error(result.data.message)
    }

    return result.data.data as T
  } catch (error: any) {
    console.error(`[FirebaseFunctions] Error calling ${name}:`, {
      code: error.code,
      message: error.message,
      details: error.details,
    })
    throw error
  }
}

export const selectProjects: SelectProjects = () => {
  return callFunction<Project[]>('selectProjects')
}

export const selectGanttChart: SelectGanttChart = (projectId) => {
  return callFunction<GanttRow[]>('selectGanttChart', projectId)
}

export const selectGanttRows: SelectGanttRows = (params) => {
  return callFunction<GanttRow[]>('selectGanttRows', params)
}

export const upsertGanttTasks: UpsertGanttTasks = (param) => {
  return callFunction<number[]>('upsertGanttTasks', param)
}

export const upsertGanttRow: UpsertGanttRow = (param) => {
  return callFunction<number | number[]>('upsertGanttRow', param)
}

export const deleteProject: DeleteProject = (id) => {
  return callFunction<void>('deleteProject', id)
}

export const deleteGanttRow: DeleteGanttRow = (ids) => {
  return callFunction<void>('deleteGanttRow', ids)
}

export const deleteGanttTask: DeleteGanttTask = (ids) => {
  return callFunction<void>('deleteGanttTask', ids)
}

export const updateGanttRowOrder: UpdateGanttRowOrder = (param) => {
  return callFunction<void>('updateGanttRowOrder', param)
}

export const upsertProject: UpsertProject = (param) => {
  return callFunction<string>('upsertProject', param)
}

export const duplicateProject: DuplicateProject = (param) => {
  return callFunction<string>('duplicateProject', param)
}

export const selectUser: SelectUser = (email) => {
  return callFunction<User | null>('selectUser', email)
}

export const selectUsers: SelectUsers = () => {
  return callFunction<User[]>('selectUsers')
}

export const upsertUser: UpsertUser = (user) => {
  return callFunction<void>('upsertUser', user)
}

export const getGanttDataJson: GetGanttDataJson = (projectId) => {
  return callFunction<GanttDataJson>('getGanttDataJson', projectId)
}

export const restoreProject: RestoreProject = (data) => {
  return callFunction<string>('restoreProject', data)
}

export const createSnapshot: CreateSnapshot = (params) => {
  return callFunction<string>('createSnapshot', params)
}

export const loadSnapshot: LoadSnapshot = (params) => {
  return callFunction<GanttDataJson>('loadSnapshot', params)
}

export const selectTaskComments: SelectTaskComments = (taskId) => {
  return callFunction<TaskComment[]>('selectTaskComments', taskId)
}

export const upsertTaskComment: UpsertTaskComment = (comment) => {
  return callFunction<number>('upsertTaskComment', comment)
}

export const deleteTaskComment: DeleteTaskComment = (id) => {
  return callFunction<void>('deleteTaskComment', id)
}

export const listSnapshots: ListSnapshots = (projectId) => {
  return callFunction<SnapshotInfo[]>('listSnapshots', projectId)
}
