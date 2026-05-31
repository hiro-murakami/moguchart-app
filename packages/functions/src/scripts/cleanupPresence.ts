import { onSchedule } from 'firebase-functions/v2/scheduler'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import * as functions from 'firebase-functions/v2'

// Firebase Admin SDK の初期化（まだ初期化されていない場合のみ）
if (getApps().length === 0) {
  initializeApp()
}

/** クリーンアップ対象とする経過時間（ミリ秒）- 5分以上前のプレゼンスを削除 */
const CLEANUP_AGE_MS = 5 * 60_000

/** Firestore writeBatch の最大操作数 */
const BATCH_LIMIT = 500

/**
 * 定期実行: 古い presence ドキュメントを全プロジェクトから一括削除
 *
 * - 1時間ごとに実行
 * - lastActiveAt が5分以上前のドキュメントを削除対象とする
 *   （クライアント側の PRESENCE_TIMEOUT = 2分 を十分に超えた値）
 * - ブラウザクラッシュやネットワーク断で正常に leaveProject が
 *   呼ばれなかった場合の残留データを確実に削除する
 * - Firestoreの writeBatch を使い、500件ずつバッチ削除
 */
export const cleanupPresence = onSchedule(
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
      // collectionGroup で全プロジェクト配下の presence を直接クエリ
      // ※ 親の projects ドキュメントが存在しない場合でも確実に取得できる
      const stalePresence = await db
        .collectionGroup('presence')
        .where('lastActiveAt', '<', cutoff)
        .get()

      if (!stalePresence.empty) {
        const docs = stalePresence.docs

        // バッチ削除（500件ずつ）
        for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
          const batch = db.batch()
          const chunk = docs.slice(i, i + BATCH_LIMIT)
          chunk.forEach((doc) => batch.delete(doc.ref))
          await batch.commit()
        }

        totalDeleted = docs.length
      }

      functions.logger.info(`[cleanupPresence] Deleted ${totalDeleted} stale presence documents`)
    } catch (err) {
      functions.logger.error('[cleanupPresence] Failed:', err)
    }
  },
)
