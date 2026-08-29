import type { SelectProjects, Authority } from '../types/shared'
import { prisma } from './common/commonFunctions'
import { toProject } from './common/converters'

const selectProjects: SelectProjects = async (_, email) => {
  const data = await prisma.project.findMany({
    where: {
      OR: [
        { public: true },
        ...(email
          ? [
              {
                authority: {
                  path: '$.owners',
                  array_contains: email,
                },
              },
              {
                authority: {
                  path: '$.editors',
                  array_contains: email,
                },
              },
              {
                authority: {
                  path: '$.viewers',
                  array_contains: email,
                },
              },
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

  if (!email) {
    return data.filter((p) => p.public).map(toProject(''))
  }

  const filtered = data.filter((project) => {
    if (project.public) return true
    const authority = (project.authority ?? {}) as Authority
    const owners = authority.owners ?? []
    const editors = authority.editors ?? []
    const viewers = authority.viewers ?? []
    return owners.includes(email) || editors.includes(email) || viewers.includes(email)
  })

  return filtered.map(toProject(email))
}

export default selectProjects
