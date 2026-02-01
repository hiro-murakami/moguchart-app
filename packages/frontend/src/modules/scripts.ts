import { functions } from '@/firebase'
import type {
  DeleteGanttRow,
  DeleteGanttTask,
  FunctionName,
  FunctionParam,
  FunctionResult,
  GanttRow,
  Project,
  SelectGanttChart,
  SelectProjects,
  UpdateGanttRowOrder,
  UpsertGanttRow,
  UpsertGanttTask,
  UpsertProject,
} from '@functions/types/shared'
import { httpsCallable } from 'firebase/functions'

const callFunction = async <T>(name: FunctionName, param = {}) => {
  const callable = httpsCallable<FunctionParam, FunctionResult>(
    functions,
    'gantt-functions',
  )

  try {
    const result = await callable({ name, param })

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
  return callFunction<number>('upsertGanttRow', param)
}

export const deleteGanttRow: DeleteGanttRow = (id) => {
  return callFunction<void>('deleteGanttRow', id)
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
