import { Prisma } from '../generated/prisma/client'
import type { UpsertGanttTasks, GanttTask } from '../types/shared'
import { checkProjectPermission, getCreateCommonColumns, getUpdateCommonColumns, prisma } from './common/commonFunctions'
import { fromGanttTask } from './common/converters'

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
    await checkProjectPermission(row.projectId, email, 'editor')
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
