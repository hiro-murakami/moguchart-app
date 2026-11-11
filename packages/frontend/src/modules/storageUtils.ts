import { deleteProjectImages } from '@/modules/scripts'

/**
 * Firebase Storage から指定URLの画像を削除する。
 * Cloud Functions 側でプロジェクトの編集権限を検証した上で安全に削除する。
 * エラーが発生しても例外をスローせず、コンソールに警告を出して続行する。
 */
export const deleteImageFromStorage = async (url: string): Promise<void> => {
  if (!url) return
  await deleteImagesFromStorage([url])
}

/**
 * Firebase Storage から複数の画像URLを一括削除する。
 * Cloud Functions 側でプロジェクトの編集権限を検証した上で一括削除し、エラーは無視して続行する。
 */
export const deleteImagesFromStorage = async (urls: string[]): Promise<void> => {
  if (!urls || urls.length === 0) return
  try {
    await deleteProjectImages(urls)
  } catch (err) {
    console.warn('Storage画像削除エラー（無視して続行）:', err)
  }
}
