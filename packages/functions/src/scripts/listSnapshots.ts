import { getStorage } from 'firebase-admin/storage'
import type { ListSnapshots } from '../types/shared.js'

const listSnapshots: ListSnapshots = async (projectId) => {
  if (!projectId) {
    throw new Error('Project ID is required')
  }

  const bucket = getStorage().bucket()
  const prefix = `snapshots/${projectId}/`

  const [files] = await bucket.getFiles({ prefix })

  const snapshots = files
    .filter((file) => file.name.endsWith('.json.zip'))
    .map((file) => {
      // ファイル名からタイムスタンプ（スナップショット名）を抽出
      // 例: snapshots/{projectId}/20260313_180000.json.zip → 20260313_180000
      const fileName = file.name.replace(prefix, '').replace('.json.zip', '')
      const metadata = file.metadata

      const customMetadata = metadata.metadata as Record<string, string> | undefined

      return {
        name: fileName,
        createdAt: metadata.timeCreated || '',
        displayName: customMetadata?.displayName || undefined,
      }
    })
    // 新しいものが先頭に来るよう降順ソート
    .sort((a, b) => b.name.localeCompare(a.name))

  return snapshots
}

export default listSnapshots
