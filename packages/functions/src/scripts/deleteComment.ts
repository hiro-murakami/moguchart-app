import type { DeleteComment } from '../types/shared'
import { prisma } from './common/commonFunctions'

const deleteComment: DeleteComment = async (id) => {
  await prisma.comment.delete({
    where: { id },
  })
}

export default deleteComment
