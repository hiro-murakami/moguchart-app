import { UserAttribute, UpsertUser } from '../types/shared'
import { getCreateCommonColumns, getUpdateCommonColumns, prisma } from './common/commonFunctions'

/**
 * projectSettings から削除済みプロジェクトのエントリを除去する
 */
const cleanupDeletedProjectSettings = async (
  projectSettings: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  const projectIds = Object.keys(projectSettings)
  if (projectIds.length === 0) return projectSettings

  // DB に存在するプロジェクトIDを取得
  const existingProjects = await prisma.project.findMany({
    where: { id: { in: projectIds } },
    select: { id: true },
  })
  const existingIds = new Set(existingProjects.map((p) => p.id))

  // 存在するプロジェクトのエントリのみ残す
  const cleaned: Record<string, unknown> = {}
  for (const id of projectIds) {
    if (existingIds.has(id)) {
      cleaned[id] = projectSettings[id]
    }
  }
  return cleaned
}

const upsertUser: UpsertUser = async (user, authUid) => {
  // セキュリティ: 自分自身のデータのみ更新可能
  if (authUid && user.id !== authUid && user.email !== authUid) {
    throw new Error('Permission denied: cannot modify other user data')
  }

  // 更新前に削除済みプロジェクトの設定をクリーンアップ
  const attribute = (user.attribute || {}) as UserAttribute
  if (attribute.projectSettings && Object.keys(attribute.projectSettings).length > 0) {
    attribute.projectSettings = (await cleanupDeletedProjectSettings(
      attribute.projectSettings as Record<string, unknown>,
    )) as UserAttribute['projectSettings']
  }

  // 移行支援: email が同一で id が異なる既存レコードがあれば重複防止のためクリーンアップ
  if (user.email) {
    const existingByEmail = await prisma.user.findFirst({
      where: { email: user.email },
    })
    if (existingByEmail && existingByEmail.id !== user.id) {
      await prisma.user.delete({
        where: { id: existingByEmail.id },
      })
    }
  }

  const actor = user.email || user.id

  await prisma.user.upsert({
    where: { id: user.id },
    update: {
      email: user.email ?? null,
      displayName: user.displayName ?? null,
      attribute: attribute as any,
      ...getUpdateCommonColumns(actor),
    },
    create: {
      id: user.id,
      email: user.email ?? null,
      displayName: user.displayName ?? null,
      attribute: attribute as any,
      ...getCreateCommonColumns(actor),
    },
  })
}

export default upsertUser

