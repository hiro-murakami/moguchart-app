import { VERSION, type GetGanttDataJson } from '../types/shared'
import { prisma } from './common/commonFunctions'

const convertDatesToIsoString = (obj: any): any => {
  if (obj === null || obj === undefined) {
    return obj
  }

  if (obj instanceof Date) {
    return obj.toISOString()
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => convertDatesToIsoString(item))
  }

  if (typeof obj === 'object') {
    const newObj: any = {}
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        newObj[key] = convertDatesToIsoString(obj[key])
      }
    }
    return newObj
  }

  return obj
}

const getGanttDataJson: GetGanttDataJson = async (projectId, email) => {
  if (!projectId) {
    throw new Error('Project ID is required')
  }

  // プロジェクト情報の取得
  const project = await prisma.project.findUnique({
    where: { id: projectId },
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

  // ガントチャートデータの取得
  const rows = await prisma.ganttRow.findMany({
    where: { projectId },
    include: {
      tasks: {
        include: {
          taskComments: true,
        },
      },
    },
    orderBy: { order: 'asc' },
  })

  return {
    version: VERSION,
    project: convertDatesToIsoString(project),
    rows: convertDatesToIsoString(rows),
  }
}

export default getGanttDataJson
