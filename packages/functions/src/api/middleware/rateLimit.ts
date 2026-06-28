import { Request, Response, NextFunction } from 'express'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import * as functions from 'firebase-functions/v2'
import { createHash } from 'crypto'

// Firebase Admin SDK の初期化（まだ初期化されていない場合のみ）
if (getApps().length === 0) {
  initializeApp()
}

/** レートリミットの設定オプション */
interface RateLimitOptions {
  /** ウィンドウ内の最大リクエスト数（デフォルト: 60） */
  maxRequests?: number
  /** ウィンドウの長さ（ミリ秒）（デフォルト: 60_000 = 1分） */
  windowMs?: number
  /** Firestore コレクション名（デフォルト: 'rateLimits'） */
  collectionName?: string
}

/** Firestore に保存するレートリミットドキュメントの型 */
interface RateLimitDoc {
  /** 現在のウィンドウのリクエスト数 */
  currentCount: number
  /** 前のウィンドウのリクエスト数 */
  previousCount: number
  /** 現在のウィンドウの開始時刻 */
  windowStart: Timestamp
  /** 最終更新日時 */
  updatedAt: Timestamp
}

/**
 * APIキーまたはメールアドレスからレートリミット用の識別子を生成する。
 * 元のキー文字列を Firestore に保存しないよう SHA-256 でハッシュ化する。
 */
function hashIdentifier(value: string): string {
  return createHash('sha256').update(value).digest('hex').substring(0, 32)
}

/**
 * ウィンドウの開始時刻を計算する。
 * 現在時刻をウィンドウサイズで切り捨てて、固定のウィンドウ境界を作る。
 */
function getWindowStart(now: number, windowMs: number): number {
  return Math.floor(now / windowMs) * windowMs
}

/**
 * Firestore ベースのスライディングウィンドウレートリミットミドルウェアを生成する。
 *
 * - APIキー（X-API-Key）または Firebase IDトークン（メールアドレス）で
 *   ユーザーを識別し、Firestore にリクエストカウントを保存する
 * - スライディングウィンドウカウンターアルゴリズムにより、
 *   固定ウィンドウのバースト問題を軽減する
 * - Firestore 障害時はフェイルオープン（リクエストを通す）
 * - 標準レートリミットヘッダーをレスポンスに付与する
 *
 * @example
 * ```ts
 * // デフォルト設定（60 req/min）
 * app.use('/api/v1', createRateLimiter())
 *
 * // カスタム設定
 * app.use('/api/v1/heavy', createRateLimiter({ maxRequests: 10, windowMs: 60_000 }))
 * ```
 */
export function createRateLimiter(options?: RateLimitOptions) {
  const maxRequests = options?.maxRequests ?? 60
  const windowMs = options?.windowMs ?? 60_000
  const collectionName = options?.collectionName ?? 'rateLimits'

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // 認証ミドルウェアで設定された識別子を取得
    const apiKey = req.headers['x-api-key'] as string | undefined
    const userEmail = req.apiKeyUser

    // 識別子がない場合（認証前のリクエスト）はスキップ
    if (!apiKey && !userEmail) {
      next()
      return
    }

    // APIキーが優先、なければメールアドレスをハッシュ化
    const identifier = hashIdentifier(apiKey ?? userEmail!)

    try {
      const db = getFirestore()
      const docRef = db.collection(collectionName).doc(identifier)
      const now = Date.now()
      const currentWindowStart = getWindowStart(now, windowMs)

      // Firestore トランザクションでカウントをアトミックに更新
      const result = await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(docRef)
        const data = snapshot.data() as RateLimitDoc | undefined

        let currentCount: number
        let previousCount: number

        if (!data) {
          // 初回リクエスト: 新規ドキュメントを作成
          currentCount = 1
          previousCount = 0
          transaction.set(docRef, {
            currentCount,
            previousCount,
            windowStart: Timestamp.fromMillis(currentWindowStart),
            updatedAt: Timestamp.now(),
          })
        } else {
          const docWindowStart = data.windowStart.toMillis()

          if (currentWindowStart === docWindowStart) {
            // 同じウィンドウ内: カウントをインクリメント
            currentCount = data.currentCount + 1
            previousCount = data.previousCount
            transaction.update(docRef, {
              currentCount,
              updatedAt: Timestamp.now(),
            })
          } else if (currentWindowStart === docWindowStart + windowMs) {
            // 次のウィンドウに移行: 現在→前、新しいカウント開始
            currentCount = 1
            previousCount = data.currentCount
            transaction.update(docRef, {
              currentCount,
              previousCount,
              windowStart: Timestamp.fromMillis(currentWindowStart),
              updatedAt: Timestamp.now(),
            })
          } else {
            // 2ウィンドウ以上経過: リセット
            currentCount = 1
            previousCount = 0
            transaction.update(docRef, {
              currentCount,
              previousCount,
              windowStart: Timestamp.fromMillis(currentWindowStart),
              updatedAt: Timestamp.now(),
            })
          }
        }

        return { currentCount, previousCount }
      })

      // スライディングウィンドウの重み付きカウントを計算
      const elapsedInWindow = now - currentWindowStart
      const elapsedRatio = elapsedInWindow / windowMs
      const weightedCount =
        result.previousCount * (1 - elapsedRatio) + result.currentCount

      // 残りリクエスト数とリセット時刻を計算
      const remaining = Math.max(0, Math.floor(maxRequests - weightedCount))
      const resetTimestamp = Math.ceil((currentWindowStart + windowMs) / 1000)

      // 標準レートリミットヘッダーを付与
      res.setHeader('RateLimit-Limit', String(maxRequests))
      res.setHeader('RateLimit-Remaining', String(remaining))
      res.setHeader('RateLimit-Reset', String(resetTimestamp))

      // レートリミット超過チェック
      if (weightedCount > maxRequests) {
        const retryAfterSeconds = Math.ceil(
          (currentWindowStart + windowMs - now) / 1000,
        )
        res.setHeader('Retry-After', String(retryAfterSeconds))
        res.status(429).json({
          status: 'failed',
          message: 'Too many requests. Please try again later.',
          retryAfter: retryAfterSeconds,
        })
        return
      }

      next()
    } catch (err) {
      // フェイルオープン: Firestore 障害時はリクエストを通す
      functions.logger.warn('[rateLimit] Firestore error, failing open:', err)
      next()
    }
  }
}
