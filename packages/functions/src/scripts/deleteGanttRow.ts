import type { DeleteGanttRow } from '../types/shared'
import { prisma } from './common/commonFunctions'

const deleteGanttRow: DeleteGanttRow = async (id) => {
  await prisma.ganttRow.delete({
    where: { id },
  })
}

export default deleteGanttRow
