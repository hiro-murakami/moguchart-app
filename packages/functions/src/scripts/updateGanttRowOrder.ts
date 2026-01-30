import { prisma } from './common/commonFunctions'
import type { UpdateGanttRowOrder } from '../types/shared'

const updateGanttRowOrder: UpdateGanttRowOrder = async (rows) => {
  const updates = rows.map((row) =>
    prisma.ganttRow.update({
      where: { id: row.id },
      data: { order: row.order },
    }),
  )

  await prisma.$transaction(updates)
}

export default updateGanttRowOrder
