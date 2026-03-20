import type { SelectGanttChart } from '../types/shared'
import { prisma } from './common/commonFunctions'
import { toGanttRow } from './common/converters'

const selectGanttChart: SelectGanttChart = async (projectId) => {
  const data = await prisma.ganttRow.findMany({
    where: { projectId },
    include: {
      tasks: {
        include: {
          _count: { select: { comments: true } },
        },
      },
      _count: { select: { comments: true } },
    },
    orderBy: { order: 'asc' },
  })
  return data.map(toGanttRow)
}

export default selectGanttChart
