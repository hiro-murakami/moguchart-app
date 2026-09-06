import type { RestoreProject } from '../types/shared'
import { getCreateCommonColumns, getUpdateCommonColumns, getStorageBucket, prisma } from './common/commonFunctions'
import AdmZip from 'adm-zip'
import crypto from 'node:crypto'

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

// スナップショットをCloud Storageに復元するヘルパー
const restoreSnapshots = async (zip: AdmZip, projectId: string) => {
  const snapshotEntries = zip.getEntries().filter(
    (e) => e.entryName.startsWith('snapshots/') && e.entryName.endsWith('.json.zip')
  )

  if (snapshotEntries.length === 0) return

  // メタデータを読み込み
  const metadataEntry = zip.getEntries().find(
    (e) => e.entryName === 'snapshots/metadata.json'
  )
  let metadataList: Array<{
    fileName: string
    displayName?: string
    createdAt?: string
  }> = []
  if (metadataEntry) {
    try {
      metadataList = JSON.parse(metadataEntry.getData().toString('utf8'))
    } catch {
      // メタデータのパースに失敗した場合は空のまま
    }
  }

  const bucket = getStorageBucket()

  for (const entry of snapshotEntries) {
    const snapshotFileName = entry.entryName.replace('snapshots/', '')
    const storagePath = `snapshots/${projectId}/${snapshotFileName}`
    const file = bucket.file(storagePath)

    const downloadToken = crypto.randomUUID()
    const metadata = metadataList.find((m) => m.fileName === snapshotFileName)

    const customMetadata: Record<string, string> = {
      firebaseStorageDownloadTokens: downloadToken,
    }
    if (metadata?.displayName) {
      customMetadata.displayName = metadata.displayName
    }

    const fileBuffer = entry.getData()
    await file.save(fileBuffer, {
      metadata: {
        contentType: 'application/zip',
        metadata: customMetadata,
      },
    })
  }
}

