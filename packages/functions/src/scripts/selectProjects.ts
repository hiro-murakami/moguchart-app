import type { SelectProjects } from '../types/shared'
import { prisma } from './common/commonFunctions'
import { toProject } from './common/converters'

const selectProjects: SelectProjects = async () => {
  const data = await prisma.project.findMany()
  return data.map(toProject)
}

export default selectProjects
