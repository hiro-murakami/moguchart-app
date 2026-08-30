import type { DeleteSnapshot } from '../types/shared.js'
import { checkProjectPermission, getStorageBucket } from './common/commonFunctions.js'

const deleteSnapshot: DeleteSnapshot = async (params, email) => {
  const { projectId, snapshotName } = params

  if (!projectId) {
    throw new Error('Project ID is required')
  }
  if (!snapshotName) {
    throw new Error('Snapshot name is required')
  }

  await checkProjectPermission(projectId, email, 'owner')

  const bucket = getStorageBucket()
  const storagePath = `snapshots/${projectId}/${snapshotName}.json.zip`
  const file = bucket.file(storagePath)

  const [exists] = await file.exists()
  if (!exists) {
    throw new Error('Snapshot not found')
  }

  await file.delete()
}

export default deleteSnapshot
