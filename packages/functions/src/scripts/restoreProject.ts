import type { RestoreProject } from '../types/shared'
import {
  checkProjectPermission,
  getCreateCommonColumns,
  getUpdateCommonColumns,
  getStorageBucket,
  prisma,
  syncProjectAclToFirestore,
} from './common/commonFunctions'
import { MAX_ZIP_COMPRESSED_BYTES, openValidatedZip } from './common/zipHelpers'
import { sanitizeAuthority, syncProjectMembers } from './upsertProject'
import AdmZip, { type IZipEntry } from 'adm-zip'
import crypto from 'node:crypto'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const ALLOWED_IMAGE_MIME_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

const EXT_TO_IMAGE_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
}

const isSafeStorageFileName = (name: string): boolean => {
  if (!name || name.length > 255) return false
  if (name.includes('/') || name.includes('\\') || name.includes('..') || name.includes('\0')) {
    return false
  }
  return name !== '.' && name !== '..'
}

const resolveSafeImageContentType = (declaredType: string | undefined, fileName: string): string | null => {
  const normalizedDeclared = declaredType?.trim().toLowerCase()
  if (normalizedDeclared && ALLOWED_IMAGE_MIME_TYPES[normalizedDeclared]) {
    return normalizedDeclared
  }
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  return EXT_TO_IMAGE_MIME[ext] ?? null
}

// 依存関係のIDを書き換えるためのヘルパー
// dependenciesはstringまたはTaskDependencyLinkオブジェクトの配列として保存されるため両方に対応する
const updateDependencies = (attribute: any, taskIdMap: Map<string, string>): any => {
  if (!attribute || !attribute.dependencies || !Array.isArray(attribute.dependencies)) {
    return attribute
  }

  const newDependencies = attribute.dependencies
    .map((dep: any) => {
      if (typeof dep === 'string' || typeof dep === 'number') {
        return taskIdMap.get(String(dep))
      }
      if (dep && typeof dep === 'object' && dep.taskId != null) {
        const newTaskId = taskIdMap.get(String(dep.taskId))
        if (!newTaskId) return undefined
        return {
          ...dep,
          taskId: newTaskId,
        }
      }
      return undefined
    })
    .filter((entry: any): entry is NonNullable<typeof entry> => entry !== undefined)

  return {
    ...attribute,
    dependencies: newDependencies,
  }
}

