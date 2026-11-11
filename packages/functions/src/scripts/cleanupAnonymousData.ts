import { onSchedule } from 'firebase-functions/v2/scheduler'
import * as functions from 'firebase-functions/v2'
import type { Authority } from '../types/shared.js'
import {
  deleteProjectAclFromFirestore,
  getStorageBucket,
  prisma,
} from './common/commonFunctions.js'

/** クリーンアップ対象とする経過時間（ミリ秒）- 24時間 */
const CLEANUP_AGE_MS = 24 * 60 * 60 * 1000

/**
 * 定期実行: 匿名ログインで生成された古い Project と User データを一括削除
 *
 * - 1時間ごとに実行
 * - 最終更新日時（updatedAt）から24時間経過した匿名データを削除対象とする
 * - 匿名から正規アカウントへリンク済みのユーザーや、正規メンバーが1人でも含まれるプロジェクトは誤削除しない
 */
export const cleanupAnonymousData = onSchedule(
  {
    schedule: 'every 60 minutes',
    region: 'asia-northeast1',
    timeZone: 'Asia/Tokyo',
  },
  async () => {
    const cutoff = new Date(Date.now() - CLEANUP_AGE_MS)

    try {
      // --- 1. 匿名プロジェクトの削除 ---
      // updatedAt が 24時間より古いプロジェクトを取得（メンバー・authority情報も含めて判定）
      const oldProjects = await prisma.project.findMany({
        where: {
          updatedAt: { lt: cutoff },
        },
        select: {
          id: true,
          createdBy: true,
          authority: true,
          members: {
            select: {
              userId: true,
              email: true,
            },
          },
        },
      })

      // 参照されている全UIDを収集し、正規メールアドレスを持つユーザー（アカウント昇格済み等）を特定する
      const candidateUids = new Set<string>()
      for (const p of oldProjects) {
        if (p.createdBy && !p.createdBy.includes('@') && p.createdBy !== 'system') {
          candidateUids.add(p.createdBy)
        }
        for (const m of p.members) {
          if (m.userId && !m.userId.includes('@')) {
            candidateUids.add(m.userId)
          }
        }
        const auth = (p.authority as Authority) || {}
        const authIds = [...(auth.owners || []), ...(auth.editors || []), ...(auth.viewers || [])]
        for (const id of authIds) {
          if (typeof id === 'string' && id && !id.includes('@')) {
            candidateUids.add(id)
          }
        }
      }

      const registeredUsers =
        candidateUids.size > 0
          ? await prisma.user.findMany({
              where: { id: { in: Array.from(candidateUids) } },
              select: { id: true, email: true },
            })
          : []
      const registeredEmailUidSet = new Set(
        registeredUsers.filter((u) => Boolean(u.email && u.email.includes('@'))).map((u) => u.id),
      )

      const isRegisteredIdentifier = (id: string | null | undefined): boolean => {
        if (!id) return false
        if (id === 'system') return true
        if (id.includes('@')) return true
        return registeredEmailUidSet.has(id)
      }

      const projectIds = oldProjects
        .filter((p) => {
          // 作成者が存在しない、または正規ユーザー（昇格済みUID含む）/ system の場合は削除しない
          if (!p.createdBy || isRegisteredIdentifier(p.createdBy)) {
            return false
          }

          // ProjectMember に1人でも正規ユーザーが含まれていれば削除しない
          if (p.members.some((m) => isRegisteredIdentifier(m.email) || isRegisteredIdentifier(m.userId))) {
            return false
          }

          // authority JSON に1人でも正規ユーザーが含まれていれば削除しない
          const auth = (p.authority as Authority) || {}
          const authIds = [...(auth.owners || []), ...(auth.editors || []), ...(auth.viewers || [])]
          if (authIds.some((id) => typeof id === 'string' && isRegisteredIdentifier(id))) {
            return false
          }

          return true
        })
        .map((p) => p.id)

      if (projectIds.length > 0) {
        let bucket: ReturnType<typeof getStorageBucket> | null = null
        try {
          bucket = getStorageBucket()
        } catch (bucketErr) {
          functions.logger.warn('[cleanupAnonymousData] Storage bucket unavailable:', bucketErr)
        }

        // Storageのスナップショット・画像およびFirestore ACLドキュメントを削除
        for (const id of projectIds) {
          if (bucket) {
            try {
              const snapshotPrefix = `snapshots/${id}/`
              const [snapshotFiles] = await bucket.getFiles({ prefix: snapshotPrefix })
              if (snapshotFiles.length > 0) {
                await Promise.all(snapshotFiles.map((file) => file.delete()))
              }

              const imagePrefix = `images/${id}/`
              const [imageFiles] = await bucket.getFiles({ prefix: imagePrefix })
              if (imageFiles.length > 0) {
                await Promise.all(imageFiles.map((file) => file.delete()))
              }
            } catch (storageErr) {
              functions.logger.warn(`[cleanupAnonymousData] Failed to delete storage files for project ${id}:`, storageErr)
            }
          }

          await deleteProjectAclFromFirestore(id)
        }

        // データベースからプロジェクトを削除（カスケード削除で関連データも消去）
        const deletedProjects = await prisma.project.deleteMany({
          where: {
            id: { in: projectIds },
          },
        })
        functions.logger.info(`[cleanupAnonymousData] Deleted ${deletedProjects.count} anonymous projects.`)
      } else {
        functions.logger.info('[cleanupAnonymousData] No anonymous projects to delete.')
      }

      // --- 2. 匿名ユーザーの削除 ---
      // updatedAt が 24時間より古く、かつ残存プロジェクトのメンバーになっていない匿名ユーザーのみ削除
      const oldUsers = await prisma.user.findMany({
        where: {
          updatedAt: { lt: cutoff },
          members: { none: {} },
        },
        select: { id: true, email: true },
      })

      // email が null、または email に '@' が含まれておらず、id が 'system' でもないものを匿名ユーザーとみなす
      const anonymousUserIds = oldUsers
        .filter((u) => (!u.email || !u.email.includes('@')) && u.id !== 'system')
        .map((u) => u.id)

      if (anonymousUserIds.length > 0) {
        const deletedUsers = await prisma.user.deleteMany({
          where: {
            id: { in: anonymousUserIds },
          },
        })
        functions.logger.info(`[cleanupAnonymousData] Deleted ${deletedUsers.count} anonymous users.`)
      } else {
        functions.logger.info('[cleanupAnonymousData] No anonymous users to delete.')
      }
    } catch (err) {
      functions.logger.error('[cleanupAnonymousData] Failed:', err)
    }
  },
)
