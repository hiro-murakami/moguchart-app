import AdmZip from 'adm-zip'
import type { LoadSnapshot } from '../types/shared.js'
import { checkProjectPermission, getStorageBucket } from './common/commonFunctions.js'

const loadSnapshot: LoadSnapshot = async (params, email) => {
  const { projectId, snapshotName } = params
  if (!projectId || !snapshotName) {
    throw new Error('Project ID and Snapshot Name are required')
  }

  await checkProjectPermission(projectId, email, 'viewer')

  const bucket = getStorageBucket()
  const storagePath = `snapshots/${projectId}/${snapshotName}.json.zip`
  const file = bucket.file(storagePath)

  const [exists] = await file.exists()
  if (!exists) {
    throw new Error('Snapshot not found')
  }

  const [fileBuffer] = await file.download()
  const zip = new AdmZip(fileBuffer)
  const zipEntries = zip.getEntries()

  let jsonStr = ''
  for (const entry of zipEntries) {
    if (entry.entryName.endsWith('.json')) {
      jsonStr = entry.getData().toString('utf8')
      break
    }
  }

  if (!jsonStr) {
    throw new Error('No JSON file found in snapshot zip')
  }

  const parsedData = JSON.parse(jsonStr)
  return parsedData
}

export default loadSnapshot
