import type { DeleteGanttTask } from '../types/shared'
import { checkProjectPermission, getProjectIdFromTaskIds, prisma } from './common/commonFunctions'

const deleteGanttTask: DeleteGanttTask = async (ids, email) => {
  const projectId = await getProjectIdFromTaskIds(ids)
  await checkProjectPermission(projectId, email, 'editor')

  await prisma.ganttTask.deleteMany({
    where: { id: { in: ids } },
  })
}

export default deleteGanttTask
