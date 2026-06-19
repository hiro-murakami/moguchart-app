import { Router, Request, Response, NextFunction } from 'express'
import { requireWriteScope } from '../middleware/apiKeyAuth.js'
import upsertGanttTasks from '../../scripts/upsertGanttTasks.js'
import deleteGanttTask from '../../scripts/deleteGanttTask.js'

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

// DELETE /tasks — タスクの削除
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

export default router
