import type { UpsertComment } from '../types/shared'
import { prisma } from './common/commonFunctions'

const upsertComment: UpsertComment = async (comment, email) => {
  if (comment.id === 0) {
    // 新規作成
    const created = await prisma.comment.create({
      data: {
        taskId: comment.taskId ?? null,
        rowId: comment.rowId ?? null,
        projectId: comment.projectId ?? null,
        content: comment.content,
        createdBy: email ?? 'system',
        updatedBy: email ?? 'system',
      },
    })
    return created.id
  } else {
    // 更新
    await prisma.comment.update({
      where: { id: comment.id },
      data: {
        content: comment.content,
        updatedBy: email ?? 'system',
      },
    })
    return comment.id
  }
}

export default upsertComment
