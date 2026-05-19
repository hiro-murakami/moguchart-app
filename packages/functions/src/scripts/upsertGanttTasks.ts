import { Prisma } from '../generated/prisma/client'
import type { UpsertGanttTasks, GanttTask } from '../types/shared'
import { getCreateCommonColumns, getUpdateCommonColumns, prisma } from './common/commonFunctions'
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
  return await prisma.$transaction(async (tx) => {
    const results = []
    for (const task of tasks) {
      results.push(await executeUpsert(tx, task, email))
    }
    return results
  })
}

export default upsertGanttTasks
