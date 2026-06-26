import { Request, Response, NextFunction } from 'express'
import { getAuth } from 'firebase-admin/auth'
import { prisma } from '../../scripts/common/commonFunctions.js'

// Express の Request にカスタムプロパティを追加
declare global {
  namespace Express {
    interface Request {
      /** APIキーに紐づくユーザーのメールアドレス */
      apiKeyUser?: string
      /** APIキーのスコープ ('read' | 'read-write') */
      apiKeyScope?: string
    }
  }
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
  const apiKey = req.headers['x-api-key'] as string | undefined

  // 1. Firebase IDトークン認証
  if (authHeader?.startsWith('Bearer ')) {
    const idToken = authHeader.substring(7)
    try {
      const decodedToken = await getAuth().verifyIdToken(idToken)
      if (!decodedToken.email) {
        res.status(401).json({
          status: 'failed',
          message: 'Firebase user does not have an email address.',
        })
        return
      }
      req.apiKeyUser = decodedToken.email
      req.apiKeyScope = 'read-write' // Firebase認証ユーザーはフル権限
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
    try {
      const keyRecord = await prisma.apiKey.findUnique({
        where: { key: apiKey },
      })

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
