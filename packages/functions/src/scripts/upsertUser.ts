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

const upsertUser: UpsertUser = async (user, email) => {
  // 更新前に削除済みプロジェクトの設定をクリーンアップ
  const attribute = user.attribute as UserAttribute
  if (attribute.projectSettings && Object.keys(attribute.projectSettings).length > 0) {
    attribute.projectSettings = (await cleanupDeletedProjectSettings(
      attribute.projectSettings as Record<string, unknown>,
    )) as UserAttribute['projectSettings']
  }

  await prisma.user.upsert({
    where: { email: user.email },
    update: {
      ...user,
      ...getUpdateCommonColumns(email),
    },
    create: {
      ...user,
      ...getCreateCommonColumns(email),
    },
  })
}

export default upsertUser
