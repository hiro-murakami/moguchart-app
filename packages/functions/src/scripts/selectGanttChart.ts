import type { SelectGanttChart } from '../types/shared'
import { prisma, toDateString } from './common/commonFunctions'

const selectGanttChart: SelectGanttChart = async () => {
  const data = await prisma.row.findMany({
    include: { tasks: true },
  })
  return data.map((row) => ({
    ...row,
    tasks: row.tasks.map((task) => ({
      ...task,
      rowId: row.id,
      start: toDateString(task.start),
      end: toDateString(task.end),
    })),
  }))
}

export default selectGanttChart
