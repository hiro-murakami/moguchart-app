import type { SelectProject } from '../types/shared'
import { checkProjectPermission, prisma } from './common/commonFunctions'
import { toProject } from './common/converters'

const selectProject: SelectProject = async (projectId, email) => {
  await checkProjectPermission(projectId, email, 'viewer')

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      _count: { select: { comments: true } },
    },
  })

  if (!project) {
    return null
  }

  return toProject(email!)(project)
}

export default selectProject
