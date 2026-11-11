import type { UpsertComment } from '../types/shared'
import { checkProjectPermission, getProjectIdFromCommentId, prisma } from './common/commonFunctions'

const upsertComment: UpsertComment = async (comment, email) => {
  if (!email) {
    throw new Error('Permission denied')
  }
  if (!comment || typeof comment.content !== 'string' || !comment.content.trim()) {
    throw new Error('Comment content is required')
  }

  if (!comment.id || comment.id === 0) {
    // 新規作成: 指定された全ターゲット（projectId / rowId / taskId）の整合性と editor 権限を検証
    const hasProjectId = comment.projectId !== undefined && comment.projectId !== null && comment.projectId !== ''
    const hasRowId = comment.rowId !== undefined && comment.rowId !== null
    const hasTaskId = comment.taskId !== undefined && comment.taskId !== null

    if (!hasProjectId && !hasRowId && !hasTaskId) {
      throw new Error('Invalid parameters: projectId, rowId, or taskId is required')
    }

    const resolvedProjectIds = new Set<string>()
    let targetProjectId: string | null = null
    let targetRowId: number | null = null
    let targetTaskId: number | null = null

    if (hasProjectId) {
      if (typeof comment.projectId !== 'string' || !comment.projectId.trim()) {
        throw new Error('Invalid projectId')
      }
      targetProjectId = comment.projectId.trim()
      resolvedProjectIds.add(targetProjectId)
    }

    if (hasRowId) {
      if (typeof comment.rowId !== 'number' || !Number.isInteger(comment.rowId) || comment.rowId <= 0) {
        throw new Error('Invalid rowId')
      }
      const row = await prisma.ganttRow.findUnique({
        where: { id: comment.rowId },
        select: { projectId: true },
      })
      if (!row) throw new Error('Row not found')
      targetRowId = comment.rowId
      resolvedProjectIds.add(row.projectId)
    }

    if (hasTaskId) {
      if (typeof comment.taskId !== 'number' || !Number.isInteger(comment.taskId) || comment.taskId <= 0) {
        throw new Error('Invalid taskId')
      }
      const task = await prisma.ganttTask.findUnique({
        where: { id: comment.taskId },
        select: { rowId: true, row: { select: { projectId: true } } },
      })
      if (!task) throw new Error('Task not found')
      if (targetRowId !== null && task.rowId !== targetRowId) {
        throw new Error('Permission denied: taskId does not belong to rowId')
      }
      targetTaskId = comment.taskId
      resolvedProjectIds.add(task.row.projectId)
    }

    if (resolvedProjectIds.size !== 1) {
      throw new Error('Permission denied: target resource project mismatch')
    }

    const [resolvedProjectId] = Array.from(resolvedProjectIds)
    await checkProjectPermission(resolvedProjectId!, email, 'editor')

    const created = await prisma.comment.create({
      data: {
        taskId: targetTaskId,
        rowId: targetRowId,
        projectId: targetProjectId,
        content: comment.content,
        createdBy: email,
        updatedBy: email,
      },
    })
    return created.id
  } else {
    if (typeof comment.id !== 'number' || !Number.isInteger(comment.id) || comment.id <= 0) {
      throw new Error('Invalid comment id')
    }

    // 更新: 自分のコメントかつ対象プロジェクトの editor 権限がある場合のみ更新可能
    const existing = await prisma.comment.findUnique({
      where: { id: comment.id },
      select: { createdBy: true },
    })
    if (!existing) throw new Error('Comment not found')
    if (!existing.createdBy || existing.createdBy !== email) {
      throw new Error('Permission denied: can only edit your own comments')
    }

    const projectId = await getProjectIdFromCommentId(comment.id)
    await checkProjectPermission(projectId, email, 'editor')

    await prisma.comment.update({
      where: { id: comment.id },
      data: {
        content: comment.content,
        updatedBy: email,
      },
    })
    return comment.id
  }
}

export default upsertComment
