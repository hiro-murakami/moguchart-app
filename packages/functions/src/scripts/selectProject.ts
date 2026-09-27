import type { SelectProject } from '../types/shared'
import { checkProjectPermission, prisma } from './common/commonFunctions'
import { toProject } from './common/converters'

const selectProject: SelectProject = async (projectId, userIdentifier) => {
  await checkProjectPermission(projectId, userIdentifier, 'viewer')

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      _count: { select: { comments: true } },
    },
  })

  if (!project) {
    return null
  }

  let userEmail: string | undefined
  if (userIdentifier && !userIdentifier.includes('@')) {
    const user = await prisma.user.findUnique({
      where: { id: userIdentifier },
      select: { email: true },
    })
    userEmail = user?.email || undefined
  }

  return toProject(userIdentifier || '', userEmail)(project)
}

export default selectProject
