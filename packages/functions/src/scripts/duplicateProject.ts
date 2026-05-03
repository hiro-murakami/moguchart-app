import type { DuplicateProject, Milestone } from '../types/shared'
import { prisma } from './common/commonFunctions'
import { _upsertProject } from './upsertProject'

/**
 * Date または文字列を YYYY-MM-DD 形式の文字列に変換する
 */
const toDateStr = (date: Date | string): string => {
  if (date instanceof Date) {
    return date.toISOString().slice(0, 10)
  }
  return String(date).slice(0, 10)
}

/**
 * 日付(Date or YYYY-MM-DD文字列)に指定した日数を加算した Date オブジェクトを返す
 */
const addDays = (date: Date | string, days: number): Date => {
  const dateStr = toDateStr(date)
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

/**
 * マイルストーン日付文字列に指定した日数を加算する。
 * 元の文字列の形式（YYYY-MM-DD or YYYY-MM-DDTHH:mm 等）を保持する。
 */
const addDaysStrKeepFormat = (dateStr: string, days: number): string => {
  // 日付部分(YYYY-MM-DD)のみ置換し、時刻部分はそのまま保持する
  const datePart = dateStr.slice(0, 10)
  const timePart = dateStr.slice(10) // 'THH:mm' や 'THH:mm:ss' など（なければ空文字）
  const newDatePart = addDays(datePart, days).toISOString().slice(0, 10)
  return newDatePart + timePart
}

/**
 * 2つの日付文字列(YYYY-MM-DD)の差分（日数）を返す (to - from)
 */
const diffDays = (from: string, to: string): number => {
  const f = new Date(from + 'T00:00:00Z')
  const t = new Date(to + 'T00:00:00Z')
  return Math.round((t.getTime() - f.getTime()) / (1000 * 60 * 60 * 24))
}

const duplicateProject: DuplicateProject = async (
  { originalProjectId, newProjectData, newStartDate, clearProgress },
  email?,
) => {
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
          comments: true,
        },
      },
    },
    orderBy: { order: 'asc' },
  })

  // 開始日スライドの差分日数を計算
  const originalStart = toDateStr(project.start)
  const daysDiff = newStartDate ? diffDays(originalStart, newStartDate) : 0

  // マイルストーンの日付をスライド（JSON内の文字列なので addDaysStr を使用）
  if (daysDiff !== 0 && newProjectData.attribute?.milestones) {
    newProjectData = {
      ...newProjectData,
      attribute: {
        ...newProjectData.attribute,
        milestones: newProjectData.attribute.milestones.map((m: Milestone) => ({
          ...m,
          date: m.date ? addDaysStrKeepFormat(m.date, daysDiff) : m.date,
        })),
      },
    }
  }

  return prisma.$transaction(
    async (tx) => {
      // 新しいプロジェクトを作成
      const newProject = await _upsertProject(tx, newProjectData, email)

      // 旧タスクID → 新タスクIDのマッピング（依存関係の更新に使用）
      // dependenciesはstring[]として保存されているため、キーも文字列で扱う
      const taskIdMap = new Map<string, string>()
      // 依存関係を持つ新タスクの情報（後でIDを書き換えるために保持）
      const createdTasksWithDependencies: { newId: number; attribute: any }[] = []

      // 元のGanttRowとGanttTaskを新しいプロジェクトにコピー
      // 各行は順序を保つために逐次処理するが、各行内のタスクは並列で作成する
      for (const row of originalRows) {
        const newRow = await tx.ganttRow.create({
          data: {
            name: row.name,
            order: row.order,
            visible: row.visible,
            attribute: row.attribute ?? {},
            project: {
              connect: { id: newProject.id },
            },
            createdBy: email,
            updatedBy: email,
          },
        })

        // タスクを並列で作成してタイムアウトを回避
        const taskResults = await Promise.all(
          row.tasks.map(async (task) => {
            // タスク属性をコピーし、必要に応じて進捗率をクリア
            const taskAttr = { ...((task.attribute as any) ?? {}) }
            if (clearProgress) {
              delete taskAttr.progress
            }

            const newTask = await tx.ganttTask.create({
              data: {
                name: task.name,
                start: daysDiff !== 0 ? addDays(task.start, daysDiff) : task.start,
                end: daysDiff !== 0 ? addDays(task.end, daysDiff) : task.end,
                attribute: taskAttr,
                rowId: newRow.id,
                comments: {
                  create: task.comments.map((comment) => ({
                    content: comment.content,
                    createdBy: comment.createdBy,
                    updatedBy: comment.updatedBy,
                    createdAt: comment.createdAt,
                    updatedAt: comment.updatedAt,
                  })),
                },
                createdBy: email,
                updatedBy: email,
              },
            })

            return { oldId: String(task.id), newTask, taskAttr }
          }),
        )

        for (const { oldId, newTask, taskAttr } of taskResults) {
          // 旧ID → 新IDのマッピングを記録（文字列として保存する）
          taskIdMap.set(oldId, String(newTask.id))

          // 依存関係を持つタスクは後で更新するために記録
          if (taskAttr.dependencies && Array.isArray(taskAttr.dependencies) && taskAttr.dependencies.length > 0) {
            createdTasksWithDependencies.push({ newId: newTask.id, attribute: taskAttr })
          }
        }
      }

      // 依存関係のIDを新しいタスクIDに書き換える（並列実行）
      await Promise.all(
        createdTasksWithDependencies.map(async ({ newId, attribute }) => {
          // dependenciesはstring[]として保存されているため、文字列として検索する
          const newDependencies = (attribute.dependencies as string[])
            .map((oldId) => taskIdMap.get(String(oldId)))
            .filter((newDepId): newDepId is string => newDepId !== undefined)

          if (newDependencies.length > 0) {
            await tx.ganttTask.update({
              where: { id: newId },
              data: {
                attribute: {
                  ...attribute,
                  dependencies: newDependencies,
                },
                updatedBy: email,
              },
            })
          }
        }),
      )

      return newProject.id
    },
    {
      // 大規模プロジェクトの複製でタイムアウトしないよう30秒に延長
      timeout: 30000,
    },
  )
}

export default duplicateProject
