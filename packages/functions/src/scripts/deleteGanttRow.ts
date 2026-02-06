import type { DeleteGanttRow } from '../types/shared'
import { prisma } from './common/commonFunctions'

const deleteGanttRow: DeleteGanttRow = async (ids) => {
  await prisma.ganttRow.deleteMany({
    where: {
      id: {
        in: ids,
      },
    },
  })
}

export default deleteGanttRow
