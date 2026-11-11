import type { DeleteComment } from '../types/shared'
import { checkProjectPermission, getProjectIdFromCommentId, prisma } from './common/commonFunctions'

const deleteComment: DeleteComment = async (id, email) => {
  if (!email) {
    throw new Error('Permission denied')
  }
  if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
    throw new Error('Invalid comment id')
  }

  // コメントの存在確認および所属プロジェクトの editor 以上権限を検証
  const comment = await prisma.comment.findUnique({
    where: { id },
    select: { createdBy: true },
  })
  if (!comment) throw new Error('Comment not found')

  const projectId = await getProjectIdFromCommentId(id)
  await checkProjectPermission(projectId, email, 'editor')

  await prisma.comment.delete({
    where: { id },
  })
}

export default deleteComment
