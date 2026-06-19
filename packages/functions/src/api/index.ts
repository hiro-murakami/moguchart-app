import * as functions from 'firebase-functions/v2'
import express from 'express'
import { apiKeyAuth } from './middleware/apiKeyAuth.js'
import { errorHandler } from './middleware/errorHandler.js'
import projectsRouter from './routes/projects.js'
import rowsRouter from './routes/rows.js'
import tasksRouter from './routes/tasks.js'
import commentsRouter from './routes/comments.js'
import snapshotsRouter from './routes/snapshots.js'
import userRouter from './routes/user.js'
import apiKeysRouter from './routes/apiKeys.js'

const app = express()

// JSON body parser
app.use(express.json({ limit: '10mb' }))

// ヘルスチェック（認証不要）
app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0' })
})

// APIキー認証（以降のすべてのルートに適用）
app.use('/api/v1', apiKeyAuth)

// ルートの登録
app.use('/api/v1/projects', projectsRouter)
app.use('/api/v1/rows', rowsRouter)
app.use('/api/v1/tasks', tasksRouter)
app.use('/api/v1/comments', commentsRouter)
// スナップショットはプロジェクト配下のネストルート
app.use('/api/v1/projects', snapshotsRouter)
app.use('/api/v1/user', userRouter)
app.use('/api/v1/api-keys', apiKeysRouter)

// 404 ハンドラー
app.use('/api/v1', (_req, res) => {
  res.status(404).json({ status: 'failed', message: 'Endpoint not found' })
})

// エラーハンドリング
app.use(errorHandler)

// Firebase Cloud Functions v2 の onRequest としてエクスポート
export const api = functions.https.onRequest(
  {
    region: 'asia-northeast1',
    // 外部アプリ向けなので全オリジンを許可
    cors: true,
  },
  app,
)
