import { onSchedule } from 'firebase-functions/v2/scheduler'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getStorage } from 'firebase-admin/storage'
import * as functions from 'firebase-functions/v2'
import { prisma } from './common/commonFunctions.js'

// Firebase Admin SDK の初期化（まだ初期化されていない場合のみ）
if (getApps().length === 0) {
  initializeApp()
}

/** クリーンアップ対象とする経過時間（ミリ秒）- 24時間 */
const CLEANUP_AGE_MS = 24 * 60 * 60 * 1000

/**
 * 定期実行: 匿名ログインで生成された古い Project と User データを一括削除
 *
 * - 1時間ごとに実行
 * - 最終更新日時（updatedAt）から24時間経過した匿名データを削除対象とする
 * - 匿名ユーザーは email（または createdBy）に UID が格納されており、'@' が含まれていないことで判定する
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
      // updatedAt が 24時間より古いプロジェクトを取得
      const oldProjects = await prisma.project.findMany({
        where: {
          updatedAt: { lt: cutoff },
        },
        select: { id: true, createdBy: true },
      })

      // createdBy が存在し、'@' が含まれておらず、'system' でもないものを匿名作成とみなす
      const projectIds = oldProjects
        .filter((p) => p.createdBy && !p.createdBy.includes('@') && p.createdBy !== 'system')
        .map((p) => p.id)

      if (projectIds.length > 0) {
        const bucket = getStorage().bucket()

        // Storageのスナップショットを削除
        for (const id of projectIds) {
          try {
            const prefix = `snapshots/${id}/`
            const [files] = await bucket.getFiles({ prefix })
            if (files.length > 0) {
              await Promise.all(files.map((file) => file.delete()))
            }
          } catch (storageErr) {
            functions.logger.warn(`[cleanupAnonymousData] Failed to delete snapshots for project ${id}:`, storageErr)
          }
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
      // updatedAt が 24時間より古いユーザーを取得
      const oldUsers = await prisma.user.findMany({
        where: {
          updatedAt: { lt: cutoff },
        },
        select: { email: true },
      })

      // email に '@' が含まれておらず、'system' でもないものを匿名ユーザーとみなす
      const userEmails = oldUsers
        .filter((u) => u.email && !u.email.includes('@') && u.email !== 'system')
        .map((u) => u.email)

      if (userEmails.length > 0) {
        const deletedUsers = await prisma.user.deleteMany({
          where: {
            email: { in: userEmails },
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
