import type { SelectGanttChart } from '../types/shared'
import { prisma } from './common/commonFunctions'
import { toGanttRow } from './common/converters'

const selectGanttChart: SelectGanttChart = async () => {
  const data = await prisma.ganttRow.findMany({
    include: { tasks: true },
  })
  return data.map(toGanttRow)
}

export default selectGanttChart
