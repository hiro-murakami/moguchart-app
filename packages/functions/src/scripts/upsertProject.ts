import { PrismaClient } from '../generated/prisma/client'
import type { UpsertProject } from '../types/shared'
import { checkProjectPermission, getCreateCommonColumns, getUpdateCommonColumns, prisma } from './common/commonFunctions'

type PrismaTransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>

export const _upsertProject = async (
  prismaClient: PrismaTransactionClient,
  project: Parameters<UpsertProject>[0],
  email?: string,
) => {
  // Prisma の update に渡せないフィールドを除外
  // _count: Prisma の集計フィールド、commentCount: フロントエンド用の仮想フィールド
  const { id, role, _count, commentCount, ...data } = project as any
  const isNew = !id

  if (isNew) {
    data.authority = {
      owners: [email!],
      editors: [],
      viewers: [],
    }
  }

  /**
   * TZなし文字列（"YYYY-MM-DDTHH:mm:ss"）をUTCのDateとして解釈する。
   * new Date("2025-05-03T03:00:00") はサーバーのローカルTZで解釈されるため、
   * 末尾に "Z" を付けてUTCとして明示的にパースする。
   */
  const toUtcDate = (dateStr: string): Date => {
    // 既にTZ情報が含まれている場合はそのまま使う
    if (/[Z+\-]\d{2}:?\d{2}$/.test(dateStr) || dateStr.endsWith('Z')) {
      return new Date(dateStr)
    }
    // TZなし → UTC として扱う（末尾に "Z" を追加）
    return new Date(`${dateStr}Z`)
  }

  const dataForDb = {
    ...data,
    start: toUtcDate(data.start),
    end: toUtcDate(data.end),
    attribute: data.attribute,
    authority: data.authority,
  }


  if (isNew) {
    // 新規作成
    const result = await prismaClient.project.create({
      data: {
        ...dataForDb,
        ...getCreateCommonColumns(email),
      },
    })
    if (data.authority) {
      await syncProjectMembers(prismaClient, result.id, data.authority as any)
    }
    return result
  } else {
    // 更新
    const result = await prismaClient.project.update({
      where: { id },
      data: { ...dataForDb, ...getUpdateCommonColumns(email) },
    })
    if (data.authority) {
      await syncProjectMembers(prismaClient, id, data.authority as any)
    }
    return result
  }
}

export const syncProjectMembers = async (
  prismaClient: PrismaTransactionClient,
  projectId: string,
  authority: { owners?: string[]; editors?: string[]; viewers?: string[] },
) => {
  const roles: Array<{ role: 'owner' | 'editor' | 'viewer'; list?: string[] }> = [
    { role: 'owner', list: authority.owners },
    { role: 'editor', list: authority.editors },
    { role: 'viewer', list: authority.viewers },
  ]

  const newMembers: Array<{ role: string; userId: string | null; email: string | null }> = []
  for (const { role, list } of roles) {
    if (!Array.isArray(list)) continue
    for (const identifier of list) {
      if (typeof identifier !== 'string' || !identifier.trim()) continue
      const trimmed = identifier.trim()
      let userId: string | null = null
      let email: string | null = null

      if (trimmed.includes('@')) {
        email = trimmed
        const user = await prismaClient.user.findFirst({
          where: { email: trimmed },
          select: { id: true },
        })
        if (user) userId = user.id
      } else {
        userId = trimmed
        const user = await prismaClient.user.findUnique({
          where: { id: trimmed },
          select: { email: true },
        })
        if (user?.email) email = user.email
      }
      newMembers.push({ role, userId, email })
    }
  }

  // 同一ユーザー（userId または email が一致）の重複を排除
  const uniqueMembers: Array<{ role: string; userId: string | null; email: string | null }> = []
  for (const m of newMembers) {
    const isDuplicate = uniqueMembers.some((existing) => {
      if (m.userId && existing.userId && m.userId === existing.userId) return true
      if (m.email && existing.email && m.email === existing.email) return true
      return false
    })
    if (!isDuplicate) {
      uniqueMembers.push(m)
    }
  }

  // 既存のメンバーレコードを削除して再投入
  await prismaClient.projectMember.deleteMany({
    where: { projectId },
  })

  for (const m of uniqueMembers) {
    await prismaClient.projectMember.create({
      data: {
        projectId,
        userId: m.userId,
        email: m.email,
        role: m.role,
      },
    })
  }
}

const upsertProject: UpsertProject = async (project, email) => {
  // 更新時はownerのみ許可
  if (project.id) {
    await checkProjectPermission(project.id, email, 'owner')
  }

  const result = await _upsertProject(prisma, project, email)
  return result.id
}

export default upsertProject
