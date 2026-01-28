import type { DeleteGanttRow } from '../types/shared'
import { prisma } from './common/commonFunctions'

const deleteGanttRow: DeleteGanttRow = async (id) => {
  const result = await prisma.ganttRow.delete({
    where: { id },
  })

  return result.id
}

export default deleteGanttRow
