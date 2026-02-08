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
  SelectProjects,
  SelectUser,
  UpdateGanttRowOrder,
  UpsertGanttRow,
  UpsertGanttTask,
  UpsertProject,
  UpsertUser,
  DuplicateProject,
  User,
} from '@functions/types/shared'
import { httpsCallable } from 'firebase/functions'

const callFunction = async <T>(name: FunctionName, param = {}) => {
  const callable = httpsCallable<FunctionParam, FunctionResult>(functions, 'gantt-functions')

  try {
    const result = await callable({ name, param })

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

export const upsertGanttTask: UpsertGanttTask = (param) => {
  return callFunction<number>('upsertGanttTask', param)
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

export const deleteGanttTask: DeleteGanttTask = (id) => {
  return callFunction<void>('deleteGanttTask', id)
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

export const upsertUser: UpsertUser = (user) => {
  return callFunction<void>('upsertUser', user)
}