// スナップショットをCloud Storageに復元するヘルパー
const restoreSnapshots = async (
  zip: AdmZip,
  projectId: string,
  readEntryBuffer: (entry: IZipEntry, maxEntryBytes?: number) => Buffer,
) => {
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
      metadataList = JSON.parse(readEntryBuffer(metadataEntry, 2 * 1024 * 1024).toString('utf8'))
    } catch {
      // メタデータのパースに失敗した場合は空のまま
    }
  }

  const bucket = getStorageBucket()

  for (const entry of snapshotEntries) {
    const snapshotFileName = entry.entryName.replace('snapshots/', '')
    if (!isSafeStorageFileName(snapshotFileName)) continue
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

    const fileBuffer = readEntryBuffer(entry)
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
const restoreImages = async (
  zip: AdmZip,
  projectId: string,
  readEntryBuffer: (entry: IZipEntry, maxEntryBytes?: number) => Buffer,
): Promise<Map<string, string>> => {
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
      metadataList = JSON.parse(readEntryBuffer(metadataEntry, 2 * 1024 * 1024).toString('utf8'))
    } catch {
      // メタデータのパースに失敗した場合は空のまま
    }
  }

  const bucket = getStorageBucket()


  for (const entry of imageEntries) {
    const imageFileName = entry.entryName.replace('images/', '')
    if (!isSafeStorageFileName(imageFileName)) continue

    const meta = metadataList.find((m) => m.fileName === imageFileName)
    const safeContentType = resolveSafeImageContentType(meta?.contentType, imageFileName)
    if (!safeContentType) continue

    let fileBuffer: Buffer
    try {
      fileBuffer = readEntryBuffer(entry, MAX_IMAGE_BYTES)
    } catch {
      continue
    }
    if (fileBuffer.byteLength === 0 || fileBuffer.byteLength > MAX_IMAGE_BYTES) continue

    const storagePath = `images/${projectId}/${imageFileName}`
    const file = bucket.file(storagePath)

    const downloadToken = crypto.randomUUID()

    await file.save(fileBuffer, {
      metadata: {
        contentType: safeContentType,
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

// Base64 Data URL (data:image/...;base64,...) をCloud Storageに保存し、Data URL → 新ダウンロードURL のマッピングを返すヘルパー
const restoreDataUrlImages = async (
  projectId: string,
  dataUrls: Set<string>,
): Promise<Map<string, string>> => {
  const urlMap = new Map<string, string>()
  if (dataUrls.size === 0) return urlMap

  const bucket = getStorageBucket()

  for (const dataUrl of dataUrls) {
    const commaIndex = dataUrl.indexOf(',')
    if (commaIndex === -1) continue

    const metaPart = dataUrl.slice(0, commaIndex)
    const base64Data = dataUrl.slice(commaIndex + 1)
    if (!base64Data) continue

    const match = metaPart.match(/^data:([^;,]+)/)
    const rawContentType = match?.[1]?.trim().toLowerCase() || 'image/png'
    const ext = ALLOWED_IMAGE_MIME_TYPES[rawContentType]
    if (!ext) continue

    const buffer = Buffer.from(base64Data, 'base64')
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_IMAGE_BYTES) continue

    const fileName = `${crypto.randomUUID()}.${ext}`
    const storagePath = `images/${projectId}/${fileName}`
    const file = bucket.file(storagePath)

    const downloadToken = crypto.randomUUID()
    await file.save(buffer, {
      metadata: {
        contentType: rawContentType,
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
        },
      },
    })

    const downloadUrl = buildDownloadUrl(bucket.name, storagePath, downloadToken)
    urlMap.set(dataUrl, downloadUrl)
  }

  return urlMap
}

// UUID v4 形式かどうかを判定するヘルパー
const isUUID = (value: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

const restoreProject: RestoreProject = async (data, email) => {
  if (!email) {
    throw new Error('Permission denied')
  }

  let projectData: any
  let zipInstance: AdmZip | undefined
  let readZipEntryBuffer: ((entry: IZipEntry, maxEntryBytes?: number) => Buffer) | undefined

  if ('zipBase64' in data && data.zipBase64) {
    if (typeof data.zipBase64 !== 'string' || data.zipBase64.length > Math.ceil(MAX_ZIP_COMPRESSED_BYTES * 1.4)) {
      throw new Error('Zip archive exceeds maximum allowed size')
    }
    // zipBase64が含まれている場合は安全検証のうえでzip展開してJSONを取り出す
    const zipBuffer = Buffer.from(data.zipBase64, 'base64')
    const validated = openValidatedZip(zipBuffer)
    zipInstance = validated.zip
    readZipEntryBuffer = validated.readEntryBuffer
    const entries = zipInstance.getEntries()
    const jsonEntry = entries.find(
      (e) =>
        e.entryName.endsWith('.json') &&
        !e.entryName.startsWith('snapshots/') &&
        !e.entryName.startsWith('snapshots\\') &&
        !e.entryName.startsWith('images/') &&
        !e.entryName.startsWith('images\\'),
    )
    if (!jsonEntry) {
      throw new Error('zipファイル内にJSONファイルが見つかりませんでした')
    }
    const jsonString = readZipEntryBuffer(jsonEntry).toString('utf8')
    projectData = JSON.parse(jsonString)
  } else {
    projectData = data
  }

  if (!projectData || !projectData.project || !projectData.rows) {
    throw new Error('復元データの形式が不正です（projectまたはrowsが見つかりません）')
  }

  const { project, rows, force, newId } = { ...projectData, force: data.force, newId: (data as any).newId }

  const { id: oldProjectId, ...projectDataBody } = project
  const isValidUUID = typeof oldProjectId === 'string' && isUUID(oldProjectId)

  // 既存プロジェクトのチェック（UUID形式の場合のみ）
  const existingProject = isValidUUID
    ? await prisma.project.findUnique({
        where: { id: oldProjectId },
      })
    : null

  let isOwnerOfExisting = false
  if (existingProject) {
    try {
      await checkProjectPermission(oldProjectId, email, 'owner')
      isOwnerOfExisting = true
    } catch {
      isOwnerOfExisting = false
    }
  }

  // Storageへの書き込みやDBトランザクションに入る前に認可判定・復元先ID確定を行う
  let shouldOverwrite = false
  let shouldAppendCopySuffix = false
  let targetProjectId: string

  if (existingProject) {
    if (force) {
      if (!isOwnerOfExisting) {
        throw new Error('Permission denied')
      }
      shouldOverwrite = true
      targetProjectId = oldProjectId
    } else if (newId) {
      targetProjectId = crypto.randomUUID()
      shouldAppendCopySuffix = isOwnerOfExisting
    } else if (isOwnerOfExisting) {
      throw new Error('PROJECT_EXISTS')
    } else {
      // 他者のプロジェクトIDと衝突した場合は存在確認オラクルを防ぎつつ新規UUIDを採番
      targetProjectId = crypto.randomUUID()
    }
  } else {
    targetProjectId = isValidUUID ? oldProjectId : crypto.randomUUID()
  }

  // JSON内に埋め込まれたBase64 Data URL画像を抽出し、StorageにアップロードしてStorage URLに置換
  const dataUrls = new Set<string>()
  if (rows && Array.isArray(rows)) {
    for (const row of rows) {
      const rowAttr = row.attribute
      if (rowAttr?.imageUrls && Array.isArray(rowAttr.imageUrls)) {
        for (const url of rowAttr.imageUrls) {
          if (typeof url === 'string' && url.startsWith('data:')) {
            dataUrls.add(url)
          }
        }
      }
      if (row.tasks && Array.isArray(row.tasks)) {
        for (const task of row.tasks) {
          const taskAttr = task.attribute
          if (taskAttr?.imageUrls && Array.isArray(taskAttr.imageUrls)) {
            for (const url of taskAttr.imageUrls) {
              if (typeof url === 'string' && url.startsWith('data:')) {
                dataUrls.add(url)
              }
            }
          }
        }
      }
    }
  }

  if (dataUrls.size > 0) {
    try {
      const dataUrlMap = await restoreDataUrlImages(targetProjectId, dataUrls)
      for (const row of rows) {
        if (row.attribute?.imageUrls && Array.isArray(row.attribute.imageUrls)) {
          row.attribute.imageUrls = row.attribute.imageUrls.map((u: string) => dataUrlMap.get(u) || u)
        }
        if (row.tasks && Array.isArray(row.tasks)) {
          for (const task of row.tasks) {
            if (task.attribute?.imageUrls && Array.isArray(task.attribute.imageUrls)) {
              task.attribute.imageUrls = task.attribute.imageUrls.map((u: string) => dataUrlMap.get(u) || u)
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to restore data URL images:', e)
    }
  }

  const newProjectId = await prisma.$transaction(
    async (tx) => {
      // 1. プロジェクトの作成または更新
      // メタデータの更新
      const commonColumns = getCreateCommonColumns(email)

      // 権限設定: 新規作成時は実行ユーザーをオーナーにする
      const newAuthority = {
        owners: [email],
        editors: [],
        viewers: [],
      }

      let newProjectId: string

      if (shouldOverwrite && existingProject) {
        const preservedAuthority = sanitizeAuthority(existingProject.authority, email)
        // 既存プロジェクトを上書き（オーナー検証済み・既存メンバー構成と公開設定を保持）
        await tx.project.update({
          where: { id: oldProjectId },
          data: {
            name: projectDataBody.name,
            start: new Date(projectDataBody.start),
            end: new Date(projectDataBody.end),
            attribute: projectDataBody.attribute ?? {},
            public: existingProject.public,
            authority: preservedAuthority,
            ...getUpdateCommonColumns(email),
          },
        })
        newProjectId = oldProjectId
        await syncProjectMembers(tx, newProjectId, preservedAuthority)

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
        // 新規作成（別IDでの復元を含む）
        const projectName = shouldAppendCopySuffix
          ? `${projectDataBody.name}のコピー`
          : projectDataBody.name
        const newProject = await tx.project.create({
          data: {
            id: targetProjectId,
            name: projectName,
            start: new Date(projectDataBody.start),
            end: new Date(projectDataBody.end),
            attribute: projectDataBody.attribute ?? {},
            public: false,
            authority: newAuthority,
            ...commonColumns,
          },
        })
        newProjectId = newProject.id
        await syncProjectMembers(tx, newProjectId, newAuthority)
      }


    const taskIdMap = new Map<string, string>()
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

          taskIdMap.set(String(oldTaskId), String(newTask.id))
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
  if (zipInstance && readZipEntryBuffer) {
    const hasSnapshots = zipInstance.getEntries().some(
      (e) => e.entryName.startsWith('snapshots/') && e.entryName.endsWith('.json.zip')
    )
    if (hasSnapshots) {
      try {
        await restoreSnapshots(zipInstance, newProjectId, readZipEntryBuffer)
      } catch (e) {
        console.warn('Failed to restore snapshots:', e)
      }
    }

    const hasImages = zipInstance.getEntries().some(
      (e) => e.entryName.startsWith('images/') && !e.isDirectory && e.entryName !== 'images/metadata.json'
    )
    if (hasImages) {
      try {
        const urlMap = await restoreImages(zipInstance, newProjectId, readZipEntryBuffer)
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

  await syncProjectAclToFirestore(newProjectId)

  return newProjectId
}

export default restoreProject

