import type { SelectGanttChart } from '../types/shared'
import { checkProjectPermission, ensureProjectsAclSynced, prisma } from './common/commonFunctions'
import { toGanttRow } from './common/converters'

const selectGanttChart: SelectGanttChart = async (projectId, email) => {
  await checkProjectPermission(projectId, email, 'viewer')

  const projectForAcl = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      public: true,
      authority: true,
      members: { select: { role: true, userId: true, email: true } },
    },
  })
  if (projectForAcl) {
    await ensureProjectsAclSynced([projectForAcl])
  }

  const data = await prisma.ganttRow.findMany({
    where: { projectId },
    include: {
      tasks: {
        include: {
          _count: { select: { comments: true } },
          assignees: true,
        },
      },
      _count: { select: { comments: true } },
    },
    orderBy: { order: 'asc' },
  })
  return data.map(toGanttRow)
}

export default selectGanttChart
