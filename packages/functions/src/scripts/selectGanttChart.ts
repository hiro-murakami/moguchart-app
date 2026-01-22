import type { GanttRow, SelectGanttChart } from '../types/shared'
import { prisma } from './common/commonFunctions'

const selectGanttChart: SelectGanttChart = async () => {
  const chart = await prisma.ganttChart.findUnique({
    where: { id: 1 },
  })

  if (!chart) {
    return null
  }

  return {
    id: chart.id,
    // chart.data は Prisma.JsonValue 型 (nullの可能性がある)
    // GanttChart['data'] は Object 型
    // null の場合は空オブジェクトとして扱い、Object型へキャストする
    data: (chart.data as unknown as GanttRow[]) ?? [],
  }
}

export default selectGanttChart
