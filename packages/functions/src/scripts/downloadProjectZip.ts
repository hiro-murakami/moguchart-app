import AdmZip from 'adm-zip'
import type { DownloadProjectZip } from '../types/shared.js'
import { getStorageBucket } from './common/commonFunctions.js'
import getGanttDataJson from './getGanttDataJson.js'

// 画像ファイルをダウンロードするヘルパー（Storage SDKとHTTP fetchの2段構え）
const downloadImageBuffer = async (
  bucket: any,
  storagePath: string,
  url?: string,
): Promise<{ buffer: Buffer; contentType?: string } | null> => {
  // 1. Storage SDK からの取得を試みる
  try {
    const file = bucket.file(storagePath)
    const [exists] = await file.exists()
    if (exists) {
      const [fileBuffer] = await file.download()
      return {
        buffer: fileBuffer,
        contentType: file.metadata?.contentType,
      }
    }
  } catch (err) {
    // Storage SDK での取得失敗時は HTTP fetch にフォールバック
  }

  // 2. HTTP fetch での取得（エミュレータ環境でローカルStorageに本番画像がない場合や外部URLに対応）
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    try {
      const response = await fetch(url)
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer()
        return {
          buffer: Buffer.from(arrayBuffer),
          contentType: response.headers.get('content-type') || undefined,
        }
      }
    } catch (fetchErr) {
      console.warn(`Failed to fetch image from URL: ${url}`, fetchErr)
    }
  }

  return null
}

const downloadProjectZip: DownloadProjectZip = async (projectId, email) => {
  if (!projectId) {
    throw new Error('Project ID is required')
  }

  // ガントチャート情報の取得（権限チェック含む）
  const ganttData = await getGanttDataJson(projectId, email)

  const projectName = ganttData.project?.name || 'project'

  // JSON文字列化
  const jsonString = JSON.stringify(ganttData, null, 2)

  // Zip圧縮 (メモリ上で作成)
  const zip = new AdmZip()
  const safeProjectName = projectName
    .replace(/[\/\\:*?"<>|]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
  const fileName = `${safeProjectName}.json`
  zip.addFile(fileName, Buffer.from(jsonString, 'utf8'))

  // スナップショットをZipに含める
  try {
    const bucket = getStorageBucket()
    const prefix = `snapshots/${projectId}/`
    const [files] = await bucket.getFiles({ prefix })

    const snapshotFiles = files.filter((file) => file.name.endsWith('.json.zip'))

    if (snapshotFiles.length > 0) {
      // スナップショットのメタデータを収集
      const metadataList: Array<{
        fileName: string
        displayName?: string
        createdAt?: string
      }> = []

      for (const snapshotFile of snapshotFiles) {
        const snapshotFileName = snapshotFile.name.replace(prefix, '')
        const metadata = snapshotFile.metadata
        const customMetadata = metadata.metadata as Record<string, string> | undefined
        metadataList.push({
          fileName: snapshotFileName,
          displayName: customMetadata?.displayName || undefined,
          createdAt: metadata.timeCreated || '',
        })

        // スナップショットファイルをダウンロードしてZipに追加
        const [fileBuffer] = await snapshotFile.download()
        zip.addFile(`snapshots/${snapshotFileName}`, fileBuffer)
      }

      // メタデータファイルを追加
      const metadataJson = JSON.stringify(metadataList, null, 2)
      zip.addFile('snapshots/metadata.json', Buffer.from(metadataJson, 'utf8'))
    }
  } catch (e) {
    // スナップショットの取得に失敗してもプロジェクトデータはダウンロードする
    console.warn('Failed to include snapshots in zip:', e)
  }

  // 画像ファイルをZipに含める
  try {
    const bucket = getStorageBucket()
    const addedFiles = new Set<string>()
    const imageMetadataList: Array<{
      fileName: string
      contentType?: string
      createdAt?: string
      originalPath?: string
    }> = []

    // 1. Storage上の images/${projectId}/ プレフィックスから画像を取得
    try {
      const imagePrefix = `images/${projectId}/`
      const [files] = await bucket.getFiles({ prefix: imagePrefix })
      const imageFiles = files.filter((file) => !file.name.endsWith('/'))

      for (const imageFile of imageFiles) {
        const imageFileName = imageFile.name.replace(imagePrefix, '')
        if (!imageFileName || addedFiles.has(imageFileName)) continue

        try {
          const [fileBuffer] = await imageFile.download()
          zip.addFile(`images/${imageFileName}`, fileBuffer)
          addedFiles.add(imageFileName)

          imageMetadataList.push({
            fileName: imageFileName,
            contentType: imageFile.metadata?.contentType || undefined,
            createdAt: imageFile.metadata?.timeCreated || '',
            originalPath: imageFile.name,
          })
        } catch (downloadErr) {
          console.warn(`Could not download image file ${imageFile.name}:`, downloadErr)
        }
      }
    } catch (prefixErr) {
      console.warn('Failed to list files with image prefix:', prefixErr)
    }

    // 2. プロジェクトデータ（行・タスク）内の imageUrls からも漏れなく画像を取得
    const urls = new Set<string>()
    if (ganttData.rows && Array.isArray(ganttData.rows)) {
      for (const row of ganttData.rows) {
        const rowAttr = (row as any).attribute
        if (rowAttr?.imageUrls && Array.isArray(rowAttr.imageUrls)) {
          for (const url of rowAttr.imageUrls) {
            if (typeof url === 'string') urls.add(url)
          }
        }
        if (row.tasks && Array.isArray(row.tasks)) {
          for (const task of row.tasks) {
            const taskAttr = (task as any).attribute
            if (taskAttr?.imageUrls && Array.isArray(taskAttr.imageUrls)) {
              for (const url of taskAttr.imageUrls) {
                if (typeof url === 'string') urls.add(url)
              }
            }
          }
        }
      }
    }

    for (const url of urls) {
      const match = url.match(/\/o\/(.+?)\?/)
      const storagePath = match?.[1] ? decodeURIComponent(match[1]) : ''
      const imageFileName = storagePath ? storagePath.split('/').pop() : url.split('/').pop()?.split('?')[0]
      if (!imageFileName || addedFiles.has(imageFileName)) continue

      const downloaded = await downloadImageBuffer(bucket, storagePath, url)
      if (downloaded) {
        zip.addFile(`images/${imageFileName}`, downloaded.buffer)
        addedFiles.add(imageFileName)

        imageMetadataList.push({
          fileName: imageFileName,
          contentType: downloaded.contentType,
          createdAt: new Date().toISOString(),
          originalPath: storagePath || url,
        })
      }
    }

    if (imageMetadataList.length > 0) {
      const imageMetadataJson = JSON.stringify(imageMetadataList, null, 2)
      zip.addFile('images/metadata.json', Buffer.from(imageMetadataJson, 'utf8'))
    }
  } catch (e) {
    // 画像の取得に失敗してもプロジェクトデータはダウンロードする
    console.warn('Failed to include images in zip:', e)
  }

  const zipBuffer = zip.toBuffer()

  // Base64で返す
  return zipBuffer.toString('base64')
}

export default downloadProjectZip


