import type { DeleteTaskComment } from '../types/shared'
import { prisma } from './common/commonFunctions'

const deleteTaskComment: DeleteTaskComment = async (id) => {
  await prisma.taskComment.delete({
    where: { id },
  })
}

export default deleteTaskComment
