import AdmZip from 'adm-zip'
import { getStorage } from 'firebase-admin/storage'
import type { DownloadProjectZip } from '../types/shared.js'
import getGanttDataJson from './getGanttDataJson.js'

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
    const bucket = getStorage().bucket()
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

  const zipBuffer = zip.toBuffer()

  // Base64で返す
  return zipBuffer.toString('base64')
}

export default downloadProjectZip
