import { ref as storageRef, deleteObject } from 'firebase/storage'
import { storage } from '@/firebase'

/**
 * Firebase Storage の画像ダウンロードURLからストレージパスを抽出する。
 * URL は `https://.../.../o/{encodedPath}?alt=media&token=...` の形式。
 */
const extractStoragePath = (url: string): string | null => {
  const pathMatch = url.match(/\/o\/(.+?)\?/)
  if (pathMatch?.[1]) {
    return decodeURIComponent(pathMatch[1])
  }
  return null
}

/**
 * Firebase Storage から指定URLの画像を削除する。
 * エラーが発生しても例外をスローせず、コンソールに警告を出して続行する。
 */
export const deleteImageFromStorage = async (url: string): Promise<void> => {
  try {
    const path = extractStoragePath(url)
    if (path) {
      const fileRef = storageRef(storage, path)
      await deleteObject(fileRef)
    }
  } catch (err) {
    console.warn('Storage画像削除エラー（無視して続行）:', err)
  }
}

/**
 * Firebase Storage から複数の画像URLを一括削除する。
 * 全ての削除を並列実行し、個々のエラーは無視して続行する。
 */
export const deleteImagesFromStorage = async (urls: string[]): Promise<void> => {
  if (!urls || urls.length === 0) return
  await Promise.all(urls.map(deleteImageFromStorage))
}
