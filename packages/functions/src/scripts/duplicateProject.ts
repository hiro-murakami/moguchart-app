import type { DuplicateProject } from '../types/shared'
import { prisma } from './common/commonFunctions'
import { _upsertProject } from './upsertProject'

const duplicateProject: DuplicateProject = async ({ originalProjectId, newProjectData }, email?) => {
  // プロジェクト情報の取得
  const project = await prisma.project.findUnique({
    where: { id: originalProjectId },
  })

  if (!project) {
    throw new Error('Project not found')
  }

  // 権限チェック
  if (!project.public) {
    if (!email) {
      throw new Error('Permission denied')
    }

    const authority = (project.authority as any) || {}
    const owners = authority.owners || []
    const editors = authority.editors || []
    const viewers = authority.viewers || []

    const hasAccess = owners.includes(email) || editors.includes(email) || viewers.includes(email)

    if (!hasAccess) {
      throw new Error('Permission denied')
    }
  }

  // 元のプロジェクトの情報を取得
  const originalRows = await prisma.ganttRow.findMany({
    where: { projectId: originalProjectId },
    include: {
      tasks: {
        include: {
          taskComments: true,
        },
      },
    },
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
          visible: row.visible,
          attribute: row.attribute ?? {},
          project: {
            connect: { id: newProject.id },
          },
          tasks: {
            create: row.tasks.map((task) => ({
              name: task.name,
              start: task.start,
              end: task.end,
              attribute: task.attribute ?? {},
              taskComments: {
                create: task.taskComments.map((comment) => ({
                  content: comment.content,
                  createdBy: comment.createdBy,
                  updatedBy: comment.updatedBy,
                  createdAt: comment.createdAt,
                  updatedAt: comment.updatedAt,
                })),
              },
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
