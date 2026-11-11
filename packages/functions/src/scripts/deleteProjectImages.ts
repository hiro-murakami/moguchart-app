import type { DeleteProjectImages } from '../types/shared.js'
import { checkProjectPermission, getStorageBucket } from './common/commonFunctions.js'

const IMAGE_STORAGE_PATH_REGEX =
  /^images\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/([^/\\\0]+)$/i

const extractSafeImageTarget = (url: string): { projectId: string; storagePath: string } | null => {
  if (typeof url !== 'string' || !url) return null

  let candidatePath: string | null = null
  const pathMatch = url.match(/\/o\/([^?]+)/)
  if (pathMatch?.[1]) {
    try {
      candidatePath = decodeURIComponent(pathMatch[1])
    } catch {
      return null
    }
  } else if (url.startsWith('images/')) {
    candidatePath = url
  }

  if (!candidatePath || candidatePath.includes('..')) return null

  const match = candidatePath.match(IMAGE_STORAGE_PATH_REGEX)
  if (!match?.[1] || !match?.[2]) return null
  if (match[2] === '.' || match[2] === '..') return null

  return {
    projectId: match[1],
    storagePath: candidatePath,
  }
}

const deleteProjectImages: DeleteProjectImages = async (urls, email) => {
  if (!email) {
    throw new Error('Permission denied')
  }
  if (!Array.isArray(urls) || urls.length === 0) {
    return
  }

  const pathsByProject = new Map<string, Set<string>>()
  for (const url of urls) {
    const target = extractSafeImageTarget(url)
    if (!target) continue
    let set = pathsByProject.get(target.projectId)
    if (!set) {
      set = new Set<string>()
      pathsByProject.set(target.projectId, set)
    }
    set.add(target.storagePath)
  }

  if (pathsByProject.size === 0) return

  // 対象となる全プロジェクトについて editor 以上の権限を検証してから削除を実行
  for (const projectId of pathsByProject.keys()) {
    await checkProjectPermission(projectId, email, 'editor')
  }

  const bucket = getStorageBucket()
  const deletePromises: Promise<unknown>[] = []
  for (const storagePaths of pathsByProject.values()) {
    for (const storagePath of storagePaths) {
      deletePromises.push(bucket.file(storagePath).delete({ ignoreNotFound: true }))
    }
  }

  await Promise.all(deletePromises)
}

export default deleteProjectImages
