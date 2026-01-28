import type { UpsertGanttTask } from '../types/shared'
import { prisma } from './common/commonFunctions'
import { fromGanttTask } from './common/converters'

const upsertGanttTask: UpsertGanttTask = async (param) => {
  const data = fromGanttTask(param)
  const { id, ...createData } = data

  const result = await prisma.ganttTask.upsert({
    where: { id: data.id },
    update: data,
    create: createData,
  })

  return result.id
}

export default upsertGanttTask
