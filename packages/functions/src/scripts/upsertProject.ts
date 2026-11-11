import crypto from 'node:crypto'
import { PrismaClient } from '../generated/prisma/client'
import type { Authority, UpsertProject } from '../types/shared'
import {
  checkProjectPermission,
  getCreateCommonColumns,
  getUpdateCommonColumns,
  prisma,
  syncProjectAclToFirestore,
} from './common/commonFunctions'

type PrismaTransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>

const sanitizeStringList = (list: unknown): string[] => {
  if (!Array.isArray(list)) return []
  return Array.from(
    new Set(
      list
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  )
}

export const sanitizeAuthority = (
  rawAuthority: unknown,
  fallbackOwner: string,
): Required<Authority> => {
  const obj = (rawAuthority && typeof rawAuthority === 'object' ? rawAuthority : {}) as Authority
  const owners = sanitizeStringList(obj.owners)
  const editors = sanitizeStringList(obj.editors)
  const viewers = sanitizeStringList(obj.viewers)
  return {
    owners: owners.length > 0 ? owners : [fallbackOwner],
    editors,
    viewers,
  }
}

export const _upsertProject = async (
  prismaClient: PrismaTransactionClient,
  project: Parameters<UpsertProject>[0],
  email?: string,
  options?: { forceCreate?: boolean },
) => {
  if (!email) {
    throw new Error('Permission denied')
  }
  if (!project || typeof project.name !== 'string' || !project.name.trim()) {
    throw new Error('Project name is required')
  }

  const isNew = Boolean(options?.forceCreate || !project.id)

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

  const startDate = toUtcDate(project.start)
  const endDate = toUtcDate(project.end)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new Error('Invalid project start or end date')
  }

  const safeAttribute =
    project.attribute && typeof project.attribute === 'object' && !Array.isArray(project.attribute)
      ? project.attribute
      : {}

  if (isNew) {
    const newAuthority: Required<Authority> = {
      owners: [email],
      editors: [],
      viewers: [],
    }
    // 新規作成: サーバー側で常に新しいUUIDを採番し、許可されたフィールドのみ保存（Mass Assignment防止）
    const result = await prismaClient.project.create({
      data: {
        id: crypto.randomUUID(),
        name: project.name,
        start: startDate,
        end: endDate,
        public: Boolean(project.public),
        attribute: safeAttribute as any,
        authority: newAuthority,
        ...getCreateCommonColumns(email),
      },
    })
    await syncProjectMembers(prismaClient, result.id, newAuthority)
    return result
  } else {
    const updatedAuthority =
      project.authority !== undefined ? sanitizeAuthority(project.authority, email) : undefined
    // 更新: 許可されたフィールドのみ明示的に指定
    const result = await prismaClient.project.update({
      where: { id: project.id },
      data: {
        name: project.name,
        start: startDate,
        end: endDate,
        public: Boolean(project.public),
        attribute: safeAttribute as any,
        ...(updatedAuthority ? { authority: updatedAuthority } : {}),
        ...getUpdateCommonColumns(email),
      },
    })
    if (updatedAuthority) {
      await syncProjectMembers(prismaClient, project.id, updatedAuthority)
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
  if (!email) {
    throw new Error('Permission denied')
  }

  // 更新時はownerのみ許可
  if (project.id) {
    await checkProjectPermission(project.id, email, 'owner')
  }

  const result = await prisma.$transaction((tx) => _upsertProject(tx, project, email))
  await syncProjectAclToFirestore(result.id)
  return result.id
}

export default upsertProject
