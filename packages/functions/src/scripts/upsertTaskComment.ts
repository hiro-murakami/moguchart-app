import type { UpsertTaskComment } from '../types/shared'
import { prisma } from './common/commonFunctions'

const upsertTaskComment: UpsertTaskComment = async (comment, email) => {
  if (comment.id === 0) {
    // 新規作成
    const created = await prisma.taskComment.create({
      data: {
        taskId: comment.taskId,
        content: comment.content,
        createdBy: email ?? 'system',
        updatedBy: email ?? 'system',
      },
    })
    return created.id
  } else {
    // 更新
    await prisma.taskComment.update({
      where: { id: comment.id },
      data: {
        content: comment.content,
        updatedBy: email ?? 'system',
      },
    })
    return comment.id
  }
}

export default upsertTaskComment
