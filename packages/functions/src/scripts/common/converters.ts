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

export const toGanttTask = (
  task: PrismaGanttTask & {
    assignees?: Array<{ userId: string | null; email: string | null }>
  },
  commentCount?: number,
): GanttTask => {
  const attr = { ...((task.attribute ?? {}) as TaskAttribute) }
  if (task.assignees && task.assignees.length > 0) {
    const list = task.assignees
      .map((a) => a.userId || a.email)
      .filter((id): id is string => Boolean(id))
    attr.assignees = Array.from(new Set([...(attr.assignees || []), ...list]))
  }

  return {
    ...omit(task, ['createdBy', 'createdAt', 'updatedBy', 'updatedAt', 'assignees']),
    start: toDateTimeString(task.start),
    end: toDateTimeString(task.end),
    attribute: attr,
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
    tasks: (PrismaGanttTask & {
      _count?: { comments: number }
      assignees?: Array<{ userId: string | null; email: string | null }>
    })[]
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
  (
    project: PrismaProject & {
      _count?: { comments: number }
      members?: Array<{ role: string; userId: string | null; email: string | null }>
    },
  ): Project => {
    let role: Role = 'viewer'

    if (project.members && project.members.length > 0) {
      // 1. members から判定
      const myMember = project.members.find(
        (m) =>
          (!!userIdentifier && (m.userId === userIdentifier || m.email === userIdentifier)) ||
          (!!fallbackEmail && (m.email === fallbackEmail || m.userId === fallbackEmail)),
      )
      if (myMember) {
        if (myMember.role === 'owner') role = 'owner'
        else if (myMember.role === 'editor') role = 'editor'
        else role = 'viewer'
      }
    } else {
      // 2. 既存 authority (JSON) から判定
      const authority = (project.authority as Authority) || {}
      const matches = (list?: string[]) => {
        if (!list) return false
        return list.includes(userIdentifier) || (!!fallbackEmail && list.includes(fallbackEmail))
      }
      if (matches(authority.owners)) {
        role = 'owner'
      } else if (matches(authority.editors)) {
        role = 'editor'
      } else {
        role = 'viewer'
      }
    }

    // authority オブジェクトも members があれば合成・補完
    let authority = (project.authority ?? {}) as Authority
    if (project.members && project.members.length > 0) {
      const owners: string[] = []
      const editors: string[] = []
      const viewers: string[] = []
      for (const m of project.members) {
        const id = m.userId || m.email
        if (!id) continue
        if (m.role === 'owner') owners.push(id)
        else if (m.role === 'editor') editors.push(id)
        else if (m.role === 'viewer') viewers.push(id)
      }
      authority = {
        owners: Array.from(new Set([...(authority.owners || []), ...owners])),
        editors: Array.from(new Set([...(authority.editors || []), ...editors])),
        viewers: Array.from(new Set([...(authority.viewers || []), ...viewers])),
      }
    }

    return {
      ...omit(project, ['createdBy', 'createdAt', 'updatedBy', 'updatedAt', 'members']),
      start: toDateTimeString(project.start),
      end: toDateTimeString(project.end),
      attribute: (project.attribute ?? {}) as ProjectAttribute,
      authority,
      role,
      commentCount: project._count?.comments ?? 0,
    }
  }

