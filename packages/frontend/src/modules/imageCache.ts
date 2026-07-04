/**
 * 画像の Blob Object URL キャッシュモジュール
 *
 * barContent() がスクロールや現在時刻線更新のたびに呼ばれて
 * 新しい img 要素を生成する問題への対策。
 *
 * 画像URLを初回に fetch → Blob → URL.createObjectURL() に変換してキャッシュし、
 * 以降は blob: URL を返すことでネットワークリクエストを完全に排除する。
 *
 * Firebase Storage は Cache-Control: private, max-age=0 を返すため
 * ブラウザのHTTPキャッシュが効かない。そのためアプリケーション側で
 * Blob Object URL によるキャッシュを実装する。
 */

/** キャッシュエントリ: Object URL と最終アクセス時刻 */
interface CacheEntry {
  objectUrl: string
  lastAccess: number
}

/** 元URL → Object URL のキャッシュ */
const cache = new Map<string, CacheEntry>()

/**
 * フェッチ中 or 完了済みの Promise を保持する。
 * - 同一URLの重複フェッチを防止
 * - 失敗した場合もエントリを残すことで再試行を防止（ネガティブキャッシュ）
 */
const fetched = new Map<string, Promise<string | null>>()

/** キャッシュの最大エントリ数 */
const MAX_CACHE_SIZE = 200

/**
 * キャッシュサイズが上限を超えた場合、古いエントリを削除する（LRU方式）
 */
const evictIfNeeded = () => {
  if (cache.size <= MAX_CACHE_SIZE) return

  const entries = [...cache.entries()].sort((a, b) => a[1].lastAccess - b[1].lastAccess)
  const toRemove = entries.slice(0, cache.size - MAX_CACHE_SIZE)
  for (const [url, entry] of toRemove) {
    URL.revokeObjectURL(entry.objectUrl)
    cache.delete(url)
    fetched.delete(url)
  }
}

/**
 * 画像URLをフェッチして Blob Object URL を生成する。
 * 成功時はキャッシュに追加、失敗時は null を返す（再試行しない）。
 */
const fetchAndCache = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url)
    if (!response.ok) return null

    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)

    cache.set(url, { objectUrl, lastAccess: Date.now() })
    evictIfNeeded()

    return objectUrl
  } catch {
    // CORS エラーなどの場合は null
    // fetched Map にはエントリが残るので再試行されない
    return null
  }
}

/**
 * キャッシュ済みの画像URLを返す。
 *
 * - キャッシュにあれば Object URL を即座に返す（ネットワークリクエストなし）
 * - キャッシュになければ元URLを返しつつ、バックグラウンドで fetch & キャッシュ
 * - 次回以降はキャッシュ済み Object URL が返される
 * - フェッチ失敗時は元URLを返し続ける（再フェッチしない）
 */
export const getCachedImageUrl = (url: string): string => {
  const entry = cache.get(url)
  if (entry) {
    entry.lastAccess = Date.now()
    return entry.objectUrl
  }

  // バックグラウンドで fetch を開始（一度だけ）
  if (!fetched.has(url)) {
    fetched.set(url, fetchAndCache(url))
  }

  return url
}

/**
 * 画像URLを img 要素に設定する。
 * キャッシュがあればそれを即座に設定し、なければ元URLを設定しつつ
 * バックグラウンドでキャッシュ構築後に src を差し替える。
 */
export const setImageSrc = (imgEl: HTMLImageElement, url: string): void => {
  const entry = cache.get(url)
  if (entry) {
    entry.lastAccess = Date.now()
    imgEl.src = entry.objectUrl
    return
  }

  // 初回は元URLを設定
  imgEl.src = url

  // バックグラウンドでキャッシュ構築（一度だけ）
  let promise = fetched.get(url)
  if (!promise) {
    promise = fetchAndCache(url)
    fetched.set(url, promise)
  }

  // キャッシュ完了後に src を差し替え（要素がまだDOMにあれば）
  promise.then((objectUrl) => {
    if (objectUrl && imgEl.isConnected) {
      imgEl.src = objectUrl
    }
  })
}

/**
 * 画像URLのリストをバックグラウンドでプリロードする。
 */
export const preloadImages = (urls: string[]): void => {
  for (const url of urls) {
    if (!url || fetched.has(url)) continue
    fetched.set(url, fetchAndCache(url))
  }
}

/**
 * キャッシュをすべてクリアし、Object URL を解放する。
 */
export const clearImageCache = (): void => {
  for (const entry of cache.values()) {
    URL.revokeObjectURL(entry.objectUrl)
  }
  cache.clear()
  fetched.clear()
}
