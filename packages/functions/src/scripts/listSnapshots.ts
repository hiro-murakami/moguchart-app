import type { ListSnapshots } from '../types/shared.js'
import { checkProjectPermission, getStorageBucket } from './common/commonFunctions.js'

const listSnapshots: ListSnapshots = async (projectId, email) => {
  if (!projectId) {
    throw new Error('Project ID is required')
  }

  await checkProjectPermission(projectId, email, 'viewer')

  const bucket = getStorageBucket()
  const prefix = `snapshots/${projectId}/`

  const [files] = await bucket.getFiles({ prefix })

  const snapshots = files
    .filter((file) => file.name.endsWith('.json.zip'))
    .map((file) => {
      // ファイル名からスナップショットIDを抽出
      // 例: snapshots/{projectId}/{snapshotId}.json.zip → {snapshotId}
      const fileName = file.name.replace(prefix, '').replace('.json.zip', '')
      const metadata = file.metadata

      const customMetadata = metadata.metadata as Record<string, string> | undefined

      return {
        name: fileName,
        createdAt: metadata.timeCreated || '',
        displayName: customMetadata?.displayName || undefined,
      }
    })
    // 新しいものが先頭に来るよう作成日時で降順ソート
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))

  return snapshots
}

export default listSnapshots
