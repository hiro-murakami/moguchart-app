import { getStorage } from 'firebase-admin/storage'
import AdmZip from 'adm-zip'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import crypto from 'node:crypto'

dayjs.extend(utc)
dayjs.extend(timezone)
import type { CreateSnapshot } from '../types/shared.js'
import getGanttDataJson from './getGanttDataJson.js'

const createSnapshot: CreateSnapshot = async (projectId, email) => {
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
  const safeProjectName = projectName.replace(/[^a-zA-Z0-9]/g, '_')
  const fileName = `${safeProjectName}_snapshot.json`
  zip.addFile(fileName, Buffer.from(jsonString, 'utf8'))
  const zipBuffer = zip.toBuffer()

  // Storageへアップロード
  const bucket = getStorage().bucket()
  
  const timestamp = dayjs().tz('Asia/Tokyo').format('YYYYMMDD_HHmmss')
  const storagePath = `snapshots/${projectId}/${timestamp}.json.zip`
  const file = bucket.file(storagePath)

  const downloadToken = crypto.randomUUID()

  await file.save(zipBuffer, {
    metadata: {
      contentType: 'application/zip',
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
      },
    },
  })

  // return downloadUrl
  return timestamp
}

export default createSnapshot
