import type { SelectCollaborators, User, UserAttribute, Authority } from '../types/shared.js'
import { prisma } from './common/commonFunctions.js'

/**
 * ログインユーザーが所属するプロジェクトのメンバーおよびタスク担当者から、
 * 過去に関わったコラボレーター一覧を自動収集して返す。
 */
const selectCollaborators: SelectCollaborators = async (_, userIdentifier?: string) => {
  if (!userIdentifier) {
    return []
  }

  let userEmail: string | undefined
  let userId: string | undefined

  if (userIdentifier.includes('@')) {
    userEmail = userIdentifier
    const user = await prisma.user.findFirst({
      where: { email: userIdentifier },
      select: { id: true },
    })
    userId = user?.id
  } else {
    userId = userIdentifier
    const user = await prisma.user.findUnique({
      where: { id: userIdentifier },
      select: { email: true },
    })
    userEmail = user?.email || undefined
  }

  const identifiers = [userIdentifier, userEmail, userId].filter(Boolean) as string[]
  if (identifiers.length === 0) {
    return []
  }

  // 1. ログインユーザーが所属するプロジェクトのID一覧を取得
  const userProjects = await prisma.project.findMany({
    where: {
      OR: [
        {
          members: {
            some: {
              OR: [
                ...(userId ? [{ userId }] : []),
                ...(userEmail ? [{ email: userEmail }] : []),
                { userId: userIdentifier },
                { email: userIdentifier },
              ],
            },
          },
        },
        // 互換性フォールバック: authority JSON
        ...identifiers.map((id) => ({
          authority: {
            path: '$.owners',
            array_contains: id,
          },
        })),
        ...identifiers.map((id) => ({
          authority: {
            path: '$.editors',
            array_contains: id,
          },
        })),
        ...identifiers.map((id) => ({
          authority: {
            path: '$.viewers',
            array_contains: id,
          },
        })),
      ],
    },
    select: {
      id: true,
      authority: true,
    },
  })

  if (userProjects.length === 0) {
    return []
  }

  const projectIds = userProjects.map((p) => p.id)
  const candidateIdentifierSet = new Set<string>()

  // 2. 所属プロジェクトの全メンバーを収集
  const members = await prisma.projectMember.findMany({
    where: { projectId: { in: projectIds } },
    select: { userId: true, email: true },
  })
  for (const m of members) {
    if (m.userId) candidateIdentifierSet.add(m.userId)
    if (m.email) candidateIdentifierSet.add(m.email)
  }

  // 3. 所属プロジェクトのタスク担当者を収集
  const assignees = await prisma.taskAssignee.findMany({
    where: { task: { row: { projectId: { in: projectIds } } } },
    select: { userId: true, email: true },
  })
  for (const a of assignees) {
    if (a.userId) candidateIdentifierSet.add(a.userId)
    if (a.email) candidateIdentifierSet.add(a.email)
  }

  // 4. 互換性フォールバック: authority JSON
  for (const p of userProjects) {
    const auth = (p.authority as Authority) || {}
    const authIds = [...(auth.owners || []), ...(auth.editors || []), ...(auth.viewers || [])]
    for (const id of authIds) {
      if (typeof id === 'string' && id.trim()) {
        candidateIdentifierSet.add(id.trim())
      }
    }
  }

  // 自分自身を除外
  for (const id of identifiers) {
    candidateIdentifierSet.delete(id)
  }

  if (candidateIdentifierSet.size === 0) {
    return []
  }

  const emails: string[] = []
  const uids: string[] = []

  for (const id of candidateIdentifierSet) {
    if (id.includes('@')) {
      emails.push(id)
    } else {
      uids.push(id)
    }
  }

  const orConditions: Array<{ id?: { in: string[] }; email?: { in: string[] } }> = []
  if (uids.length > 0) orConditions.push({ id: { in: uids } })
  if (emails.length > 0) orConditions.push({ email: { in: emails } })

  const dbUsers =
    orConditions.length > 0
      ? await prisma.user.findMany({
          where: { OR: orConditions },
          select: {
            id: true,
            email: true,
            displayName: true,
            attribute: true,
          },
        })
      : []

  const resultUserMap = new Map<string, User>()

  for (const u of dbUsers) {
    const userObj: User = {
      id: u.id,
      email: u.email || undefined,
      displayName: u.displayName || undefined,
      attribute: (u.attribute as UserAttribute) || {},
    }
    if (userObj.id) resultUserMap.set(userObj.id, userObj)
    if (userObj.email) resultUserMap.set(userObj.email, userObj)
  }

  // User テーブルに未登録の招待メールアドレスも候補として補完
  for (const email of emails) {
    if (!resultUserMap.has(email)) {
      resultUserMap.set(email, {
        id: email,
        email: email,
        attribute: {},
      })
    }
  }

  // 重複を除去したユニークな User リスト
  const uniqueUsers: User[] = []
  const seenKeys = new Set<string>()

  for (const user of resultUserMap.values()) {
    const key = user.id || user.email
    if (key && !seenKeys.has(key)) {
      seenKeys.add(key)
      if (user.email) seenKeys.add(user.email)
      uniqueUsers.push(user)
    }
  }

  return uniqueUsers
}

export default selectCollaborators
