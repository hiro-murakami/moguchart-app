import { Router, Request, Response, NextFunction } from 'express'
import { requireWriteScope } from '../middleware/apiKeyAuth.js'
import createSnapshot from '../../scripts/createSnapshot.js'
import loadSnapshot from '../../scripts/loadSnapshot.js'
import listSnapshots from '../../scripts/listSnapshots.js'
import getSnapshotDownloadUrl from '../../scripts/getSnapshotDownloadUrl.js'
import deleteSnapshot from '../../scripts/deleteSnapshot.js'

const router = Router()

// GET /projects/:id/snapshots — スナップショット一覧
router.get('/:id/snapshots', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const data = await listSnapshots(id, req.apiKeyUser)
    res.json({ status: 'succeeded', data })
  } catch (e) {
    next(e)
  }
})

// POST /projects/:id/snapshots — スナップショット作成
router.post(
  '/:id/snapshots',
  requireWriteScope,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string
      const params = {
        projectId: id,
        displayName: req.body.displayName,
      }
      const data = await createSnapshot(params, req.apiKeyUser)
      res.status(201).json({ status: 'succeeded', data })
    } catch (e) {
      next(e)
    }
  },
)

// GET /projects/:id/snapshots/:name — スナップショット取得
router.get('/:id/snapshots/:name', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const name = req.params.name as string
    const params = { projectId: id, snapshotName: name }
    const data = await loadSnapshot(params, req.apiKeyUser)
    res.json({ status: 'succeeded', data })
  } catch (e) {
    next(e)
  }
})

// GET /projects/:id/snapshots/:name/url — ダウンロードURL取得
router.get('/:id/snapshots/:name/url', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const name = req.params.name as string
    const params = { projectId: id, snapshotName: name }
    const data = await getSnapshotDownloadUrl(params, req.apiKeyUser)
    res.json({ status: 'succeeded', data })
  } catch (e) {
    next(e)
  }
})

// DELETE /projects/:id/snapshots/:name — スナップショット削除
router.delete(
  '/:id/snapshots/:name',
  requireWriteScope,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string
      const name = req.params.name as string
      const params = { projectId: id, snapshotName: name }
      await deleteSnapshot(params, req.apiKeyUser)
      res.json({ status: 'succeeded' })
    } catch (e) {
      next(e)
    }
  },
)

export default router
