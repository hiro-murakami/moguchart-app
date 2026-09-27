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
    const authority = (project.authority ?? {}) as Authority
    const owners = authority.owners ?? []
    const editors = authority.editors ?? []
    const viewers = authority.viewers ?? []
    return matchesIdentifier(owners) || matchesIdentifier(editors) || matchesIdentifier(viewers)
  })

  return filtered.map(toProject(userIdentifier || '', userEmail))
}

export default selectProjects
