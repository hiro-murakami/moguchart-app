import { Router, Request, Response, NextFunction } from 'express'
import { requireWriteScope } from '../middleware/apiKeyAuth.js'
import selectUser from '../../scripts/selectUser.js'
import upsertUser from '../../scripts/upsertUser.js'

const router = Router()

// GET /user — 自分のユーザー情報取得
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await selectUser(req.apiKeyUser!, req.apiKeyUser, req.authContext)
    res.json({ status: 'succeeded', data })
  } catch (e) {
    next(e)
  }
})

// PUT /user — ユーザー情報更新
router.put('/', requireWriteScope, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.apiKeyUser && !req.authContext) {
      throw new Error('Permission denied: authentication required')
    }
    await upsertUser(req.body, req.apiKeyUser, req.authContext)
    res.json({ status: 'succeeded' })
  } catch (e) {
    next(e)
  }
})

export default router
