import { InputJsonValue } from '@prisma/client/runtime/library'
import { prisma } from './common/commonFunctions'

const upsertGanttChart = async (param: Object): Promise<void> => {
  const data = param as InputJsonValue
  await prisma.ganttChart.upsert({
    where: { id: 1 },
    update: { data },
    create: { id: 1, data },
  })
}

export default upsertGanttChart
