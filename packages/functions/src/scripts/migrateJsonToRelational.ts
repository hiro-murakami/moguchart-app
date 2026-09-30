import { prisma } from './common/commonFunctions'
import type { Authority, TaskAttribute } from '../types/shared'
import { randomUUID } from 'crypto'

export const migrateJsonToRelational = async () => {
  console.log('--- Starting migration: JSON to ProjectMember & TaskAssignee ---')

  // 1. プロジェクト権限の移行
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      authority: true,
    },
  })

  let memberCount = 0
  for (const project of projects) {
    const auth = (project.authority as Authority) || {}
    const roles: Array<{ role: 'owner' | 'editor' | 'viewer'; list?: string[] }> = [
      { role: 'owner', list: auth.owners },
      { role: 'editor', list: auth.editors },
      { role: 'viewer', list: auth.viewers },
    ]

    for (const { role, list } of roles) {
      if (!Array.isArray(list)) continue
      for (const identifier of list) {
        if (typeof identifier !== 'string' || !identifier.trim()) continue
        const trimmed = identifier.trim()

        let userId: string | undefined
        let email: string | undefined

        if (trimmed.includes('@')) {
          email = trimmed
          const user = await prisma.user.findFirst({
            where: { email: trimmed },
            select: { id: true },
          })
          userId = user?.id
        } else {
          userId = trimmed
          const user = await prisma.user.findUnique({
            where: { id: trimmed },
            select: { email: true },
          })
          email = user?.email || undefined
        }

        // 既存チェック
        const existing = await prisma.projectMember.findFirst({
          where: {
            projectId: project.id,
            OR: [
              ...(userId ? [{ userId }] : []),
              ...(email ? [{ email }] : []),
            ],
          },
        })

        if (!existing) {
          await prisma.projectMember.create({
            data: {
              id: randomUUID(),
              projectId: project.id,
              userId: userId || null,
              email: email || null,
              role,
            },
          })
          memberCount++
        }
      }
    }
  }
  console.log(`Migrated ${memberCount} project member records.`)

  // 2. タスク担当者の移行
  const tasks = await prisma.ganttTask.findMany({
    select: {
      id: true,
      attribute: true,
    },
  })

  let assigneeCount = 0
  for (const task of tasks) {
    const attr = (task.attribute as TaskAttribute) || {}
    const assignees = attr.assignees
    if (!Array.isArray(assignees) || assignees.length === 0) continue

    for (const identifier of assignees) {
      if (typeof identifier !== 'string' || !identifier.trim()) continue
      const trimmed = identifier.trim()

      let userId: string | undefined
      let email: string | undefined

      if (trimmed.includes('@')) {
        email = trimmed
        const user = await prisma.user.findFirst({
          where: { email: trimmed },
          select: { id: true },
        })
        userId = user?.id
      } else {
        userId = trimmed
        const user = await prisma.user.findUnique({
          where: { id: trimmed },
          select: { email: true },
        })
        email = user?.email || undefined
      }

      // 既存チェック
      const existing = await prisma.taskAssignee.findFirst({
        where: {
          taskId: task.id,
          OR: [
            ...(userId ? [{ userId }] : []),
            ...(email ? [{ email }] : []),
          ],
        },
      })

      if (!existing) {
        await prisma.taskAssignee.create({
          data: {
            id: randomUUID(),
            taskId: task.id,
            userId: userId || null,
            email: email || null,
          },
        })
        assigneeCount++
      }
    }
  }
  console.log(`Migrated ${assigneeCount} task assignee records.`)
  console.log('--- Migration completed successfully ---')
}

if (process.argv[1]?.includes('migrateJsonToRelational')) {
  migrateJsonToRelational()
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
