import type { SelectProjectUsers, User, UserAttribute, Authority, TaskAttribute } from '../types/shared.js'
import { checkProjectPermission, prisma } from './common/commonFunctions.js'

const selectProjectUsers: SelectProjectUsers = async (projectId: string, userIdentifier?: string) => {
  await checkProjectPermission(projectId, userIdentifier, 'viewer')

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      authority: true,
      rows: {
        select: {
          tasks: {
            select: {
              attribute: true,
            },
          },
        },
      },
    },
  })

  if (!project) {
    return []
  }

  const identifierSet = new Set<string>()

  // 1. プロジェクト権限者から抽出
  const auth = (project.authority as Authority) || {}
  const authIdentifiers = [...(auth.owners || []), ...(auth.editors || []), ...(auth.viewers || [])]
  for (const id of authIdentifiers) {
    if (typeof id === 'string' && id.trim()) {
      identifierSet.add(id.trim())
    }
  }

  // 2. 全タスクの担当者（assignees）から抽出
  for (const row of project.rows || []) {
    for (const task of row.tasks || []) {
      const attr = (task.attribute as TaskAttribute) || {}
      if (Array.isArray(attr.assignees)) {
        for (const assignee of attr.assignees) {
          if (typeof assignee === 'string' && assignee.trim()) {
            identifierSet.add(assignee.trim())
          }
        }
      }
    }
  }

  if (identifierSet.size === 0) {
    return []
  }

  const emails: string[] = []
  const uids: string[] = []

  for (const identifier of identifierSet) {
    if (identifier.includes('@')) {
      emails.push(identifier)
    } else {
      uids.push(identifier)
    }
  }

  const orConditions: Array<{ id?: { in: string[] }; email?: { in: string[] } }> = []
  if (uids.length > 0) {
    orConditions.push({ id: { in: uids } })
  }
  if (emails.length > 0) {
    orConditions.push({ email: { in: emails } })
  }

  if (orConditions.length === 0) {
    return []
  }

  const dbUsers = await prisma.user.findMany({
    where: {
      OR: orConditions,
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      attribute: true,
    },
  })

  return dbUsers.map((u): User => ({
    id: u.id,
    email: u.email || undefined,
    displayName: u.displayName || undefined,
    attribute: (u.attribute as UserAttribute) || {},
  }))
}

export default selectProjectUsers
