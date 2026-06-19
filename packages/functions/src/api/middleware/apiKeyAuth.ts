import { Request, Response, NextFunction } from 'express'
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
 * APIキー認証ミドルウェア
 * X-API-Key ヘッダーからキーを取得し、DBで検証する。
 */
export const apiKeyAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const apiKey = req.headers['x-api-key'] as string | undefined

  if (!apiKey) {
    res.status(401).json({
      status: 'failed',
      message: 'API key is required. Set the X-API-Key header.',
    })
    return
  }

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
  } catch (error) {
    res.status(500).json({
      status: 'failed',
      message: 'Authentication error.',
    })
  }
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
