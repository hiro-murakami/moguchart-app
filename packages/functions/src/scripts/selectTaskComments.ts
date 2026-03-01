import type { SelectTaskComments } from '../types/shared'
import { prisma } from './common/commonFunctions'

const selectTaskComments: SelectTaskComments = async (taskId) => {
  const data = await prisma.taskComment.findMany({
    where: { taskId },
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
      taskId: c.taskId,
      content: c.content,
      createdBy: c.createdBy ?? undefined,
      createdByDisplayName: displayName,
      createdByPhotoURL: photoURL,
      createdAt: c.createdAt?.toISOString() ?? undefined,
    }
  })
}

export default selectTaskComments
