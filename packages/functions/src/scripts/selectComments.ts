import type { SelectComments } from '../types/shared'
import { checkProjectPermission, prisma } from './common/commonFunctions'

const selectComments: SelectComments = async (params, email) => {
  // リソースからプロジェクトIDを特定して権限チェック
  let projectId: string | undefined

  if (params.projectId != null) {
    projectId = params.projectId
  } else if (params.rowId != null) {
    const row = await prisma.ganttRow.findUnique({
      where: { id: params.rowId },
      select: { projectId: true },
    })
    if (!row) throw new Error('Row not found')
    projectId = row.projectId
  } else if (params.taskId != null) {
    const task = await prisma.ganttTask.findUnique({
      where: { id: params.taskId },
      select: { row: { select: { projectId: true } } },
    })
    if (!task) throw new Error('Task not found')
    projectId = task.row.projectId
  }

  if (projectId) {
    await checkProjectPermission(projectId, email, 'viewer')
  }

  const where: { taskId?: number; rowId?: number; projectId?: string } = {}
  if (params.taskId != null) where.taskId = params.taskId
  if (params.rowId != null) where.rowId = params.rowId
  if (params.projectId != null) where.projectId = params.projectId

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
