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

const upsertUser: UpsertUser = async (user, authUid, authContext) => {
  if (!authContext && !authUid) {
    throw new Error('Permission denied: authentication required')
  }

  let targetId: string
  let targetEmail: string | null = null
  let canMigrateLegacyEmailRecord = false

  if (authContext) {
    if (!authContext.uid) {
      throw new Error('Permission denied: invalid authentication context')
    }
    if (user.id && user.id !== authContext.uid) {
      throw new Error('Permission denied: cannot modify other user data')
    }
    targetId = authContext.uid

    if (authContext.isAnonymous || !authContext.emailVerified || !authContext.email) {
      if (user.email) {
        throw new Error('Permission denied: anonymous or unverified user cannot set email')
      }
      targetEmail = null
    } else {
      if (user.email && user.email.toLowerCase() !== authContext.email.toLowerCase()) {
        throw new Error('Permission denied: cannot modify other user email')
      }
      targetEmail = authContext.email
      canMigrateLegacyEmailRecord = true
    }
  } else {
    // REST API (X-API-Key) 等の authUid / email 文字列による認証経路
    const identifier = authUid!
    if (identifier.includes('@')) {
      const existingUser = await prisma.user.findFirst({
        where: { email: identifier },
      })
      if (existingUser) {
        if (user.id && user.id !== existingUser.id) {
          throw new Error('Permission denied: cannot modify other user data')
        }
        if (user.email && user.email.toLowerCase() !== identifier.toLowerCase()) {
          throw new Error('Permission denied: cannot modify other user email')
        }
        targetId = existingUser.id
        targetEmail = existingUser.email
      } else {
        if (user.id && user.id !== identifier) {
          throw new Error('Permission denied: cannot modify other user data')
        }
        if (user.email && user.email.toLowerCase() !== identifier.toLowerCase()) {
          throw new Error('Permission denied: cannot modify other user email')
        }
        targetId = identifier
        targetEmail = identifier
      }
    } else {
      if (user.id && user.id !== identifier) {
        throw new Error('Permission denied: cannot modify other user data')
      }
      const existingUser = await prisma.user.findUnique({
        where: { id: identifier },
      })
      if (
        user.email &&
        (!existingUser?.email || user.email.toLowerCase() !== existingUser.email.toLowerCase())
      ) {
        throw new Error('Permission denied: cannot modify email without verified token')
      }
      targetId = identifier
      targetEmail = existingUser?.email ?? null
    }
  }

  // 更新前に削除済みプロジェクトの設定をクリーンアップ
  const attribute = (user.attribute || {}) as UserAttribute
  if (attribute.projectSettings && Object.keys(attribute.projectSettings).length > 0) {
    attribute.projectSettings = (await cleanupDeletedProjectSettings(
      attribute.projectSettings as Record<string, unknown>,
    )) as UserAttribute['projectSettings']
  }

  const actor = targetEmail || targetId
  const displayName = typeof user.displayName === 'string' ? user.displayName : null

  await prisma.$transaction(async (tx) => {
    // 移行支援: 正規のメール検証済みトークンを持つ本人がログインした際のみ、
    // 同一メールアドレスで旧IDを持つレコードをCascade消失なく安全に引き継ぐ
    if (canMigrateLegacyEmailRecord && targetEmail) {
      const existingByEmail = await tx.user.findFirst({
        where: { email: targetEmail },
      })
      if (existingByEmail && existingByEmail.id !== targetId) {
        await tx.projectMember.updateMany({
          where: { userId: existingByEmail.id },
          data: { userId: null, email: targetEmail },
        })
        await tx.taskAssignee.updateMany({
          where: { userId: existingByEmail.id },
          data: { userId: null, email: targetEmail },
        })
        await tx.user.delete({
          where: { id: existingByEmail.id },
        })
      }
    }

    await tx.user.upsert({
      where: { id: targetId },
      update: {
        email: targetEmail,
        displayName,
        attribute: attribute as any,
        ...getUpdateCommonColumns(actor),
      },
      create: {
        id: targetId,
        email: targetEmail,
        displayName,
        attribute: attribute as any,
        ...getCreateCommonColumns(actor),
      },
    })

    // 未登録メールアドレスで招待・割り当てされていたメンバー・担当者レコードに自身の UID を自動紐付け
    if (targetEmail) {
      await tx.projectMember.updateMany({
        where: {
          email: targetEmail,
          userId: null,
        },
        data: {
          userId: targetId,
        },
      })

      await tx.taskAssignee.updateMany({
        where: {
          email: targetEmail,
          userId: null,
        },
        data: {
          userId: targetId,
        },
      })
    }
  })
}

export default upsertUser

