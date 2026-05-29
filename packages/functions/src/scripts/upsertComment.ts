import type { UpsertComment } from '../types/shared'
import { checkProjectPermission, prisma } from './common/commonFunctions'

const upsertComment: UpsertComment = async (comment, email) => {
  if (comment.id === 0) {
    // 新規作成: リソースからプロジェクトIDを特定して editor 権限チェック
    let projectId: string | undefined
    if (comment.projectId) {
      projectId = comment.projectId
    } else if (comment.rowId) {
      const row = await prisma.ganttRow.findUnique({
        where: { id: comment.rowId },
        select: { projectId: true },
      })
      if (!row) throw new Error('Row not found')
      projectId = row.projectId
    } else if (comment.taskId) {
      const task = await prisma.ganttTask.findUnique({
        where: { id: comment.taskId },
        select: { row: { select: { projectId: true } } },
      })
      if (!task) throw new Error('Task not found')
      projectId = task.row.projectId
    }
    if (projectId) {
      await checkProjectPermission(projectId, email, 'editor')
    }

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
    // 更新: 自分のコメントのみ更新可能
    const existing = await prisma.comment.findUnique({
      where: { id: comment.id },
      select: { createdBy: true },
    })
    if (!existing) throw new Error('Comment not found')
    if (existing.createdBy !== email) {
      throw new Error('Permission denied: can only edit your own comments')
    }

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
