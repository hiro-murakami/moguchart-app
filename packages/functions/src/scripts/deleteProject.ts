import { getStorage } from 'firebase-admin/storage'
import type { DeleteProject } from '../types/shared'
import { prisma } from './common/commonFunctions'

const deleteProject: DeleteProject = async (id) => {
  // Firebase Storage の関連スナップショットを削除
  const bucket = getStorage().bucket()
  const prefix = `snapshots/${id}/`
  const [files] = await bucket.getFiles({ prefix })
  if (files.length > 0) {
    await Promise.all(files.map((file) => file.delete()))
  }

  await prisma.project.delete({
    where: { id },
  })
}

export default deleteProject
