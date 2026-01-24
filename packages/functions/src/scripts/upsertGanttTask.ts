import type { UpsertGanttTask } from '../types/shared'
import { prisma } from './common/commonFunctions'

const upsertGanttTask: UpsertGanttTask = async (param) => {
  const data = {
    ...param,
    start: new Date(param.start),
    end: new Date(param.end),
  }

  await prisma.task.upsert({
    where: { id: data.id },
    update: data,
    create: data,
  })
}

export default upsertGanttTask
