import { Prisma } from '../generated/prisma/client'
import type { UpsertGanttTasks, GanttTask, TaskAttribute } from '../types/shared'
import { checkProjectPermission, getCreateCommonColumns, getUpdateCommonColumns, prisma } from './common/commonFunctions'
import { fromGanttTask, toGanttTask } from './common/converters'

const syncTasksAssigneesBatch = async (
  tx: Prisma.TransactionClient,
  taskEntries: Array<{ taskId: number; assignees?: string[] }>,
) => {
  if (taskEntries.length === 0) return

  const taskIds = taskEntries.map((e) => e.taskId)
  await tx.taskAssignee.deleteMany({
    where: { taskId: { in: taskIds } },
  })

  // 全タスクの識別子を集約して1回のクエリでユーザー解決
  const emails = new Set<string>()
  const userIds = new Set<string>()
  for (const entry of taskEntries) {
    if (!entry.assignees || !Array.isArray(entry.assignees)) continue
    for (const raw of entry.assignees) {
      if (typeof raw !== 'string' || !raw.trim()) continue
      const trimmed = raw.trim()
      if (trimmed.includes('@')) {
        emails.add(trimmed)
      } else {
        userIds.add(trimmed)
      }
    }
  }

  const emailToId = new Map<string, string>()
  const idToEmail = new Map<string, string>()

  if (emails.size > 0 || userIds.size > 0) {
    const orConditions: Prisma.UserWhereInput[] = []
    if (emails.size > 0) orConditions.push({ email: { in: Array.from(emails) } })
    if (userIds.size > 0) orConditions.push({ id: { in: Array.from(userIds) } })

    const matchedUsers = await tx.user.findMany({
      where: { OR: orConditions },
      select: { id: true, email: true },
    })
    for (const u of matchedUsers) {
      if (u.email) {
        emailToId.set(u.email.toLowerCase(), u.id)
        idToEmail.set(u.id, u.email)
      }
    }
  }

  const rowsToCreate: Array<{ taskId: number; userId: string | null; email: string | null }> = []

  for (const entry of taskEntries) {
    if (!entry.assignees || !Array.isArray(entry.assignees) || entry.assignees.length === 0) continue

    const taskAssignees: Array<{ userId: string | null; email: string | null }> = []
    for (const raw of entry.assignees) {
      if (typeof raw !== 'string' || !raw.trim()) continue
      const trimmed = raw.trim()
      let userId: string | null = null
      let email: string | null = null

      if (trimmed.includes('@')) {
        email = trimmed
        userId = emailToId.get(trimmed.toLowerCase()) ?? null
      } else {
        userId = trimmed
        email = idToEmail.get(trimmed) ?? null
      }

      const isDuplicate = taskAssignees.some((existing) => {
        if (userId && existing.userId && userId === existing.userId) return true
        if (email && existing.email && email.toLowerCase() === existing.email.toLowerCase()) return true
        return false
      })
      if (!isDuplicate) {
        taskAssignees.push({ userId, email })
        rowsToCreate.push({
          taskId: entry.taskId,
          userId,
          email,
        })
      }
    }
  }

  if (rowsToCreate.length > 0) {
    await tx.taskAssignee.createMany({
      data: rowsToCreate,
    })
  }
}

const executeUpsert = async (tx: Prisma.TransactionClient, task: GanttTask, email?: string) => {
  const data = fromGanttTask(task)
  const { id, ...createData } = data

  const attribute = data.attribute as Prisma.InputJsonValue

  if (id === 0) {
    const created = await tx.ganttTask.create({
      data: {
        ...createData,
        attribute,
        ...getCreateCommonColumns(email),
      },
    })
    return created.id
  }

  const updated = await tx.ganttTask.update({
    where: { id },
    data: {
      ...createData,
      attribute,
      ...getUpdateCommonColumns(email),
    },
  })

  return updated.id
}

