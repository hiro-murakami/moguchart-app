import { Request, Response, NextFunction } from 'express'
import { getAuth } from 'firebase-admin/auth'
import crypto from 'crypto'
import { prisma } from '../../scripts/common/commonFunctions.js'
import type { AuthContext } from '../../types/shared.js'

// Express の Request にカスタムプロパティを追加
declare global {
  namespace Express {
    interface Request {
      /** APIキーに紐づくユーザーのメールアドレス */
      apiKeyUser?: string
      /** APIキーのスコープ ('read' | 'read-write') */
      apiKeyScope?: string
      /** Firebase IDトークン由来の検証済み認証コンテキスト */
      authContext?: AuthContext
      /** 検証済み認証情報に基づくレート制限キー */
      authRateLimitKey?: string
    }
  }
}

const API_KEY_FORMAT_RE = /^mk_[A-Za-z0-9_-]{16,120}$/

/**
 * 生のAPIキーから、先頭8文字プレフィックス + ':' + SHA-256ダイジェスト(55文字) の64文字保存値を生成する。
 * 既存スキーマ (@db.VarChar(64)) と一覧マスク表示を維持しつつ平文保存を排除する。
 */
export function formatStoredApiKey(rawKey: string): string {
  const prefix = rawKey.substring(0, 8)
  const digest = crypto.createHash('sha256').update(rawKey, 'utf8').digest('hex').substring(0, 55)
  return `${prefix}:${digest}`
}

/**
 * MySQL の大文字小文字非区別照合順序 (_ci) やタイミング攻撃を防ぐ定数時間比較
 */
export function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) {
    return false
  }
  return crypto.timingSafeEqual(bufA, bufB)
}

/**
 * APIキー認証ミドルウェア（デュアル認証対応）
 *
 * 以下の順で認証を試みる:
 * 1. Authorization: Bearer <Firebase IDトークン> — フロントエンドからの管理操作用
 * 2. X-API-Key ヘッダー — 外部アプリからのAPI利用用
 *
 * どちらも未設定の場合は 401 を返す。
 */
export const apiKeyAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers['authorization'] as string | undefined
  const rawApiKeyHeader = req.headers['x-api-key']
  const apiKey = typeof rawApiKeyHeader === 'string' ? rawApiKeyHeader.trim() : undefined

  // 1. Firebase IDトークン認証
  if (authHeader?.startsWith('Bearer ')) {
    const idToken = authHeader.substring(7)
    try {
      const decodedToken = await getAuth().verifyIdToken(idToken)
      const isAnonymous = decodedToken.firebase?.sign_in_provider === 'anonymous'
      if (isAnonymous || !decodedToken.email || decodedToken.email_verified !== true) {
        res.status(401).json({
          status: 'failed',
          message: 'Firebase user does not have a verified email address.',
        })
        return
      }
      req.apiKeyUser = decodedToken.email
      req.apiKeyScope = 'read-write' // Firebase認証ユーザーはフル権限
      req.authContext = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: true,
        isAnonymous: false,
      }
      req.authRateLimitKey = `uid:${decodedToken.uid}`
      next()
      return
    } catch {
      res.status(401).json({
        status: 'failed',
        message: 'Invalid or expired Firebase ID token.',
      })
      return
    }
  }

  // 2. APIキー認証
  if (apiKey) {
    if (!API_KEY_FORMAT_RE.test(apiKey)) {
      res.status(401).json({
        status: 'failed',
        message: 'Invalid or inactive API key.',
      })
      return
    }

    try {
      const expectedStoredKey = formatStoredApiKey(apiKey)
      let keyRecord = await prisma.apiKey.findUnique({
        where: { key: expectedStoredKey },
      })

      if (keyRecord && !timingSafeEqualStrings(keyRecord.key, expectedStoredKey)) {
        keyRecord = null
      }

      // 既存平文キーの後方互換フォールバックと透過的ハッシュ移行
      if (!keyRecord) {
        const legacyRecord = await prisma.apiKey.findUnique({
          where: { key: apiKey },
        })
        if (
          legacyRecord &&
          !legacyRecord.key.includes(':') &&
          timingSafeEqualStrings(legacyRecord.key, apiKey)
        ) {
          keyRecord = legacyRecord
          if (legacyRecord.active) {
            prisma.apiKey
              .update({
                where: { id: legacyRecord.id },
                data: { key: expectedStoredKey, lastUsedAt: new Date() },
              })
              .catch(() => {
                // マイグレーション競合等は無視
              })
          }
        }
      }

      if (!keyRecord || !keyRecord.active) {
        res.status(401).json({
          status: 'failed',
          message: 'Invalid or inactive API key.',
        })
        return
      }

      // リクエストにユーザー情報をアタッチ
      req.apiKeyUser = keyRecord.email
      req.apiKeyScope = keyRecord.scope
      req.authRateLimitKey = `apikey:${keyRecord.id}`

      // 最終使用日時を非同期で更新（レスポンスをブロックしない）
      prisma.apiKey
        .update({
          where: { id: keyRecord.id },
          data: { lastUsedAt: new Date() },
        })
        .catch(() => {
          // 更新失敗は無視する
        })

      next()
      return
    } catch {
      res.status(500).json({
        status: 'failed',
        message: 'Authentication error.',
      })
      return
    }
  }

  // どちらのヘッダーも未設定
  res.status(401).json({
    status: 'failed',
    message: 'Authentication required. Set Authorization (Bearer token) or X-API-Key header.',
  })
}

/**
 * 書き込み操作のスコープチェックミドルウェア
 * scope が 'read' のAPIキーで書き込み操作を行おうとした場合に 403 を返す。
 */
export const requireWriteScope = (req: Request, res: Response, next: NextFunction): void => {
  if (req.apiKeyScope === 'read') {
    res.status(403).json({
      status: 'failed',
      message: 'This API key has read-only access. A read-write key is required for this operation.',
    })
    return
  }
  next()
}

/**
 * APIキー管理操作を Firebase IDトークン（Web UI セッション）のみに制限するミドルウェア。
 * 既存の API キーを使ったキー自己増殖・一覧取得・無効化を禁止する。
 */
export const requireFirebaseAuth = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.authContext || req.authContext.isAnonymous || !req.authContext.emailVerified) {
    res.status(403).json({
      status: 'failed',
      message: 'API key management requires a verified Firebase ID token.',
    })
    return
  }
  next()
}
