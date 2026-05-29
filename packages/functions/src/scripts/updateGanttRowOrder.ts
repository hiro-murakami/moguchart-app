import { checkProjectPermission, getProjectIdFromRowIds, getUpdateCommonColumns, prisma } from './common/commonFunctions'
import type { UpdateGanttRowOrder } from '../types/shared'

const updateGanttRowOrder: UpdateGanttRowOrder = async (rowOrders, email?: string) => {
  if (rowOrders.length > 0) {
    const rowIds = rowOrders.map((r) => r.id)
    const projectId = await getProjectIdFromRowIds(rowIds)
    await checkProjectPermission(projectId, email, 'editor')
  }

  const updates = rowOrders.map((rowOrder) =>
    prisma.ganttRow.update({
      where: { id: rowOrder.id },
      data: { order: rowOrder.order, ...getUpdateCommonColumns(email) },
    }),
  )

  await prisma.$transaction(updates)
}

export default updateGanttRowOrder