// Firebase StorageのダウンロードURLを構築するヘルパー
const buildDownloadUrl = (bucketName: string, storagePath: string, token: string): string => {
  const emulatorHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST || process.env.STORAGE_EMULATOR_HOST
  const encodedPath = encodeURIComponent(storagePath)
  if (emulatorHost) {
    return `http://${emulatorHost}/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${token}`
  }
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${token}`
}

// 画像をCloud Storageに復元し、ファイル名 → 新ダウンロードURL のマッピングを返すヘルパー
const restoreImages = async (zip: AdmZip, projectId: string): Promise<Map<string, string>> => {
  const urlMap = new Map<string, string>()
  const imageEntries = zip.getEntries().filter(
    (e) => e.entryName.startsWith('images/') && !e.isDirectory && e.entryName !== 'images/metadata.json'
  )

  if (imageEntries.length === 0) return urlMap

  // メタデータを読み込み
  const metadataEntry = zip.getEntries().find((e) => e.entryName === 'images/metadata.json')
  let metadataList: Array<{
    fileName: string
    contentType?: string
    createdAt?: string
  }> = []
  if (metadataEntry) {
    try {
      metadataList = JSON.parse(metadataEntry.getData().toString('utf8'))
    } catch {
      // メタデータのパースに失敗した場合は空のまま
    }
  }

  const bucket = getStorageBucket()


  for (const entry of imageEntries) {
    const imageFileName = entry.entryName.replace('images/', '')
    if (!imageFileName) continue

    const storagePath = `images/${projectId}/${imageFileName}`
    const file = bucket.file(storagePath)

    const downloadToken = crypto.randomUUID()
    const meta = metadataList.find((m) => m.fileName === imageFileName)

    const fileBuffer = entry.getData()
    await file.save(fileBuffer, {
      metadata: {
        contentType: meta?.contentType || 'image/png',
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
        },
      },
    })

    const downloadUrl = buildDownloadUrl(bucket.name, storagePath, downloadToken)
    urlMap.set(imageFileName, downloadUrl)
  }

  return urlMap
}

// 画像URLリスト内のURLを新しいダウンロードURLに更新するヘルパー
const updateImageUrls = (imageUrls: any[], urlMap: Map<string, string>): string[] => {
  if (!Array.isArray(imageUrls)) return imageUrls
  return imageUrls.map((url) => {
    if (typeof url !== 'string') return url
    for (const [fileName, newUrl] of urlMap.entries()) {
      if (url.includes(encodeURIComponent(fileName)) || url.includes(fileName)) {
        return newUrl
      }
    }
    return url
  })
}

// UUID v4 形式かどうかを判定するヘルパー
const isUUID = (value: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

const restoreProject: RestoreProject = async (data, email) => {
  let projectData: any
  let zipInstance: AdmZip | undefined

  if ('zipBase64' in data && data.zipBase64) {
    // zipBase64が含まれている場合はzip展開してJSONを取り出す
    const zipBuffer = Buffer.from(data.zipBase64, 'base64')
    const zip = new AdmZip(zipBuffer)
    zipInstance = zip
    const entries = zip.getEntries()
    const jsonEntry = entries.find(
      (e) =>
        e.entryName.endsWith('.json') &&
        !e.entryName.startsWith('snapshots/') &&
        !e.entryName.startsWith('snapshots\\') &&
        !e.entryName.startsWith('images/') &&
        !e.entryName.startsWith('images\\')
    )
    if (!jsonEntry) {
      throw new Error('zipファイル内にJSONファイルが見つかりませんでした')
    }
    const jsonString = jsonEntry.getData().toString('utf8')
    projectData = JSON.parse(jsonString)
  } else {
    projectData = data
  }

  if (!projectData || !projectData.project || !projectData.rows) {
    throw new Error('復元データの形式が不正です（projectまたはrowsが見つかりません）')
  }

  const { project, rows, force, newId } = { ...projectData, force: data.force, newId: (data as any).newId }

  const newProjectId = await prisma.$transaction(async (tx) => {
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

    // oldProjectIdがUUID形式でない場合は新しいUUIDを採番
    const isValidUUID = isUUID(oldProjectId)

    // 既存プロジェクトのチェック（UUID形式の場合のみ）
    let newProjectId: string
    const existingProject = isValidUUID
      ? await tx.project.findUnique({
          where: { id: oldProjectId },
        })
      : null // UUID形式でない場合は既存チェックをスキップ

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

        // 既存データを依存関係の順序で削除
        // 1. プロジェクトコメントを削除
        await tx.comment.deleteMany({
          where: { projectId: newProjectId },
        })
        // 2. タスクに紐づくコメントを削除
        await tx.comment.deleteMany({
          where: {
            task: { row: { projectId: newProjectId } },
          },
        })
        // 3. 行に紐づくコメントを削除
        await tx.comment.deleteMany({
          where: {
            row: { projectId: newProjectId },
          },
        })
        // 4. タスクを削除
        await tx.ganttTask.deleteMany({
          where: { row: { projectId: newProjectId } },
        })
        // 5. 行を削除
        await tx.ganttRow.deleteMany({
          where: { projectId: newProjectId },
        })
      } else {
        throw new Error('PROJECT_EXISTS')
      }
    } else {
      // 新規作成
      // UUID形式の場合は元のIDを使用、そうでない場合は新しいUUIDを採番
      const projectId = isValidUUID ? oldProjectId : crypto.randomUUID()
      const newProject = await tx.project.create({
        data: {
          id: projectId,
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
    const rowIdMap = new Map<number, number>()
    const createdRowsWithParentId: { newId: number; oldParentId: number; attribute: any }[] = []

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

      rowIdMap.set(oldRowId, newRow.id)
      const oldParentId = (rowData.attribute as any)?.parentId
      if (oldParentId != null) {
        createdRowsWithParentId.push({
          newId: newRow.id,
          oldParentId: Number(oldParentId),
          attribute: rowData.attribute,
        })
      }

      if (tasks && Array.isArray(tasks)) {
        for (const task of tasks) {
          const { id: oldTaskId, comments: taskComments, ...taskData } = task

          const newTask = await tx.ganttTask.create({
            data: {
              rowId: newRow.id,
              name: taskData.name,
              start: new Date(taskData.start),
              end: new Date(taskData.end),
              attribute: taskData.attribute ?? {}, // 依存関係は後で更新するが、とりあえずそのまま入れる
              comments:
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

    // 4. 行の親子関係（parentId）のID更新
    for (const { newId, oldParentId, attribute } of createdRowsWithParentId) {
      const newParentId = rowIdMap.get(oldParentId)
      if (newParentId != null) {
        await tx.ganttRow.update({
          where: { id: newId },
          data: {
            attribute: {
              ...attribute,
              parentId: newParentId,
            },
            ...getUpdateCommonColumns(email),
          },
        })
      }
    }

    return newProjectId
  }, { timeout: 60000 }) // 大量データの復元に対応するためタイムアウトを60秒に設定

  // トランザクション完了後にスナップショットを復元
  if (zipInstance) {
    const hasSnapshots = zipInstance.getEntries().some(
      (e) => e.entryName.startsWith('snapshots/') && e.entryName.endsWith('.json.zip')
    )
    if (hasSnapshots) {
      try {
        await restoreSnapshots(zipInstance, newProjectId)
      } catch (e) {
        console.warn('Failed to restore snapshots:', e)
      }
    }

    const hasImages = zipInstance.getEntries().some(
      (e) => e.entryName.startsWith('images/') && !e.isDirectory && e.entryName !== 'images/metadata.json'
    )
    if (hasImages) {
      try {
        const urlMap = await restoreImages(zipInstance, newProjectId)
        if (urlMap.size > 0) {
          // 行の画像URLを更新
          const rows = await prisma.ganttRow.findMany({
            where: { projectId: newProjectId },
            select: { id: true, attribute: true },
          })
          for (const row of rows) {
            const attr = row.attribute as Record<string, any> | null
            if (attr && attr.imageUrls && Array.isArray(attr.imageUrls)) {
              const newImageUrls = updateImageUrls(attr.imageUrls, urlMap)
              await prisma.ganttRow.update({
                where: { id: row.id },
                data: {
                  attribute: {
                    ...attr,
                    imageUrls: newImageUrls,
                  },
                  ...getUpdateCommonColumns(email),
                },
              })
            }
          }

          // タスクの画像URLを更新
          const tasks = await prisma.ganttTask.findMany({
            where: { row: { projectId: newProjectId } },
            select: { id: true, attribute: true },
          })
          for (const task of tasks) {
            const attr = task.attribute as Record<string, any> | null
            if (attr && attr.imageUrls && Array.isArray(attr.imageUrls)) {
              const newImageUrls = updateImageUrls(attr.imageUrls, urlMap)
              await prisma.ganttTask.update({
                where: { id: task.id },
                data: {
                  attribute: {
                    ...attr,
                    imageUrls: newImageUrls,
                  },
                  ...getUpdateCommonColumns(email),
                },
              })
            }
          }
        }
      } catch (e) {
        console.warn('Failed to restore images:', e)
      }
    }
  }

  return newProjectId
}

export default restoreProject

