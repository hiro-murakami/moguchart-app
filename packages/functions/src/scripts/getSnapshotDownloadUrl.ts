import { getStorage } from 'firebase-admin/storage'
import type { GetSnapshotDownloadUrl } from '../types/shared.js'
import { checkProjectPermission } from './common/commonFunctions.js'

const getSnapshotDownloadUrl: GetSnapshotDownloadUrl = async (params, email) => {
  const { projectId, snapshotName } = params
  if (!projectId || !snapshotName) {
    throw new Error('Project ID and Snapshot Name are required')
  }

  await checkProjectPermission(projectId, email, 'viewer')

  const bucket = getStorage().bucket()
  const storagePath = `snapshots/${projectId}/${snapshotName}.json.zip`
  const file = bucket.file(storagePath)

  const [exists] = await file.exists()
  if (!exists) {
    throw new Error('Snapshot not found')
  }

  // ファイルをダウンロードしてBase64で返す
  const [fileBuffer] = await file.download()
  const base64Data = fileBuffer.toString('base64')

  return base64Data
}

export default getSnapshotDownloadUrl
