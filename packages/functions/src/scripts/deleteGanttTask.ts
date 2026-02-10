import type { DeleteGanttTask } from '../types/shared'
import { prisma } from './common/commonFunctions'

const deleteGanttTask: DeleteGanttTask = async (ids) => {
  await prisma.ganttTask.deleteMany({
    where: { id: { in: ids } },
  })
}

export default deleteGanttTask
