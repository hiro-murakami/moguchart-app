import { getStorageBucket } from './commonFunctions.js'
import type { GanttDataJson } from '../../types/shared.js'

/**
 * 画像ファイルをダウンロードするヘルパー（Storage SDKとHTTP fetchの2段構え）
 */
export const downloadImageBuffer = async (
  bucket: any,
  storagePath: string,
  url?: string,
): Promise<{ buffer: Buffer; contentType?: string } | null> => {
  // 1. Storage SDK からの取得を試みる
  try {
    const file = bucket.file(storagePath)
    const [exists] = await file.exists()
    if (exists) {
      const [fileBuffer] = await file.download()
      return {
        buffer: fileBuffer,
        contentType: file.metadata?.contentType,
      }
    }
  } catch (err) {
    // Storage SDK での取得失敗時は HTTP fetch にフォールバック
  }

  // 2. HTTP fetch での取得（エミュレータ環境でローカルStorageに本番画像がない場合や外部URLに対応）
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    try {
      const response = await fetch(url)
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer()
        return {
          buffer: Buffer.from(arrayBuffer),
          contentType: response.headers.get('content-type') || undefined,
        }
      }
    } catch (fetchErr) {
      console.warn(`Failed to fetch image from URL: ${url}`, fetchErr)
    }
  }

  return null
}

/**
 * 画像URLをダウンロードしてBase64 Data URLに変換するヘルパー
 */
export const convertUrlToDataUrl = async (
  bucket: any,
  url: string,
): Promise<string | null> => {
  if (url.startsWith('data:')) {
    return url
  }

  const match = url.match(/\/o\/(.+?)\?/)
  const storagePath = match?.[1] ? decodeURIComponent(match[1]) : ''

  const downloaded = await downloadImageBuffer(bucket, storagePath, url)
  if (downloaded) {
    const contentType = downloaded.contentType || 'image/png'
    const base64 = downloaded.buffer.toString('base64')
    return `data:${contentType};base64,${base64}`
  }

  return null
}

/**
 * GanttDataJson 内の行およびタスクの attribute.imageUrls に含まれる画像URLを収集し、
 * Base64 Data URL に変換して埋め込む（インプレース更新）
 */
export const embedImagesAsBase64 = async (ganttData: GanttDataJson): Promise<void> => {
  try {
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
          const dataUrl = await convertUrlToDataUrl(bucket, url)
          if (dataUrl) {
            urlToDataUrlMap.set(url, dataUrl)
          }
        } catch (err) {
          console.warn(`Failed to convert image to Data URL: ${url}`, err)
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