const upsertGanttTasks: UpsertGanttTasks = async (tasks, email?: string) => {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return []
  }

  for (const t of tasks) {
    const numericId = Number(t?.id ?? 0)
    const numericRowId = Number(t?.rowId)
    if (!Number.isInteger(numericId) || numericId < 0) {
      throw new Error('Invalid task ID')
    }
    if (!Number.isInteger(numericRowId) || numericRowId <= 0) {
      throw new Error('Invalid row ID')
    }
  }

  const uniqueRowIds = Array.from(new Set(tasks.map((t) => Number(t.rowId))))
  const targetRows = await prisma.ganttRow.findMany({
    where: { id: { in: uniqueRowIds } },
    select: { id: true, projectId: true },
  })
  if (targetRows.length === 0 || targetRows.length !== uniqueRowIds.length) {
    throw new Error('Row not found')
  }

  const projectIds = new Set(targetRows.map((r) => r.projectId))
  if (projectIds.size !== 1) {
    throw new Error('All tasks must belong to the same project')
  }
  const targetProjectId = targetRows[0]!.projectId

  const existingTaskIds = Array.from(
    new Set(tasks.map((t) => Number(t.id ?? 0)).filter((id) => id > 0)),
  )

  try {
    await checkProjectPermission(targetProjectId, email, 'editor')
  } catch {
    // editor 権限がない場合: viewer かつ 全タスクの担当者 (assignees) に含まれているか検証
    await checkProjectPermission(targetProjectId, email, 'viewer')
    if (!email) throw new Error('Permission denied')

    if (tasks.some((t) => Number(t.id ?? 0) <= 0)) {
      // 新規タスク作成は担当者権限では不可
      throw new Error('Permission denied')
    }

    // ユーザーの UID と Email の両方を解決
    let authUid: string | undefined
    let authEmail: string | undefined
    if (email.includes('@')) {
      authEmail = email
      const user = await prisma.user.findFirst({
        where: { email },
        select: { id: true },
      })
      authUid = user?.id
    } else {
      authUid = email
      const user = await prisma.user.findUnique({
        where: { id: email },
        select: { email: true },
      })
      authEmail = user?.email || undefined
    }

    const isUserAssignee = (assignees: string[]) => {
      return (!!authUid && assignees.includes(authUid)) || (!!authEmail && assignees.includes(authEmail))
    }

    const existingTasks = await prisma.ganttTask.findMany({
      where: { id: { in: existingTaskIds } },
      include: { assignees: true, row: { select: { projectId: true } } },
    })

    if (
      existingTasks.length !== existingTaskIds.length ||
      existingTasks.some((et) => et.row.projectId !== targetProjectId)
    ) {
      throw new Error('Permission denied')
    }

    // 担当者は進捗率（progress）のみ変更可能
    const sanitizedTasks: GanttTask[] = []
    for (const t of tasks) {
      const existing = existingTasks.find((et) => et.id === Number(t.id))
      if (!existing) throw new Error('Task not found')
      const attr = (existing.attribute as any) || {}
      const jsonAssignees: string[] = attr.assignees || []
      const tableAssignees: string[] = (existing.assignees || [])
        .map((a) => a.userId || a.email)
        .filter((id): id is string => Boolean(id))
      const assignees = Array.from(new Set([...jsonAssignees, ...tableAssignees]))
      if (!isUserAssignee(assignees)) {
        throw new Error('Permission denied')
      }

      const baseTask = toGanttTask(existing)
      const newAttr = ((t as any).attribute as TaskAttribute) || {}
      sanitizedTasks.push({
        ...baseTask,
        attribute: {
          ...baseTask.attribute,
          progress: newAttr.progress != null ? newAttr.progress : undefined,
        },
      })
    }

    return await prisma.$transaction(async (tx) => {
      const results: number[] = []
      const assigneeEntries: Array<{ taskId: number; assignees?: string[] }> = []
      for (const task of sanitizedTasks) {
        const upsertedId = await executeUpsert(tx, task, email)
        results.push(upsertedId)
        assigneeEntries.push({ taskId: upsertedId, assignees: task.attribute?.assignees })
      }
      await syncTasksAssigneesBatch(tx, assigneeEntries)
      return results
    })
  }

  return await prisma.$transaction(async (tx) => {
    const verifiedRows = await tx.ganttRow.findMany({
      where: { id: { in: uniqueRowIds } },
      select: { id: true, projectId: true },
    })
    if (
      verifiedRows.length !== uniqueRowIds.length ||
      verifiedRows.some((r) => r.projectId !== targetProjectId)
    ) {
      throw new Error('Permission denied')
    }

    if (existingTaskIds.length > 0) {
      const verifiedTasks = await tx.ganttTask.findMany({
        where: { id: { in: existingTaskIds } },
        select: { id: true, row: { select: { projectId: true } } },
      })
      if (
        verifiedTasks.length !== existingTaskIds.length ||
        verifiedTasks.some((vt) => vt.row.projectId !== targetProjectId)
      ) {
        throw new Error('Permission denied')
      }
    }

    const results: number[] = []
    const assigneeEntries: Array<{ taskId: number; assignees?: string[] }> = []
    for (const task of tasks) {
      const upsertedId = await executeUpsert(tx, task, email)
      results.push(upsertedId)
      assigneeEntries.push({ taskId: upsertedId, assignees: task.attribute?.assignees })
    }
    await syncTasksAssigneesBatch(tx, assigneeEntries)
    return results
  })
}

export default upsertGanttTasks
