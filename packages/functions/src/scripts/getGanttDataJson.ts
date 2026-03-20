import { VERSION, type GetGanttDataJson } from '../types/shared'
import { prisma, toDateTimeString } from './common/commonFunctions'

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
        if ((key === 'start' || key === 'end') && obj[key] instanceof Date) {
          newObj[key] = toDateTimeString(obj[key])
        } else {
          newObj[key] = convertDatesToIsoString(obj[key])
        }
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

  // プロジェクト情報の取得（プロジェクトコメントも含む）
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      comments: true,
    },
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

  // ガントチャートデータの取得（行コメント・タスクコメントも含む）
  const rows = await prisma.ganttRow.findMany({
    where: { projectId },
    include: {
      comments: true,
      tasks: {
        include: {
          comments: true,
        },
      },
    },
    orderBy: { order: 'asc' },
  })

  // 全コメントからメールアドレスを収集してUser情報を取得
  const allEmails = new Set<string>()
  if (project.comments) {
    for (const c of project.comments) {
      if (c.createdBy) allEmails.add(c.createdBy)
    }
  }
  for (const row of rows) {
    if (row.comments) {
      for (const c of row.comments) {
        if (c.createdBy) allEmails.add(c.createdBy)
      }
    }
    if (row.tasks) {
      for (const task of row.tasks) {
        if (task.comments) {
          for (const c of task.comments) {
            if (c.createdBy) allEmails.add(c.createdBy)
          }
        }
      }
    }
  }

  const users = allEmails.size > 0
    ? await prisma.user.findMany({ where: { email: { in: Array.from(allEmails) } } })
    : []
  const userMap = new Map(users.map((u) => [u.email, u]))

  // コメントにdisplayName/photoURLを付与するヘルパー
  const enrichComment = (c: any) => {
    const user = c.createdBy ? userMap.get(c.createdBy) : undefined
    return {
      ...c,
      createdByDisplayName: user?.displayName ?? undefined,
      createdByPhotoURL: (() => {
        try {
          const attr = user?.attribute as Record<string, any> | undefined
          return attr?.photoURL
        } catch {
          return undefined
        }
      })(),
    }
  }

  // コメントを拡張したデータを生成
  const enrichedProject = {
    ...project,
    comments: project.comments?.map(enrichComment) ?? [],
  }

  const enrichedRows = rows.map((row) => ({
    ...row,
    comments: row.comments?.map(enrichComment) ?? [],
    tasks: row.tasks.map((task) => ({
      ...task,
      comments: task.comments?.map(enrichComment) ?? [],
    })),
  }))

  return {
    version: VERSION,
    project: convertDatesToIsoString(enrichedProject),
    rows: convertDatesToIsoString(enrichedRows),
  }
}

export default getGanttDataJson
