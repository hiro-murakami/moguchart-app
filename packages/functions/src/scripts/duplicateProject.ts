import type { DuplicateProject, Milestone } from '../types/shared'
import { prisma } from './common/commonFunctions'
import { _upsertProject } from './upsertProject'

/**
 * Date または文字列を UTC の Date としてパースする
 */
const toUtcDate = (dateStr: string | Date): Date => {
  if (dateStr instanceof Date) return dateStr
  if (/[Z+\-]\d{2}:?\d{2}$/.test(dateStr) || dateStr.endsWith('Z')) {
    return new Date(dateStr)
  }
  // TZなし文字列をUTCとして解釈
  if (dateStr.length === 10) return new Date(`${dateStr}T00:00:00Z`)
  if (dateStr.length === 7) return new Date(`${dateStr}-01T00:00:00Z`)
  return new Date(`${dateStr}Z`)
}

/**
 * 2つの日付の差分（ミリ秒）を返す (to - from)
 */
const diffMs = (from: string | Date, to: string | Date): number => {
  return toUtcDate(to).getTime() - toUtcDate(from).getTime()
}

/**
 * 日付(Date or 文字列)に指定したミリ秒を加算した Date オブジェクトを返す
 */
const addMs = (date: Date | string, ms: number): Date => {
  return new Date(toUtcDate(date).getTime() + ms)
}

/**
 * マイルストーン日付文字列に指定したミリ秒を加算する。
 * 元の文字列の形式（YYYY-MM-DD や YYYY-MM-DDTHH:mm 等）を保持する。
 */
const addMsStrKeepFormat = (dateStr: string, ms: number): string => {
  if (!dateStr) return dateStr
  const newD = addMs(dateStr, ms)
  const iso = newD.toISOString()
  if (dateStr.length === 7) return iso.slice(0, 7) // YYYY-MM
  if (dateStr.length === 10) return iso.slice(0, 10) // YYYY-MM-DD
  if (dateStr.length === 16) return iso.slice(0, 16) // YYYY-MM-DDTHH:mm
  if (dateStr.length === 19) return iso.slice(0, 19) // YYYY-MM-DDTHH:mm:ss
  return iso
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

  // 開始日スライドの差分ミリ秒を計算
  const msDiff = newStartDate ? diffMs(project.start, newStartDate) : 0

  // マイルストーンの日付をスライド（JSON内の文字列なので addMsStrKeepFormat を使用）
  if (msDiff !== 0 && newProjectData.attribute?.milestones) {
    newProjectData = {
      ...newProjectData,
      attribute: {
        ...newProjectData.attribute,
        milestones: newProjectData.attribute.milestones.map((m: Milestone) => ({
          ...m,
          datetime: m.datetime ? addMsStrKeepFormat(m.datetime, msDiff) : m.datetime,
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
                start: msDiff !== 0 ? addMs(task.start, msDiff) : task.start,
                end: msDiff !== 0 ? addMs(task.end, msDiff) : task.end,
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
