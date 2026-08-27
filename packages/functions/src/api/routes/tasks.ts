import { Router, Request, Response, NextFunction } from 'express'
import { requireWriteScope } from '../middleware/apiKeyAuth.js'
import upsertGanttTasks from '../../scripts/upsertGanttTasks.js'
import deleteGanttTask from '../../scripts/deleteGanttTask.js'
import selectTaskComments from '../../scripts/selectTaskComments.js'
import upsertTaskComment from '../../scripts/upsertTaskComment.js'
import deleteTaskComment from '../../scripts/deleteTaskComment.js'

const router = Router()

// POST /tasks — タスクの作成/更新
// body: { tasks: GanttTask[] }
router.post('/', requireWriteScope, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tasks = req.body.tasks || req.body
    const data = await upsertGanttTasks(Array.isArray(tasks) ? tasks : [tasks], req.apiKeyUser)
    res.status(201).json({ status: 'succeeded', data })
  } catch (e) {
    next(e)
  }
})

// PUT /tasks — タスクの更新（単体または一括）
// body: { tasks: GanttTask[] } | GanttTask[] | GanttTask
router.put('/', requireWriteScope, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tasks = req.body.tasks || req.body
    const data = await upsertGanttTasks(Array.isArray(tasks) ? tasks : [tasks], req.apiKeyUser)
    res.json({ status: 'succeeded', data })
  } catch (e) {
    next(e)
  }
})

// PUT /tasks/:id — タスクの単体更新
router.put('/:id', requireWriteScope, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id)
    const task = { ...req.body, id }
    const data = await upsertGanttTasks([task], req.apiKeyUser)
    res.json({ status: 'succeeded', data })
  } catch (e) {
    next(e)
  }
})

// DELETE /tasks — タスクの一括削除
// body: { ids: number[] }
router.delete('/', requireWriteScope, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ids = req.body.ids as number[]
    await deleteGanttTask(ids, req.apiKeyUser)
    res.json({ status: 'succeeded' })
  } catch (e) {
    next(e)
  }
})

// DELETE /tasks/:id — タスクの単体削除
router.delete('/:id', requireWriteScope, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id)
    await deleteGanttTask([id], req.apiKeyUser)
    res.json({ status: 'succeeded' })
  } catch (e) {
    next(e)
  }
})

// GET /tasks/:id/comments — タスクコメント一覧取得
router.get('/:id/comments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskId = Number(req.params.id)
    const data = await selectTaskComments(taskId, req.apiKeyUser)
    res.json({ status: 'succeeded', data })
  } catch (e) {
    next(e)
  }
})

// POST /tasks/:id/comments — タスクコメント作成/更新
router.post('/:id/comments', requireWriteScope, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskId = Number(req.params.id)
    const comment = { ...req.body, taskId }
    const commentId = await upsertTaskComment(comment, req.apiKeyUser)
    res.status(201).json({ status: 'succeeded', data: commentId })
  } catch (e) {
    next(e)
  }
})

// DELETE /tasks/:id/comments/:commentId — タスクコメント削除
router.delete('/:id/comments/:commentId', requireWriteScope, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const commentId = Number(req.params.commentId)
    await deleteTaskComment(commentId, req.apiKeyUser)
    res.json({ status: 'succeeded' })
  } catch (e) {
    next(e)
  }
})

export default router
