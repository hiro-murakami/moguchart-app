import type { SelectProjects } from '../types/shared'
import { prisma } from './common/commonFunctions'
import { toProject } from './common/converters'

const selectProjects: SelectProjects = async (_, email) => {
  const data = await prisma.project.findMany({
    where: {
      OR: [
        { public: true },
        {
          // owners 配列に含まれているか
          authority: {
            path: '$.owners',
            array_contains: email,
          },
        },
        {
          // editors 配列に含まれているか
          authority: {
            path: '$.editors',
            array_contains: email,
          },
        },
        {
          // viewers 配列に含まれているか
          authority: {
            path: '$.viewers',
            array_contains: email,
          },
        },
      ],
    },
    orderBy: {
      updatedAt: 'desc',
    },
  })
  return data.map(toProject(email!))
}

export default selectProjects
