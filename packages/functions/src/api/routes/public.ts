import { Router } from 'express'
import { prisma } from '../../scripts/common/commonFunctions.js'
import { toGanttRow } from '../../scripts/common/converters.js'
import type { Project, Authority, ProjectAttribute, Role } from '../../types/shared.js'
import { toDateTimeString } from '../../scripts/common/commonFunctions.js'
import { omit } from 'lodash'

const router = Router()

/**
 * 公開プロジェクトのプロジェクト情報を取得する（認証不要）
 * GET /api/v1/public/projects/:id
 */
router.get('/projects/:id', async (req, res, next) => {
  try {
    const projectId = req.params.id

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        _count: { select: { comments: true } },
      },
    })

    if (!project) {
      res.status(404).json({ status: 'failed', message: 'Project not found' })
      return
    }

    if (!project.public) {
      res.status(403).json({ status: 'failed', message: 'Project is not public' })
      return
    }

    // 公開プロジェクトのレスポンスを構築（viewer ロール固定）
    const authority = (project.authority ?? {}) as Authority
    const result: Project = {
      ...omit(project, ['createdBy', 'createdAt', 'updatedBy', 'updatedAt']),
      start: toDateTimeString(project.start),
      end: toDateTimeString(project.end),
      attribute: (project.attribute ?? {}) as ProjectAttribute,
      authority,
      role: 'viewer' as Role,
      commentCount: project._count?.comments ?? 0,
    }

    res.json({ status: 'succeeded', data: result })
  } catch (error) {
    next(error)
  }
})

/**
 * 公開プロジェクトのガントチャートデータを取得する（認証不要）
 * GET /api/v1/public/projects/:id/gantt
 */
router.get('/projects/:id/gantt', async (req, res, next) => {
  try {
    const projectId = req.params.id

    // まず公開フラグを確認
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { public: true },
    })

    if (!project) {
      res.status(404).json({ status: 'failed', message: 'Project not found' })
      return
    }

    if (!project.public) {
      res.status(403).json({ status: 'failed', message: 'Project is not public' })
      return
    }

    // ガントチャートデータを取得
    const data = await prisma.ganttRow.findMany({
      where: { projectId },
      include: {
        tasks: {
          include: {
            _count: { select: { comments: true } },
          },
        },
        _count: { select: { comments: true } },
      },
      orderBy: { order: 'asc' },
    })

    res.json({ status: 'succeeded', data: data.map(toGanttRow) })
  } catch (error) {
    next(error)
  }
})

export default router
