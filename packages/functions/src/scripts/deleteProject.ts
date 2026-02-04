import type { DeleteProject } from '../types/shared'
import { prisma } from './common/commonFunctions'

const deleteProject: DeleteProject = async (id) => {
  await prisma.project.delete({
    where: { id },
  })
}

export default deleteProject
