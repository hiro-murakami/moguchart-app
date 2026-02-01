import { getUpdateCommonColumns, prisma } from './common/commonFunctions'
import type { UpdateGanttRowOrder } from '../types/shared'

const updateGanttRowOrder: UpdateGanttRowOrder = async (
  rowOrders,
  email?: string,
) => {
  const updates = rowOrders.map((rowOrder) =>
    prisma.ganttRow.update({
      where: { id: rowOrder.id },
      data: { order: rowOrder.order, ...getUpdateCommonColumns(email) },
    }),
  )

  await prisma.$transaction(updates)
}

export default updateGanttRowOrder
