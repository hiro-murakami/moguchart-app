import type { SelectProjects, Authority } from '../types/shared'
import { prisma } from './common/commonFunctions'
import { toProject } from './common/converters'

const selectProjects: SelectProjects = async (_, userIdentifier) => {
  let userEmail: string | undefined
  let userId: string | undefined

  if (userIdentifier) {
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
  }

  const identifiers = [userIdentifier, userEmail, userId].filter(Boolean) as string[]

  const data = await prisma.project.findMany({
    where: {
      OR: [
        { public: true },
        ...(identifiers.length > 0
          ? [
              // ProjectMember テーブルでの一致
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
              // 移行用フォールバック: authority JSON での一致
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
            ]
          : []),
      ],
    },
    orderBy: {
      updatedAt: 'desc',
    },
    include: {
      _count: { select: { comments: true } },
      members: true,
    },
  })

  if (identifiers.length === 0) {
    return data.filter((p) => p.public).map(toProject(''))
  }

  const matchesIdentifier = (list?: string[]) => {
    if (!list) return false
    return identifiers.some((id) => list.includes(id))
  }

  const filtered = data.filter((project) => {
    if (project.public) return true
    // 1. members に含まれるか
    if (project.members && project.members.length > 0) {
      const isMember = project.members.some(
        (m) =>
          identifiers.some((id) => id === m.userId || id === m.email) ||
          (userIdentifier && (m.userId === userIdentifier || m.email === userIdentifier)) ||
          (userEmail && (m.email === userEmail || m.userId === userEmail)),
      )
      if (isMember) return true
    }
    // 2. authority JSON に含まれるか
    const authority = (project.authority ?? {}) as Authority
    const owners = authority.owners ?? []
    const editors = authority.editors ?? []
    const viewers = authority.viewers ?? []
    return matchesIdentifier(owners) || matchesIdentifier(editors) || matchesIdentifier(viewers)
  })

  return filtered.map(toProject(userIdentifier || '', userEmail))
}

export default selectProjects
