import type { DuplicateProject } from '../types/shared'
import { prisma } from './common/commonFunctions'
import { _upsertProject } from './upsertProject'

const duplicateProject: DuplicateProject = async ({ originalProjectId, newProjectData }, email?) => {
  // 元のプロジェクトの情報を取得
  const originalRows = await prisma.ganttRow.findMany({
    where: { projectId: originalProjectId },
    include: { tasks: true },
    orderBy: { order: 'asc' },
  })

  return prisma.$transaction(async (tx) => {
    // 新しいプロジェクトを作成
    const newProject = await _upsertProject(tx, newProjectData, email)

    // 元のGanttRowとGanttTaskを新しいプロジェクトにコピー
    for (const row of originalRows) {
      await tx.ganttRow.create({
        data: {
          name: row.name,
          order: row.order,
          project: {
            connect: { id: newProject.id },
          },
          tasks: {
            create: row.tasks.map((task) => ({
              name: task.name,
              start: task.start,
              end: task.end,
              createdBy: email,
              updatedBy: email,
            })),
          },
          createdBy: email,
          updatedBy: email,
        },
      })
    }

    return newProject.id
  })
}

export default duplicateProject
