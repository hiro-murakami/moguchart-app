import {
  GanttRow as PrismaGanttRow,
  GanttTask as PrismaGanttTask,
  Project as PrismaProject,
} from '../../generated/prisma/client'
import { omit } from 'lodash'
import type {
  GanttRow,
  GanttTask,
  Project,
  Role,
  Authority,
  ProjectAttribute,
  TaskAttribute,
  RowAttribute,
} from '../../types/shared'
import { toDateTimeString } from './commonFunctions'

type CommonColumns = 'createdBy' | 'createdAt' | 'updatedBy' | 'updatedAt'

export const toGanttTask = (task: PrismaGanttTask, commentCount?: number): GanttTask => {
  return {
    ...omit(task, ['createdBy', 'createdAt', 'updatedBy', 'updatedAt']),
    start: toDateTimeString(task.start),
    end: toDateTimeString(task.end),
    attribute: (task.attribute ?? {}) as TaskAttribute,
    commentCount: commentCount ?? 0,
  }
}

export const fromGanttTask = (task: GanttTask): Omit<PrismaGanttTask, CommonColumns> => {
  return {
    ...omit(task, 'commentCount'),
    start: new Date(task.start),
    end: new Date(task.end),
  }
}

export const toGanttRow = (
  row: PrismaGanttRow & {
    tasks: (PrismaGanttTask & { _count?: { comments: number } })[]
    _count?: { comments: number }
  },
): GanttRow => {
  return {
    ...omit(row, ['createdBy', 'createdAt', 'updatedBy', 'updatedAt']),
    tasks: row.tasks.map((t) => toGanttTask(t, t._count?.comments)),
    attribute: (row.attribute ?? {}) as RowAttribute,
    commentCount: row._count?.comments ?? 0,
  }
}

export const fromGanttRow = (row: GanttRow): Omit<PrismaGanttRow, CommonColumns> => {
  return {
    // tasksはリレーションデータなので、Rowテーブルの更新データからは除外する
    ...omit(row, ['tasks', 'commentCount']),
  }
}

export const toProject =
  (userIdentifier: string, fallbackEmail?: string) =>
  (project: PrismaProject & { _count?: { comments: number } }): Project => {
    const getRole = (authority: Authority, id: string, email?: string): Role => {
      const matches = (list?: string[]) => {
        if (!list) return false
        return list.includes(id) || (!!email && list.includes(email))
      }

      if (matches(authority.owners)) {
        return 'owner'
      } else if (matches(authority.editors)) {
        return 'editor'
      }

      return 'viewer'
    }

    return {
      ...omit(project, ['createdBy', 'createdAt', 'updatedBy', 'updatedAt']),
      start: toDateTimeString(project.start),
      end: toDateTimeString(project.end),
      attribute: (project.attribute ?? {}) as ProjectAttribute,
      authority: (project.authority ?? {}) as Authority,
      role: getRole(project.authority as Authority, userIdentifier, fallbackEmail),
      commentCount: project._count?.comments ?? 0,
    }
  }

