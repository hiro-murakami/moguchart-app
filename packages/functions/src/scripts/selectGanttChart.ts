import type { SelectGanttChart } from '../types/shared'
import { checkProjectPermission, prisma } from './common/commonFunctions'
import { toGanttRow } from './common/converters'

const selectGanttChart: SelectGanttChart = async (projectId, email) => {
  await checkProjectPermission(projectId, email, 'viewer')

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
