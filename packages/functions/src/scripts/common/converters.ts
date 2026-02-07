import { GanttRow as PrismaGanttRow, GanttTask as PrismaGanttTask, Project as PrismaProject } from '@prisma/client'
import { omit } from 'lodash'
import type { GanttRow, GanttTask, Project, Role, Authority, ProjectAttribute } from '../../types/shared'
import { toDateString, toDateTimeString } from './commonFunctions'

type CommonColumns = 'createdBy' | 'createdAt' | 'updatedBy' | 'updatedAt'

export const toGanttTask = (task: PrismaGanttTask): GanttTask => {
  return {
    ...omit(task, ['createdBy', 'createdAt', 'updatedBy', 'updatedAt']),
    start: toDateTimeString(task.start),
    end: toDateTimeString(task.end),
  }
}

export const fromGanttTask = (task: GanttTask): Omit<PrismaGanttTask, CommonColumns> => {
  return {
    ...task,
    start: new Date(task.start),
    end: new Date(task.end),
  }
}

export const toGanttRow = (row: PrismaGanttRow & { tasks: PrismaGanttTask[] }): GanttRow => {
  return {
    ...omit(row, ['createdBy', 'createdAt', 'updatedBy', 'updatedAt']),
    tasks: row.tasks.map(toGanttTask),
  }
}

export const fromGanttRow = (row: GanttRow): Omit<PrismaGanttRow, CommonColumns> => {
  return {
    // tasksはリレーションデータなので、Rowテーブルの更新データからは除外する
    ...omit(row, 'tasks'),
  }
}

export const toProject =
  (email: string) =>
  (project: PrismaProject): Project => {
    const getRole = (authority: Authority, email: string): Role => {
      if (authority.owners?.includes(email)) {
        return 'owner'
      } else if (authority.editors?.includes(email)) {
        return 'editor'
      }

      return 'viewer'
    }

    return {
      ...omit(project, ['createdBy', 'createdAt', 'updatedBy', 'updatedAt']),
      start: toDateString(project.start),
      end: toDateString(project.end),
      attribute: (project.attribute ?? {}) as ProjectAttribute,
      authority: (project.authority ?? {}) as Authority,
      role: getRole(project.authority as Authority, email),
    }
  }
