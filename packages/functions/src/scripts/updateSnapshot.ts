import type { UpdateSnapshot } from '../types/shared.js'
import { checkProjectPermission, getStorageBucket } from './common/commonFunctions.js'

const updateSnapshot: UpdateSnapshot = async (params, email) => {
  const { projectId, snapshotName, displayName } = params

  if (!projectId) {
    throw new Error('Project ID is required')
  }
  if (!snapshotName) {
    throw new Error('Snapshot name is required')
  }

  await checkProjectPermission(projectId, email, 'editor')

  const bucket = getStorageBucket()
  const storagePath = `snapshots/${projectId}/${snapshotName}.json.zip`
  const file = bucket.file(storagePath)

  const [exists] = await file.exists()
  if (!exists) {
    throw new Error('Snapshot not found')
  }

  const [metadata] = await file.getMetadata()
  const customMetadata = { ...((metadata.metadata as Record<string, string> | undefined) || {}) }

  const trimmedName = displayName?.trim()
  if (trimmedName) {
    customMetadata.displayName = trimmedName
  } else {
    delete customMetadata.displayName
  }

  await file.setMetadata({
    metadata: customMetadata,
  })

  return {
    name: snapshotName,
    createdAt: metadata.timeCreated || '',
    displayName: trimmedName || undefined,
  }
}

export default updateSnapshot
