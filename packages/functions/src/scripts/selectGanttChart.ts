import { GanttChart, Row } from '../types/shared'
import { prisma } from './common/commonFunctions'

const selectGanttChart = async (): Promise<GanttChart | null> => {
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
    data: (chart.data as unknown as Row[]) ?? [],
  }
}

export default selectGanttChart
