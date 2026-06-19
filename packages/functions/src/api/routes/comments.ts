import { Router, Request, Response, NextFunction } from 'express'
import { requireWriteScope } from '../middleware/apiKeyAuth.js'
import selectComments from '../../scripts/selectComments.js'
import upsertComment from '../../scripts/upsertComment.js'
import deleteComment from '../../scripts/deleteComment.js'
import selectTaskComments from '../../scripts/selectTaskComments.js'
import upsertTaskComment from '../../scripts/upsertTaskComment.js'
import deleteTaskComment from '../../scripts/deleteTaskComment.js'

const router = Router()

// GET /comments — コメント一覧取得
// query: taskId, rowId, projectId
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params: { taskId?: number; rowId?: number; projectId?: string } = {}
    if (req.query.taskId) params.taskId = Number(req.query.taskId)
    if (req.query.rowId) params.rowId = Number(req.query.rowId)
    if (req.query.projectId) params.projectId = req.query.projectId as string
    const data = await selectComments(params, req.apiKeyUser)
    res.json({ status: 'succeeded', data })
  } catch (e) {
    next(e)
  }
})

// POST /comments — コメント作成/更新
router.post('/', requireWriteScope, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const commentId = await upsertComment(req.body, req.apiKeyUser)
    res.status(201).json({ status: 'succeeded', data: commentId })
  } catch (e) {
    next(e)
  }
})

// DELETE /comments/:id — コメント削除
router.delete('/:id', requireWriteScope, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    await deleteComment(Number(id), req.apiKeyUser)
    res.json({ status: 'succeeded' })
  } catch (e) {
    next(e)
  }
})

// GET /tasks/:taskId/comments — タスクコメント取得
router.get('/tasks/:taskId/comments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskId = req.params.taskId as string
    const data = await selectTaskComments(Number(taskId), req.apiKeyUser)
    res.json({ status: 'succeeded', data })
  } catch (e) {
    next(e)
  }
})

// POST /tasks/:taskId/comments — タスクコメント作成/更新
router.post(
  '/tasks/:taskId/comments',
  requireWriteScope,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const taskId = req.params.taskId as string
      const comment = { ...req.body, taskId: Number(taskId) }
      const commentId = await upsertTaskComment(comment, req.apiKeyUser)
      res.status(201).json({ status: 'succeeded', data: commentId })
    } catch (e) {
      next(e)
    }
  },
)

// DELETE /tasks/comments/:id — タスクコメント削除
router.delete(
  '/tasks/comments/:id',
  requireWriteScope,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string
      await deleteTaskComment(Number(id), req.apiKeyUser)
      res.json({ status: 'succeeded' })
    } catch (e) {
      next(e)
    }
  },
)

export default router
