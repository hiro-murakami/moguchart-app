import type { DeleteGanttTask } from '../types/shared'
import { prisma } from './common/commonFunctions'

const deleteGanttTask: DeleteGanttTask = async (id) => {
  await prisma.ganttTask.delete({
    where: { id },
  })
}

export default deleteGanttTask
