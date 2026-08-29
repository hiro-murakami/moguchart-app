import { Prisma } from '../generated/prisma/client'
import type { UpsertGanttTasks, GanttTask, TaskAttribute } from '../types/shared'
import { checkProjectPermission, getCreateCommonColumns, getUpdateCommonColumns, prisma } from './common/commonFunctions'
import { fromGanttTask, toGanttTask } from './common/converters'

const executeUpsert = async (tx: Prisma.TransactionClient, task: GanttTask, email?: string) => {
  const data = fromGanttTask(task)
  const { id, ...createData } = data

  const attribute = data.attribute as Prisma.InputJsonValue

  const result = await tx.ganttTask.upsert({
    where: { id: data.id },
    update: {
      ...data,
      attribute,
      ...getUpdateCommonColumns(email),
    },
    create: {
      ...createData,
      ...(data.id !== 0 ? { id: data.id } : {}),
      attribute,
      ...getCreateCommonColumns(email),
    },
  })

  return result.id
}

const upsertGanttTasks: UpsertGanttTasks = async (tasks, email?: string) => {
  if (tasks.length > 0) {
    // 最初のタスクの rowId からプロジェクトを特定して権限チェック
    const row = await prisma.ganttRow.findUnique({
      where: { id: tasks[0]!.rowId },
      select: { projectId: true },
    })
    if (!row) throw new Error('Row not found')

    try {
      await checkProjectPermission(row.projectId, email, 'editor')
    } catch (err) {
      // editor 権限がない場合: viewer かつ 全タスクの担当者 (assignees) に email が含まれているか検証
      await checkProjectPermission(row.projectId, email, 'viewer')
      if (!email) throw new Error('Permission denied')

      const taskIds = tasks.map((t) => t.id).filter((id) => id > 0)
      if (taskIds.length !== tasks.length) {
        // 新規タスク作成は担当者権限では不可
        throw new Error('Permission denied')
      }

      const existingTasks = await prisma.ganttTask.findMany({
        where: { id: { in: taskIds } },
      })

      // 担当者は進捗率（progress）のみ変更可能
      const sanitizedTasks: GanttTask[] = []
      for (const t of tasks) {
        const existing = existingTasks.find((et) => et.id === t.id)
        if (!existing) throw new Error('Task not found')
        const attr = (existing.attribute as any) || {}
        const assignees: string[] = attr.assignees || []
        if (!assignees.includes(email)) {
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
        const results = []
        for (const task of sanitizedTasks) {
          results.push(await executeUpsert(tx, task, email))
        }
        return results
      })
    }
  }

  return await prisma.$transaction(async (tx) => {
    const results = []
    for (const task of tasks) {
      results.push(await executeUpsert(tx, task, email))
    }
    return results
  })
}

export default upsertGanttTasks
