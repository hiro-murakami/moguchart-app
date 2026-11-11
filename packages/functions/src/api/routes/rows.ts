import { Router, Request, Response, NextFunction } from 'express'
import { requireWriteScope } from '../middleware/apiKeyAuth.js'
import upsertGanttRow from '../../scripts/upsertGanttRow.js'
import deleteGanttRow from '../../scripts/deleteGanttRow.js'
import updateGanttRowOrder from '../../scripts/updateGanttRowOrder.js'

const router = Router()

const parsePositiveIntParam = (value: string | string[] | undefined, label: string): number => {
  const num = Number(value)
  if (!Number.isInteger(num) || num <= 0) {
    throw new Error(`Invalid ${label}`)
  }
  return num
}

// POST /rows — 行の作成
router.post('/', requireWriteScope, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await upsertGanttRow(req.body, req.apiKeyUser)
    res.status(201).json({ status: 'succeeded', data })
  } catch (e) {
    next(e)
  }
})

// PUT /rows — 行の更新（単体または一括）
router.put('/', requireWriteScope, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await upsertGanttRow(req.body, req.apiKeyUser)
    res.json({ status: 'succeeded', data })
  } catch (e) {
    next(e)
  }
})

// PUT /rows/order — 行の並び順更新（/:id より先に定義してルート衝突を防止）
// body: [{ id: number, order: number }, ...]
router.put('/order', requireWriteScope, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await updateGanttRowOrder(req.body, req.apiKeyUser)
    res.json({ status: 'succeeded' })
  } catch (e) {
    next(e)
  }
})

// PUT /rows/:id — 行の単体更新
router.put('/:id', requireWriteScope, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parsePositiveIntParam(req.params.id, 'row ID')
    const row = { ...req.body, id }
    const data = await upsertGanttRow(row, req.apiKeyUser)
    res.json({ status: 'succeeded', data })
  } catch (e) {
    next(e)
  }
})

// DELETE /rows — 行の一括削除
// body: { ids: number[] }
router.delete('/', requireWriteScope, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ids = req.body.ids as number[]
    await deleteGanttRow(ids, req.apiKeyUser)
    res.json({ status: 'succeeded' })
  } catch (e) {
    next(e)
  }
})

// DELETE /rows/:id — 行の単体削除
router.delete('/:id', requireWriteScope, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parsePositiveIntParam(req.params.id, 'row ID')
    await deleteGanttRow([id], req.apiKeyUser)
    res.json({ status: 'succeeded' })
  } catch (e) {
    next(e)
  }
})

export default router
