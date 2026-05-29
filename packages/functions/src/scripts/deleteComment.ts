import type { DeleteComment } from '../types/shared'
import { checkProjectPermission, getProjectIdFromCommentId, prisma } from './common/commonFunctions'

const deleteComment: DeleteComment = async (id, email) => {
  // コメントの所有者チェック: 自分のコメントか、プロジェクトのeditor以上であれば削除可能
  const comment = await prisma.comment.findUnique({
    where: { id },
    select: { createdBy: true },
  })
  if (!comment) throw new Error('Comment not found')

  if (comment.createdBy !== email) {
    // 自分のコメントでない場合、プロジェクトのeditor権限が必要
    const projectId = await getProjectIdFromCommentId(id)
    await checkProjectPermission(projectId, email, 'editor')
  }

  await prisma.comment.delete({
    where: { id },
  })
}

export default deleteComment
