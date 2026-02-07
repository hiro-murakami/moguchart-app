import type { UpsertGanttTask } from '../types/shared'
import { getCreateCommonColumns, getUpdateCommonColumns, prisma } from './common/commonFunctions'
import { fromGanttTask } from './common/converters'

const upsertGanttTask: UpsertGanttTask = async (task, email?: string) => {
  const data = fromGanttTask(task)
  const { id, ...createData } = data

  const result = await prisma.ganttTask.upsert({
    where: { id: data.id },
    update: { ...data, ...getUpdateCommonColumns(email) },
    create: { ...createData, ...getCreateCommonColumns(email) },
  })

  return result.id
}

export default upsertGanttTask
