import { getStorageBucket } from './commonFunctions.js'
import type { GanttDataJson } from '../../types/shared.js'

export const MAX_IMAGE_EMBED_BYTES = 10 * 1024 * 1024 // 10MB

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
])

const EXT_TO_IMAGE_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SAFE_DATA_URL_REGEX = /^data:(image\/(?:png|jpeg|gif|webp));base64,[A-Za-z0-9+/=\s]+$/i

/**
 * 指定された Storage パスが対象プロジェクト配下の安全な画像パス (`images/{projectId}/{fileName}`) であるか検証する
 */
export const isSafeProjectImageStoragePath = (storagePath: string, projectId: string): boolean => {
  if (!storagePath || !projectId || !UUID_REGEX.test(projectId)) {
    return false
  }
  const expectedPrefix = `images/${projectId}/`
  if (!storagePath.startsWith(expectedPrefix)) {
    return false
  }
  const fileName = storagePath.slice(expectedPrefix.length)
  if (!fileName || fileName.length > 255) {
    return false
  }
  if (
    fileName.includes('/') ||
    fileName.includes('\\') ||
    fileName.includes('..') ||
    fileName.includes('\0') ||
    fileName === '.'
  ) {
    return false
  }
  return true
}

const resolveSafeImageMimeType = (declaredType: string | undefined, storagePath: string): string | null => {
  const normalized = declaredType?.trim().toLowerCase()
  if (normalized && ALLOWED_IMAGE_MIME_TYPES.has(normalized)) {
    return normalized
  }
  const ext = storagePath.split('.').pop()?.toLowerCase() || ''
  return EXT_TO_IMAGE_MIME[ext] ?? null
}

/**
 * 対象プロジェクトに属する Firebase Storage 上の画像ファイルのみを安全にダウンロードする
 * （SSRF 防止のため外部 HTTP/HTTPS URL への fetch は行わない）
 */
export const downloadImageBuffer = async (
  bucket: any,
  storagePath: string,
  projectId: string,
): Promise<{ buffer: Buffer; contentType: string } | null> => {
  if (!isSafeProjectImageStoragePath(storagePath, projectId)) {
    return null
  }

  try {
    const file = bucket.file(storagePath)
    const [exists] = await file.exists()
    if (!exists) {
      return null
    }

    let declaredContentType: string | undefined = file.metadata?.contentType
    let declaredSize: number | undefined =
      file.metadata?.size != null ? Number(file.metadata.size) : undefined

    if ((declaredSize == null || !declaredContentType) && typeof file.getMetadata === 'function') {
      try {
        const [meta] = await file.getMetadata()
        if (meta?.contentType) declaredContentType = meta.contentType
        if (meta?.size != null) declaredSize = Number(meta.size)
      } catch {
        // メタデータ取得に失敗した場合は後続のサイズ・拡張子検証で判定
      }
    }

    if (declaredSize != null && (!Number.isFinite(declaredSize) || declaredSize > MAX_IMAGE_EMBED_BYTES)) {
      return null
    }

    const contentType = resolveSafeImageMimeType(declaredContentType, storagePath)
    if (!contentType) {
      return null
    }

    const [fileBuffer] = await file.download()
    if (!fileBuffer || fileBuffer.byteLength === 0 || fileBuffer.byteLength > MAX_IMAGE_EMBED_BYTES) {
      return null
    }

    return {
      buffer: fileBuffer,
      contentType,
    }
  } catch {
    return null
  }
}

/**
 * 画像URLをダウンロードしてBase64 Data URLに変換するヘルパー
 */
export const convertUrlToDataUrl = async (
  bucket: any,
  url: string,
  projectId: string,
): Promise<string | null> => {
  if (!url || typeof url !== 'string') {
    return null
  }

  if (url.startsWith('data:')) {
    if (url.length > Math.ceil(MAX_IMAGE_EMBED_BYTES * 1.4) + 128) {
      return null
    }
    return SAFE_DATA_URL_REGEX.test(url) ? url : null
  }

  const match = url.match(/\/o\/([^?]+)/)
  if (!match?.[1]) {
    return null
  }

  let storagePath = ''
  try {
    storagePath = decodeURIComponent(match[1])
  } catch {
    return null
  }

  const downloaded = await downloadImageBuffer(bucket, storagePath, projectId)
  if (downloaded) {
    const base64 = downloaded.buffer.toString('base64')
    return `data:${downloaded.contentType};base64,${base64}`
  }

  return null
}

/**
 * GanttDataJson 内の行およびタスクの attribute.imageUrls に含まれる画像URLを収集し、
 * Base64 Data URL に変換して埋め込む（インプレース更新）
 */
export const embedImagesAsBase64 = async (ganttData: GanttDataJson): Promise<void> => {
  try {
    const projectId = ganttData?.project?.id
    if (!projectId || typeof projectId !== 'string') {
      return
    }

    const bucket = getStorageBucket()
    const urls = new Set<string>()

    if (ganttData.rows && Array.isArray(ganttData.rows)) {
      for (const row of ganttData.rows) {
        const rowAttr = (row as any).attribute
        if (rowAttr?.imageUrls && Array.isArray(rowAttr.imageUrls)) {
          for (const url of rowAttr.imageUrls) {
            if (typeof url === 'string') urls.add(url)
          }
        }
        if (row.tasks && Array.isArray(row.tasks)) {
          for (const task of row.tasks) {
            const taskAttr = (task as any).attribute
            if (taskAttr?.imageUrls && Array.isArray(taskAttr.imageUrls)) {
              for (const url of taskAttr.imageUrls) {
                if (typeof url === 'string') urls.add(url)
              }
            }
          }
        }
      }
    }

    if (urls.size === 0) return

    const urlToDataUrlMap = new Map<string, string>()

    await Promise.all(
      Array.from(urls).map(async (url) => {
        try {
          const dataUrl = await convertUrlToDataUrl(bucket, url, projectId)
          if (dataUrl) {
            urlToDataUrlMap.set(url, dataUrl)
          }
        } catch (err) {
          console.warn('Failed to convert image to Data URL:', err)
        }
      }),
    )

    if (urlToDataUrlMap.size > 0 && ganttData.rows && Array.isArray(ganttData.rows)) {
      for (const row of ganttData.rows) {
        const rowAttr = (row as any).attribute
        if (rowAttr?.imageUrls && Array.isArray(rowAttr.imageUrls)) {
          rowAttr.imageUrls = rowAttr.imageUrls.map((u: string) => urlToDataUrlMap.get(u) || u)
        }
        if (row.tasks && Array.isArray(row.tasks)) {
          for (const task of row.tasks) {
            const taskAttr = (task as any).attribute
            if (taskAttr?.imageUrls && Array.isArray(taskAttr.imageUrls)) {
              taskAttr.imageUrls = taskAttr.imageUrls.map((u: string) => urlToDataUrlMap.get(u) || u)
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('Failed to embed images in ganttData JSON:', e)
  }
}
