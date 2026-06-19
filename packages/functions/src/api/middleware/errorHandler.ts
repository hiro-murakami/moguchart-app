import { Request, Response, NextFunction } from 'express'
import * as functions from 'firebase-functions/v2'

/**
 * 統一エラーハンドリングミドルウェア
 * ビジネスロジックからのエラーを適切なHTTPステータスにマッピングする。
 */
export const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction): void => {
  functions.logger.error('API Error:', err.message, err.stack)

  const message = err.message || 'Internal server error'

  // エラーメッセージに基づいてHTTPステータスを判定
  if (message.includes('Permission denied')) {
    res.status(403).json({ status: 'failed', message })
    return
  }
  if (message.includes('not found') || message.includes('Not found')) {
    res.status(404).json({ status: 'failed', message })
    return
  }
  if (message.includes('required') || message.includes('Invalid')) {
    res.status(400).json({ status: 'failed', message })
    return
  }

  res.status(500).json({ status: 'failed', message: 'Internal server error' })
}
