import type { DeleteGanttRow } from '../types/shared'
import { checkProjectPermission, getProjectIdFromRowIds, prisma } from './common/commonFunctions'

const deleteGanttRow: DeleteGanttRow = async (ids, email) => {
  const projectId = await getProjectIdFromRowIds(ids)
  await checkProjectPermission(projectId, email, 'editor')

  await prisma.ganttRow.deleteMany({
    where: {
      id: {
        in: ids,
      },
    },
  })
}

export default deleteGanttRow
