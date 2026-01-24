import {
  GanttTask as PrismaGanttTask,
  GanttRow as PrismaGanttRow,
} from '@prisma/client'
import type { GanttRow, GanttTask } from '../../types/shared'
import { toDateString } from './commonFunctions'
import { omit } from 'lodash'

type CommonColumns = 'createdBy' | 'createdAt' | 'updatedBy' | 'updatedAt'

export const toGanttTask = (task: PrismaGanttTask): GanttTask => {
  return {
    ...omit(task, ['createdBy', 'createdAt', 'updatedBy', 'updatedAt']),
    start: toDateString(task.start),
    end: toDateString(task.end),
  }
}

export const fromGanttTask = (
  task: GanttTask,
): Omit<PrismaGanttTask, CommonColumns> => {
  return {
    ...task,
    start: new Date(task.start),
    end: new Date(task.end),
  }
}

export const toGanttRow = (
  row: PrismaGanttRow & { tasks: PrismaGanttTask[] },
): GanttRow => {
  return {
    ...omit(row, ['createdBy', 'createdAt', 'updatedBy', 'updatedAt']),
    tasks: row.tasks.map(toGanttTask),
  }
}

export const fromGanttRow = (
  row: GanttRow,
): Omit<PrismaGanttRow, CommonColumns> => {
  return {
    // tasksはリレーションデータなので、Rowテーブルの更新データからは除外する
    ...omit(row, 'tasks'),
  }
}
