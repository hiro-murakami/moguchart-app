import type { SelectTaskComments } from '../types/shared'
import { prisma } from './common/commonFunctions'

const selectTaskComments: SelectTaskComments = async (taskId) => {
  const data = await prisma.taskComment.findMany({
    where: { taskId },
    orderBy: { createdAt: 'desc' },
  })
  return data.map((c) => ({
    id: c.id,
    taskId: c.taskId,
    content: c.content,
    createdBy: c.createdBy ?? undefined,
    createdAt: c.createdAt?.toISOString() ?? undefined,
  }))
}

export default selectTaskComments
