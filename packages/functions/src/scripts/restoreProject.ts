import type { RestoreProject } from '../types/shared'
import { getCreateCommonColumns, getUpdateCommonColumns, prisma } from './common/commonFunctions'
import AdmZip from 'adm-zip'

// 依存関係のIDを書き換えるためのヘルパー
const updateDependencies = (attribute: any, taskIdMap: Map<number, number>): any => {
  if (!attribute || !attribute.dependencies || !Array.isArray(attribute.dependencies)) {
    return attribute
  }

  const newDependencies = attribute.dependencies
    .map((oldId: number) => taskIdMap.get(oldId))
    .filter((newId: number | undefined) => newId !== undefined)

  return {
    ...attribute,
    dependencies: newDependencies,
  }
}

const restoreProject: RestoreProject = async (data, email) => {
  let projectData: any

  if ('zipBase64' in data && data.zipBase64) {
    // zipBase64が含まれている場合はzip展開してJSONを取り出す
    const zipBuffer = Buffer.from(data.zipBase64, 'base64')
    const zip = new AdmZip(zipBuffer)
    const entries = zip.getEntries()
    const jsonEntry = entries.find((e) => e.entryName.endsWith('.json'))
    if (!jsonEntry) {
      throw new Error('zipファイル内にJSONファイルが見つかりませんでした')
    }
    const jsonString = jsonEntry.getData().toString('utf8')
    projectData = JSON.parse(jsonString)
  } else {
    projectData = data
  }

  const { project, rows, force, newId } = { ...projectData, force: data.force, newId: (data as any).newId }

  return await prisma.$transaction(async (tx) => {
    // 1. プロジェクトの作成または更新
    const { id: oldProjectId, ...projectData } = project

    // メタデータの更新
    const commonColumns = getCreateCommonColumns(email)

    // 権限設定: 実行ユーザーをオーナーにする
    const newAuthority = {
      owners: [email!],
      editors: [],
      viewers: [],
    }

    // 既存プロジェクトのチェック
    let newProjectId: string
    const existingProject = await tx.project.findUnique({
      where: { id: oldProjectId },
    })

    if (existingProject) {
      if (newId) {
        // 別のIDで新規作成（IDを自動生成）
        const newProject = await tx.project.create({
          data: {
            name: `${projectData.name}のコピー`,
            start: new Date(projectData.start),
            end: new Date(projectData.end),
            attribute: projectData.attribute ?? {},
            public: false,
            authority: newAuthority,
            ...commonColumns,
          },
        })
        newProjectId = newProject.id
      } else if (force) {
        // 既存プロジェクトを上書き
        await tx.project.update({
          where: { id: oldProjectId },
          data: {
            name: projectData.name,
            start: new Date(projectData.start),
            end: new Date(projectData.end),
            attribute: projectData.attribute ?? {},
            public: false,
            authority: newAuthority,
            ...getUpdateCommonColumns(email),
          },
        })
        newProjectId = oldProjectId

        // 既存の行を削除（Cascade でタスクも消えるはずだが、念のため）
        await tx.ganttRow.deleteMany({
          where: { projectId: newProjectId },
        })
      } else {
        throw new Error('PROJECT_EXISTS')
      }
    } else {
      // 新規作成（IDを指定して作成）
      const newProject = await tx.project.create({
        data: {
          id: oldProjectId, // 元のIDを使用
          name: projectData.name,
          start: new Date(projectData.start),
          end: new Date(projectData.end),
          attribute: projectData.attribute ?? {},
          public: false,
          authority: newAuthority,
          ...commonColumns,
        },
      })
      newProjectId = newProject.id
    }

    const taskIdMap = new Map<number, number>()
    const createdTasks: { newId: number; attribute: any }[] = []

    // 2. 行とタスクの作成
    // 行の順序を維持するために for...of を使用
    for (const row of rows) {
      const { id: oldRowId, tasks, ...rowData } = row

      const newRow = await tx.ganttRow.create({
        data: {
          projectId: newProjectId,
          name: rowData.name,
          order: rowData.order,
          visible: rowData.visible,
          attribute: rowData.attribute ?? {},
          ...commonColumns,
        },
      })

      if (tasks && Array.isArray(tasks)) {
        for (const task of tasks) {
          const { id: oldTaskId, taskComments, ...taskData } = task

          const newTask = await tx.ganttTask.create({
            data: {
              rowId: newRow.id,
              name: taskData.name,
              start: new Date(taskData.start),
              end: new Date(taskData.end),
              attribute: taskData.attribute ?? {}, // 依存関係は後で更新するが、とりあえずそのまま入れる
              taskComments:
                taskComments && Array.isArray(taskComments)
                  ? {
                      create: taskComments.map((comment: any) => ({
                        content: comment.content,
                        createdBy: comment.createdBy || email,
                        updatedBy: comment.updatedBy || email,
                        createdAt: comment.createdAt ? new Date(comment.createdAt) : new Date(),
                        updatedAt: comment.updatedAt ? new Date(comment.updatedAt) : new Date(),
                      })),
                    }
                  : undefined,
              ...commonColumns,
            },
          })

          taskIdMap.set(oldTaskId, newTask.id)
          createdTasks.push({ newId: newTask.id, attribute: taskData.attribute })
        }
      }
    }

    // 3. 依存関係のID更新
    // 依存関係がある場合、新しいタスクIDに書き換えて更新する
    for (const { newId, attribute } of createdTasks) {
      if (
        attribute &&
        attribute.dependencies &&
        Array.isArray(attribute.dependencies) &&
        attribute.dependencies.length > 0
      ) {
        const newAttribute = updateDependencies(attribute, taskIdMap)

        await tx.ganttTask.update({
          where: { id: newId },
          data: {
            attribute: newAttribute,
            ...getUpdateCommonColumns(email),
          },
        })
      }
    }

    return newProjectId
  })
}

export default restoreProject
