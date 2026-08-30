import { onSchedule } from 'firebase-functions/v2/scheduler'
import * as functions from 'firebase-functions/v2'
import { getStorageBucket, prisma } from './common/commonFunctions.js'

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
        const bucket = getStorageBucket()

        // Storageのスナップショットと画像を削除
        for (const id of projectIds) {
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
