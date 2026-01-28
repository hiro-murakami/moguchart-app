import type { DeleteGanttTask } from '../types/shared'
import { prisma } from './common/commonFunctions'

const deleteGanttTask: DeleteGanttTask = async (id) => {
  const result = await prisma.ganttTask.delete({
    where: { id },
  })

  return result.id
}

export default deleteGanttTask
