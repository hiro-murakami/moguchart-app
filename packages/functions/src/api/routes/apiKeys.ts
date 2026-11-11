import { Router, Request, Response, NextFunction } from 'express'
import {
  formatStoredApiKey,
  requireFirebaseAuth,
  requireWriteScope,
} from '../middleware/apiKeyAuth.js'
import { prisma } from '../../scripts/common/commonFunctions.js'
import crypto from 'crypto'

const router = Router()

/** 1ユーザーあたりの有効なAPIキー最大発行数 */
export const MAX_ACTIVE_API_KEYS_PER_USER = 10

// APIキー管理エンドポイントはすべて Firebase IDトークン（Web UI）必須
router.use(requireFirebaseAuth)

/**
 * mk_ プレフィックス付きのAPIキーを生成する
 */
const generateKey = (): string => {
  const randomPart = crypto.randomBytes(24).toString('base64url') // 32文字
  return `mk_${randomPart}`
}

// GET /api-keys — 自分のAPIキー一覧取得
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const keys = await prisma.apiKey.findMany({
      where: { email: req.apiKeyUser },
      select: {
        id: true,
        name: true,
        scope: true,
        active: true,
        lastUsedAt: true,
        createdAt: true,
        // key カラムには先頭8文字プレフィックス + SHA-256ダイジェストが格納される
        key: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    // キーは先頭8文字 + マスクで返す
    const maskedKeys = keys.map((k: typeof keys[number]) => ({
      ...k,
      key: `${k.key.substring(0, 8)}${'*'.repeat(24)}`,
    }))
    res.json({ status: 'succeeded', data: maskedKeys })
  } catch (e) {
    next(e)
  }
})

// POST /api-keys — 新しいAPIキー生成
// body: { name: string, scope?: 'read' | 'read-write' }
router.post('/', requireWriteScope, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawName = req.body?.name
    const scope = req.body?.scope
    const trimmedName = typeof rawName === 'string' ? rawName.trim() : ''
    if (!trimmedName || trimmedName.length > 100) {
      res.status(400).json({
        status: 'failed',
        message: 'name is required and must be 100 characters or fewer',
      })
      return
    }

    const activeCount = await prisma.apiKey.count({
      where: {
        email: req.apiKeyUser!,
        active: true,
      },
    })
    if (activeCount >= MAX_ACTIVE_API_KEYS_PER_USER) {
      res.status(400).json({
        status: 'failed',
        message: `Maximum number of active API keys (${MAX_ACTIVE_API_KEYS_PER_USER}) reached.`,
      })
      return
    }

    const validScopes = ['read', 'read-write']
    const keyScope = validScopes.includes(scope) ? scope : 'read-write'

    const rawKey = generateKey()
    const storedKey = formatStoredApiKey(rawKey)
    const apiKey = await prisma.apiKey.create({
      data: {
        key: storedKey,
        name: trimmedName,
        email: req.apiKeyUser!,
        scope: keyScope,
      },
    })

    // 作成直後のみ、平文のフルキーを返す（DBにはハッシュのみ保存）
    res.status(201).json({
      status: 'succeeded',
      data: {
        id: apiKey.id,
        key: rawKey, // フルキー（この1回のみ表示）
        name: apiKey.name,
        scope: apiKey.scope,
        createdAt: apiKey.createdAt,
      },
      message: 'API key created. Save the key now — it will not be shown again.',
    })
  } catch (e) {
    next(e)
  }
})

// DELETE /api-keys/:id — APIキー無効化（論理削除）
router.delete('/:id', requireWriteScope, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 自分のキーのみ無効化可能
    const keyId = req.params.id as string
    const existing = await prisma.apiKey.findUnique({
      where: { id: keyId },
    })
    if (!existing || existing.email !== req.apiKeyUser) {
      res.status(404).json({ status: 'failed', message: 'API key not found' })
      return
    }

    await prisma.apiKey.update({
      where: { id: keyId },
      data: { active: false },
    })
    res.json({ status: 'succeeded' })
  } catch (e) {
    next(e)
  }
})

export default router
