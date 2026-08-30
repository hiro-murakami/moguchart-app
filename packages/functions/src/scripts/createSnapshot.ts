import AdmZip from 'adm-zip'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import crypto from 'node:crypto'

dayjs.extend(utc)
dayjs.extend(timezone)
import type { CreateSnapshot, ProjectAttribute } from '../types/shared.js'
import { checkProjectPermission, getStorageBucket } from './common/commonFunctions.js'
import getGanttDataJson from './getGanttDataJson.js'

const createSnapshot: CreateSnapshot = async (params, email) => {
  const { projectId, displayName } = params

  if (!projectId) {
    throw new Error('Project ID is required')
  }

  await checkProjectPermission(projectId, email, 'editor')

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
  const fileName = `${safeProjectName}_snapshot.json`
  zip.addFile(fileName, Buffer.from(jsonString, 'utf8'))
  const zipBuffer = zip.toBuffer()

  // Storageへアップロード
  const bucket = getStorageBucket()
  
  const timestamp = dayjs().tz('Asia/Tokyo').format('YYYYMMDD_HHmmss')
  const storagePath = `snapshots/${projectId}/${timestamp}.json.zip`
  const file = bucket.file(storagePath)

  const downloadToken = crypto.randomUUID()

  const customMetadata: Record<string, string> = {
    firebaseStorageDownloadTokens: downloadToken,
  }
  if (displayName) {
    customMetadata.displayName = displayName
  }

  // 自動履歴の場合、保持期間に基づいてcustomTimeを設定（GCSライフサイクルで自動削除）
  let customTime: string | undefined
  if (displayName?.startsWith('自動履歴')) {
    const attribute = (ganttData.project?.attribute ?? {}) as ProjectAttribute
    const retentionDays = attribute.historyRetentionDays
    if (retentionDays && retentionDays > 0) {
      customTime = dayjs().add(retentionDays, 'day').toISOString()
    }
  }

  await file.save(zipBuffer, {
    metadata: {
      contentType: 'application/zip',
      ...(customTime ? { customTime } : {}),
      metadata: customMetadata,
    },
  })

  // return downloadUrl
  return timestamp
}

export default createSnapshot
