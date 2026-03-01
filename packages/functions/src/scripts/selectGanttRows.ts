import type { SelectGanttRows } from '../types/shared'
import { prisma } from './common/commonFunctions'
import { toGanttRow } from './common/converters'

/**
 * 指定したプロジェクト内で、行IDリストに該当する行（タスク含む）を返す。
 * 差分更新のために使用される。
 */
const selectGanttRows: SelectGanttRows = async ({ projectId, rowIds }) => {
  const data = await prisma.ganttRow.findMany({
    where: {
      projectId,
      id: { in: rowIds },
    },
    include: {
      tasks: {
        include: {
          _count: { select: { taskComments: true } },
        },
      },
    },
    orderBy: { order: 'asc' },
  })
  return data.map(toGanttRow)
}

export default selectGanttRows
