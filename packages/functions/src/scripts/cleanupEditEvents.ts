import { onSchedule } from 'firebase-functions/v2/scheduler'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import * as functions from 'firebase-functions/v2'

// Firebase Admin SDK の初期化（まだ初期化されていない場合のみ）
if (getApps().length === 0) {
  initializeApp()
}

/** クリーンアップ対象とする経過時間（ミリ秒）- 10分以上前のイベントを削除 */
const CLEANUP_AGE_MS = 10 * 60_000

/** Firestore writeBatch の最大操作数 */
const BATCH_LIMIT = 500

/**
 * 定期実行: 古い editEvents を全プロジェクトから一括削除
 *
 * - 1時間ごとに実行
 * - 10分以上前のイベントを削除対象とする
 * - Firestoreの writeBatch を使い、500件ずつバッチ削除
 */
export const cleanupEditEvents = onSchedule(
  {
    schedule: 'every 60 minutes',
    region: 'asia-northeast1',
    timeZone: 'Asia/Tokyo',
  },
  async () => {
    const db = getFirestore()
    const cutoff = new Date(Date.now() - CLEANUP_AGE_MS).toISOString()

    let totalDeleted = 0

    try {
      // 全プロジェクトを取得
      const projectsSnapshot = await db.collection('projects').listDocuments()

      for (const projectRef of projectsSnapshot) {
        const eventsRef = projectRef.collection('editEvents')
        const oldEvents = await eventsRef.where('timestamp', '<', cutoff).get()

        if (oldEvents.empty) continue

        const docs = oldEvents.docs

        // バッチ削除（500件ずつ）
        for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
          const batch = db.batch()
          const chunk = docs.slice(i, i + BATCH_LIMIT)
          chunk.forEach((doc) => batch.delete(doc.ref))
          await batch.commit()
        }

        totalDeleted += docs.length
      }

      functions.logger.info(`[cleanupEditEvents] Deleted ${totalDeleted} old editEvents`)
    } catch (err) {
      functions.logger.error('[cleanupEditEvents] Failed:', err)
    }
  },
)
