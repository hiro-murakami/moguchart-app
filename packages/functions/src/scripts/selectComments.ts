import type { SelectComments } from '../types/shared'
import { checkProjectPermission, prisma } from './common/commonFunctions'

const selectComments: SelectComments = async (params, email) => {
  if (!params || typeof params !== 'object') {
    throw new Error('Invalid parameters: projectId, rowId, or taskId is required')
  }

  const hasProjectId = params.projectId !== undefined && params.projectId !== null
  const hasRowId = params.rowId !== undefined && params.rowId !== null
  const hasTaskId = params.taskId !== undefined && params.taskId !== null

  // 全パラメータ省略による全件取得を拒否
  if (!hasProjectId && !hasRowId && !hasTaskId) {
    throw new Error('Invalid parameters: projectId, rowId, or taskId is required')
  }

  // 指定されたすべてのリソースからプロジェクトIDを解決し、単一プロジェクトに一致することを検証
  const resolvedProjectIds = new Set<string>()
  const where: { taskId?: number; rowId?: number; projectId?: string } = {}

  if (hasProjectId) {
    if (typeof params.projectId !== 'string' || !params.projectId.trim()) {
      throw new Error('Invalid projectId')
    }
    const trimmedProjectId = params.projectId.trim()
    resolvedProjectIds.add(trimmedProjectId)
    where.projectId = trimmedProjectId
  }

  if (hasRowId) {
    if (typeof params.rowId !== 'number' || !Number.isInteger(params.rowId) || params.rowId <= 0) {
      throw new Error('Invalid rowId')
    }
    const row = await prisma.ganttRow.findUnique({
      where: { id: params.rowId },
      select: { projectId: true },
    })
    if (!row) throw new Error('Row not found')
    resolvedProjectIds.add(row.projectId)
    where.rowId = params.rowId
  }

  if (hasTaskId) {
    if (typeof params.taskId !== 'number' || !Number.isInteger(params.taskId) || params.taskId <= 0) {
      throw new Error('Invalid taskId')
    }
    const task = await prisma.ganttTask.findUnique({
      where: { id: params.taskId },
      select: { rowId: true, row: { select: { projectId: true } } },
    })
    if (!task) throw new Error('Task not found')
    if (hasRowId && task.rowId !== params.rowId) {
      throw new Error('Invalid parameters: taskId does not belong to rowId')
    }
    resolvedProjectIds.add(task.row.projectId)
    where.taskId = params.taskId
  }

  if (resolvedProjectIds.size !== 1) {
    throw new Error('Invalid parameters: resource project mismatch')
  }

  const [projectId] = Array.from(resolvedProjectIds)
  await checkProjectPermission(projectId!, email, 'viewer')

  const data = await prisma.comment.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })

  // 作成者のメールアドレス一覧を抽出
  const emails = Array.from(new Set(data.map((c) => c.createdBy).filter((e) => e !== null) as string[]))

  // Userテーブルから該当ユーザー情報を取得
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
  })

  const userMap = new Map(users.map((u) => [u.email, u]))

  return data.map((c) => {
    let displayName: string | undefined = undefined
    let photoURL: string | undefined | null = undefined

    if (c.createdBy) {
      const user = userMap.get(c.createdBy)
      if (user) {
        displayName = user.displayName ?? undefined
        try {
          const attr = user.attribute as Record<string, any>
          photoURL = attr?.photoURL
        } catch (e) {
          // ignore
        }
      }
    }

    return {
      id: c.id,
      taskId: c.taskId ?? undefined,
      rowId: c.rowId ?? undefined,
      projectId: c.projectId ?? undefined,
      content: c.content,
      createdBy: c.createdBy ?? undefined,
      createdByDisplayName: displayName,
      createdByPhotoURL: photoURL,
      createdAt: c.createdAt?.toISOString() ?? undefined,
    }
  })
}

export default selectComments
