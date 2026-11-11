import type { LoadSnapshot } from '../types/shared.js'
import { assertSafeSnapshotName, checkProjectPermission, getStorageBucket } from './common/commonFunctions.js'
import { openValidatedZip } from './common/zipHelpers.js'

const loadSnapshot: LoadSnapshot = async (params, email) => {
  const { projectId, snapshotName } = params
  if (!projectId || !snapshotName) {
    throw new Error('Project ID and Snapshot Name are required')
  }
  assertSafeSnapshotName(snapshotName)

  await checkProjectPermission(projectId, email, 'viewer')

  const bucket = getStorageBucket()
  const storagePath = `snapshots/${projectId}/${snapshotName}.json.zip`
  const file = bucket.file(storagePath)

  let fileBuffer: Buffer
  try {
    const [downloaded] = await file.download()
    fileBuffer = downloaded
  } catch (err: any) {
    if (err?.code === 404) {
      throw new Error('Snapshot not found')
    }
    throw err
  }

  const { zip, readEntryBuffer } = openValidatedZip(fileBuffer, {
    maxEntries: 10,
    maxSingleEntryBytes: 50 * 1024 * 1024,
    maxTotalUncompressedBytes: 50 * 1024 * 1024,
  })
  const zipEntries = zip.getEntries()

  let jsonStr = ''
  for (const entry of zipEntries) {
    if (!entry.isDirectory && entry.entryName.endsWith('.json')) {
      jsonStr = readEntryBuffer(entry).toString('utf8')
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
