import { onSchedule } from 'firebase-functions/v2/scheduler'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import * as functions from 'firebase-functions/v2'

// Firebase Admin SDK の初期化（まだ初期化されていない場合のみ）
if (getApps().length === 0) {
  initializeApp()
}

/** クリーンアップ対象とする経過時間（ミリ秒）- 24時間以上前のドキュメントを削除 */
const CLEANUP_AGE_MS = 24 * 60 * 60_000

/** Firestore writeBatch の最大操作数 */
const BATCH_LIMIT = 500

/**
 * 定期実行: 古いレートリミットドキュメントを一括削除
 *
 * - 6時間ごとに実行
 * - 24時間以上更新されていないドキュメントを削除対象とする
 * - Firestore の writeBatch を使い、500件ずつバッチ削除
 */
export const cleanupRateLimits = onSchedule(
  {
    schedule: 'every 360 minutes',
    region: 'asia-northeast1',
    timeZone: 'Asia/Tokyo',
  },
  async () => {
    const db = getFirestore()
    const cutoff = Timestamp.fromMillis(Date.now() - CLEANUP_AGE_MS)

    let totalDeleted = 0

    try {
      const oldDocs = await db
        .collection('rateLimits')
        .where('updatedAt', '<', cutoff)
        .get()

      if (!oldDocs.empty) {
        const docs = oldDocs.docs

        // バッチ削除（500件ずつ）
        for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
          const batch = db.batch()
          const chunk = docs.slice(i, i + BATCH_LIMIT)
          chunk.forEach((doc) => batch.delete(doc.ref))
          await batch.commit()
        }

        totalDeleted = docs.length
      }

      functions.logger.info(
        `[cleanupRateLimits] Deleted ${totalDeleted} old rate limit documents`,
      )
    } catch (err) {
      functions.logger.error('[cleanupRateLimits] Failed:', err)
    }
  },
)
