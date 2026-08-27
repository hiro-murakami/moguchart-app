import { Router, Request, Response, NextFunction } from 'express'
import { requireWriteScope } from '../middleware/apiKeyAuth.js'
import selectProjects from '../../scripts/selectProjects.js'
import selectProject from '../../scripts/selectProject.js'
import selectGanttChart from '../../scripts/selectGanttChart.js'
import selectGanttRows from '../../scripts/selectGanttRows.js'
import upsertProject from '../../scripts/upsertProject.js'
import deleteProject from '../../scripts/deleteProject.js'
import duplicateProject from '../../scripts/duplicateProject.js'
import getGanttDataJson from '../../scripts/getGanttDataJson.js'
import downloadProjectZip from '../../scripts/downloadProjectZip.js'
import restoreProject from '../../scripts/restoreProject.js'

const router = Router()

// GET /projects — プロジェクト一覧取得
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await selectProjects(undefined, req.apiKeyUser)
    res.json({ status: 'succeeded', data })
  } catch (e) {
    next(e)
  }
})

// POST /projects/restore — プロジェクト復元（インポート）
router.post('/restore', requireWriteScope, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = await restoreProject(req.body, req.apiKeyUser)
    res.json({ status: 'succeeded', data: projectId })
  } catch (e) {
    next(e)
  }
})

// GET /projects/:id — プロジェクト単体取得
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const data = await selectProject(id, req.apiKeyUser)
    if (!data) {
      res.status(404).json({ status: 'failed', message: 'Project not found' })
      return
    }
    res.json({ status: 'succeeded', data })
  } catch (e) {
    next(e)
  }
})

// POST /projects — プロジェクト作成
router.post('/', requireWriteScope, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = await upsertProject(req.body, req.apiKeyUser)
    res.status(201).json({ status: 'succeeded', data: projectId })
  } catch (e) {
    next(e)
  }
})

// PUT /projects/:id — プロジェクト更新
router.put('/:id', requireWriteScope, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const project = { ...req.body, id }
    const projectId = await upsertProject(project, req.apiKeyUser)
    res.json({ status: 'succeeded', data: projectId })
  } catch (e) {
    next(e)
  }
})

// DELETE /projects/:id — プロジェクト削除
router.delete('/:id', requireWriteScope, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    await deleteProject(id, req.apiKeyUser)
    res.json({ status: 'succeeded' })
  } catch (e) {
    next(e)
  }
})

// POST /projects/:id/duplicate — プロジェクト複製
router.post('/:id/duplicate', requireWriteScope, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const params = {
      originalProjectId: id,
      newProjectData: req.body.newProjectData,
      newStartDate: req.body.newStartDate,
      clearProgress: req.body.clearProgress,
    }
    const projectId = await duplicateProject(params, req.apiKeyUser)
    res.status(201).json({ status: 'succeeded', data: projectId })
  } catch (e) {
    next(e)
  }
})

// GET /projects/:id/chart — ガントチャートデータ取得
router.get('/:id/chart', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const data = await selectGanttChart(id, req.apiKeyUser)
    res.json({ status: 'succeeded', data })
  } catch (e) {
    next(e)
  }
})

// GET /projects/:id/rows — 行データ取得
router.get('/:id/rows', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const rowIdsParam = req.query.rowIds as string | undefined
    const rowIds = rowIdsParam ? rowIdsParam.split(',').map(Number) : []
    const params = { projectId: id, rowIds }
    const data = await selectGanttRows(params, req.apiKeyUser)
    res.json({ status: 'succeeded', data })
  } catch (e) {
    next(e)
  }
})

// GET /projects/:id/json — JSON形式でフルデータ取得
router.get('/:id/json', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const data = await getGanttDataJson(id, req.apiKeyUser)
    res.json({ status: 'succeeded', data })
  } catch (e) {
    next(e)
  }
})

// GET /projects/:id/zip — ZIP形式でダウンロード
router.get('/:id/zip', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const data = await downloadProjectZip(id, req.apiKeyUser)
    res.json({ status: 'succeeded', data })
  } catch (e) {
    next(e)
  }
})

// POST /projects/:id/restore — プロジェクト復元
router.post('/:id/restore', requireWriteScope, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const body = req.body || {}
    if (body.project && !body.project.id) {
      body.project.id = id
    }
    const projectId = await restoreProject(body, req.apiKeyUser)
    res.json({ status: 'succeeded', data: projectId })
  } catch (e) {
    next(e)
  }
})

export default router
