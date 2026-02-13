import type { RestoreProject } from '../types/shared'
import { getCreateCommonColumns, getUpdateCommonColumns, prisma } from './common/commonFunctions'

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
  const { project, rows } = data

  return await prisma.$transaction(async (tx) => {
    // 1. プロジェクトの作成
    const { id: oldProjectId, ...projectData } = project

    // メタデータの更新
    const commonColumns = getCreateCommonColumns(email)

    // 権限設定: 実行ユーザーをオーナーにする
    const newAuthority = {
      owners: [email!],
      editors: [],
      viewers: [],
    }

    const newProject = await tx.project.create({
      data: {
        name: projectData.name, // 必須項目
        start: new Date(projectData.start),
        end: new Date(projectData.end),
        attribute: projectData.attribute ?? {},
        public: false, // 復元時は非公開をデフォルトにする
        authority: newAuthority,
        ...commonColumns,
      },
    })

    const newProjectId = newProject.id
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
          const { id: oldTaskId, ...taskData } = task

          const newTask = await tx.ganttTask.create({
            data: {
              rowId: newRow.id,
              name: taskData.name,
              start: new Date(taskData.start),
              end: new Date(taskData.end),
              attribute: taskData.attribute ?? {}, // 依存関係は後で更新するが、とりあえずそのまま入れる
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
