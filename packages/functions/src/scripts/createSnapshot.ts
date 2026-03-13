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

  // ダウンロード用のURLを生成
  // エミュレータ環境では `client_email` が無いため署名付きURLの生成が失敗するのでフォールバックする
  let downloadUrl: string
  if (process.env.FUNCTIONS_EMULATOR === 'true' || process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
    const host = process.env.FIREBASE_STORAGE_EMULATOR_HOST || '127.0.0.1:9199'
    downloadUrl = `http://${host}/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media&token=${downloadToken}`
  } else {
    // 本番環境：ダウンロード用のSigned URLを生成 (有効期限1時間)
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000,
    })
    downloadUrl = url
  }

  return downloadUrl
}

export default createSnapshot
