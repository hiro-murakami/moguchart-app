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
export interface RateLimitOptions {
  /** ウィンドウ内の最大リクエスト数（デフォルト: 60） */
  maxRequests?: number
  /** ウィンドウの長さ（ミリ秒）（デフォルト: 60_000 = 1分） */
  windowMs?: number
  /** Firestore コレクション名（デフォルト: 'rateLimits'） */
  collectionName?: string
  /** 識別モード ('authenticated': 認証確定後のプリンシパル基準 / 'ip': クライアントIP基準) */
  mode?: 'authenticated' | 'ip'
  /** バケット衝突を防ぐプレフィックス */
  keyPrefix?: string
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
function resolveClientIp(req: Request): string {
  if (req.ip) return req.ip
  const xff = req.headers['x-forwarded-for']
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0].trim()
  }
  if (Array.isArray(xff) && xff[0]) {
    return xff[0].split(',')[0].trim()
  }
  return req.socket?.remoteAddress || 'unknown'
}

export function createRateLimiter(options?: RateLimitOptions) {
  const maxRequests = options?.maxRequests ?? 60
  const windowMs = options?.windowMs ?? 60_000
  const collectionName = options?.collectionName ?? 'rateLimits'
  const mode = options?.mode ?? 'authenticated'
  const keyPrefix = options?.keyPrefix ?? mode

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    let rawSubject: string | undefined
    if (mode === 'ip') {
      rawSubject = resolveClientIp(req)
    } else {
      // 必ず検証済み認証結果 (req.authRateLimitKey / req.apiKeyUser) のみを使用し、
      // 未検証の X-API-Key ヘッダーによるバケット偽装・レート制限バイパスを防止する
      rawSubject = req.authRateLimitKey ?? req.apiKeyUser
    }

    if (!rawSubject) {
      next()
      return
    }

    const identifier = hashIdentifier(`${keyPrefix}:${rawSubject}`)

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
