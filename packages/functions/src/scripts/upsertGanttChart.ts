import { InputJsonValue } from '@prisma/client/runtime/library'
import type { UpsertGanttChart } from '../types/shared'
import { prisma } from './common/commonFunctions'

const upsertGanttChart: UpsertGanttChart = async (param) => {
  const data = param as unknown as InputJsonValue
  await prisma.ganttChart.upsert({
    where: { id: 1 },
    update: { data },
    create: { id: 1, data },
  })
}

export default upsertGanttChart
