import type { DeleteProject } from '../types/shared'
import { checkProjectPermission, getStorageBucket, prisma } from './common/commonFunctions'

const deleteProject: DeleteProject = async (id, email) => {
  await checkProjectPermission(id, email, 'owner')

  // Firebase Storage の関連スナップショットを削除
  const bucket = getStorageBucket()
  const snapshotPrefix = `snapshots/${id}/`
  const [snapshotFiles] = await bucket.getFiles({ prefix: snapshotPrefix })
  if (snapshotFiles.length > 0) {
    await Promise.all(snapshotFiles.map((file) => file.delete()))
  }

  // Firebase Storage の関連画像を削除
  const imagePrefix = `images/${id}/`
  const [imageFiles] = await bucket.getFiles({ prefix: imagePrefix })
  if (imageFiles.length > 0) {
    await Promise.all(imageFiles.map((file) => file.delete()))
  }

  await prisma.project.delete({
    where: { id },
  })
}

export default deleteProject

