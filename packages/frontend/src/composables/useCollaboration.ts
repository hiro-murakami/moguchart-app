import { ref, type Ref } from 'vue'
import { db } from '@/firebase'
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  addDoc,
  query,
  where,
  getDocs,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import type { PresenceData, EditEvent, EditEventType } from '@functions/types/shared'

/** 変更ログの最大保持数 */
const MAX_LOG_ENTRIES = 50

/** 編集イベント種別の日本語説明を生成 */
const getEventDescription = (type: EditEventType, targetName?: string): string => {
  if (targetName) {
    switch (type) {
      case 'task_upsert':
        return `タスク「${targetName}」を更新`
      case 'task_delete':
        return `タスク「${targetName}」を削除`
      case 'row_upsert':
        return `行「${targetName}」を更新`
      case 'row_delete':
        return `行「${targetName}」を削除`
      case 'row_reorder':
        return '行の並び順を変更'
      case 'full_reload':
        return 'データを更新'
      default:
        return type
    }
  }
  switch (type) {
    case 'task_upsert':
      return 'タスクを更新'
    case 'task_delete':
      return 'タスクを削除'
    case 'row_upsert':
      return '行を更新'
    case 'row_delete':
      return '行を削除'
    case 'row_reorder':
      return '行の並び順を変更'
    case 'full_reload':
      return 'データを更新'
    default:
      return type
  }
}

/** アクティビティログのエントリ */
export interface ActivityLogEntry {
  /** 一意のID */
  id: string
  /** 操作したユーザーの表示名 */
  displayName: string
  /** 操作したユーザーのメールアドレス */
  userEmail: string
  /** アバター画像URL */
  avatarUrl?: string
  /** アバター色 */
  color: string
  /** 変更内容の説明 */
  description: string
  /** イベント発生日時（ISO 8601形式） */
  timestamp: string
}

/** プレゼンスのハートビート間隔（ミリ秒） */
const HEARTBEAT_INTERVAL = 60_000

/** プレゼンスのタイムアウト（ミリ秒）- この時間以上更新がないユーザーは非アクティブ */
const PRESENCE_TIMEOUT = 120_000

/** 編集イベントを受信する時間範囲（ミリ秒）- これより古いイベントは無視 */
const EVENT_TIME_WINDOW = 5 * 60_000

/** editEventsクリーンアップの最小間隔（ミリ秒） */
const CLEANUP_MIN_INTERVAL = 60_000

/** アバター色のプリセット */
const AVATAR_COLORS = [
  '#ef5350',
  '#ab47bc',
  '#5c6bc0',
  '#42a5f5',
  '#26a69a',
  '#66bb6a',
  '#ffa726',
  '#8d6e63',
  '#ec407a',
  '#7e57c2',
]

/**
 * リアルタイムコラボレーション管理用 composable
 *
 * - プレゼンス管理（現在開いているユーザーの追跡）
 * - 編集イベントの送受信（他ユーザーの変更をリアルタイム反映）
 * - Firestore に接続できない場合は自動的に無効化（graceful degradation）
 */
export const useCollaboration = () => {
  const activeUsers: Ref<(PresenceData & { email: string })[]> = ref([])
  const editLogs: Ref<ActivityLogEntry[]> = ref([])

  let currentProjectId: string | null = null
  let currentUserEmail: string | null = null
  let currentUserDisplayName: string | null = null
  let currentUserAvatarUrl: string | null = null
  let currentEditingTaskIds: string[] = []
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null
  let presenceUnsubscribe: Unsubscribe | null = null
  let eventsUnsubscribe: Unsubscribe | null = null
  let editEventCallback: ((event: EditEvent) => void) | null = null

  /** Firestore が利用可能かどうか。接続エラー時に false に設定される */
  let firestoreAvailable = true

  /** 最後にクリーンアップを実行した時刻 */
  let lastCleanupTime = 0

  /** 最後に処理したイベントのタイムスタンプ（重複処理防止） */
  let lastProcessedTimestamp: string | null = null

  /**
   * メールアドレスからアバター色を決定的に生成
   */
  const getAvatarColor = (email: string): string => {
    let hash = 0
    for (let i = 0; i < email.length; i++) {
      hash = (hash << 5) - hash + email.charCodeAt(i)
      hash |= 0
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!
  }

  /**
   * Firestoreの利用不可を記録し、以降の操作をスキップするようにする
   */
  const disableFirestore = (context: string, err: unknown) => {
    if (firestoreAvailable) {
      console.warn(`[Collaboration] Firestore unavailable (${context}). Realtime collaboration disabled.`, err)
      firestoreAvailable = false
    }
  }

  /**
   * プレゼンスドキュメントを更新（heartbeat）
   */
  const updatePresence = async () => {
    if (!firestoreAvailable || !currentProjectId || !currentUserEmail) return

    const presenceRef = doc(db, 'projects', currentProjectId, 'presence', currentUserEmail)
    const data: PresenceData = {
      displayName: currentUserDisplayName || currentUserEmail.split('@')[0] || currentUserEmail,
      lastActiveAt: new Date().toISOString(),
      color: getAvatarColor(currentUserEmail),
      ...(currentUserAvatarUrl ? { avatarUrl: currentUserAvatarUrl } : {}),
      ...(currentEditingTaskIds.length > 0 ? { editingTaskIds: currentEditingTaskIds } : {}),
    }

    try {
      await setDoc(presenceRef, data)
    } catch (err) {
      disableFirestore('updatePresence', err)
    }
  }

  /**
   * プレゼンスのリアルタイムリスナーを開始
   */
  const startPresenceListener = () => {
    if (!firestoreAvailable || !currentProjectId) return

    const presenceCol = collection(db, 'projects', currentProjectId, 'presence')

    presenceUnsubscribe = onSnapshot(
      presenceCol,
      (snapshot) => {
        const now = Date.now()
        const users: (PresenceData & { email: string })[] = []

        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as PresenceData
          const lastActive = new Date(data.lastActiveAt).getTime()

          // タイムアウトしていないユーザーのみ表示
          if (now - lastActive < PRESENCE_TIMEOUT) {
            users.push({
              ...data,
              email: docSnap.id,
            })
          }
        })

        activeUsers.value = users
      },
      (err) => {
        disableFirestore('presenceListener', err)
        activeUsers.value = []
      },
    )
  }

  /**
   * 編集イベントからアクティビティログエントリを生成
   */
  const createLogEntry = (event: EditEvent): ActivityLogEntry => {
    // activeUsers から操作ユーザーの情報を取得
    const user = activeUsers.value.find((u) => u.email === event.userEmail)

    return {
      id: `${event.timestamp}-${event.userEmail}-${Math.random().toString(36).slice(2, 8)}`,
      displayName: user?.displayName || event.userEmail.split('@')[0] || event.userEmail,
      userEmail: event.userEmail,
      avatarUrl: user?.avatarUrl,
      color: user?.color || getAvatarColor(event.userEmail),
      description: getEventDescription(event.type, event.payload?.targetName as string | undefined),
      timestamp: event.timestamp,
    }
  }

  /**
   * 編集イベントのリアルタイムリスナーを開始
   */
  const startEditEventListener = () => {
    if (!firestoreAvailable || !currentProjectId) return

    const eventsCol = collection(db, 'projects', currentProjectId, 'editEvents')

    // コレクション全体をリッスンし、フィルタリングはクライアント側で行う
    // （where + orderBy の複合クエリはインデックスが必要なためシンプルに）
    eventsUnsubscribe = onSnapshot(
      eventsCol,
      (snapshot) => {
        const now = Date.now()
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const event = change.doc.data() as EditEvent

            // 自分自身のイベントは無視
            if (event.userEmail === currentUserEmail) return

            // 古すぎるイベントは無視（5分以上前）
            const eventTime = new Date(event.timestamp).getTime()
            if (now - eventTime > EVENT_TIME_WINDOW) return

            // 既に処理済みのイベントは無視
            if (lastProcessedTimestamp && event.timestamp <= lastProcessedTimestamp) return

            lastProcessedTimestamp = event.timestamp

            // アクティビティログに追加（先頭に新しいものを追加、最大MAX_LOG_ENTRIES件）
            const logEntry = createLogEntry(event)
            editLogs.value = [logEntry, ...editLogs.value].slice(0, MAX_LOG_ENTRIES)

            // コールバックを呼び出し
            if (editEventCallback) {
              editEventCallback(event)
            }
          }
        })
      },
      (err) => {
        console.warn('[Collaboration] editEvents listener error:', err)
      },
    )
  }

  /**
   * プロジェクトに参加（プレゼンス登録 + リスナー開始）
   */
  const joinProject = async (projectId: string, userEmail: string, displayName?: string, avatarUrl?: string) => {
    // 既に別のプロジェクトに参加中の場合は先に離脱
    if (currentProjectId) {
      await leaveProject()
    }

    currentProjectId = projectId
    currentUserEmail = userEmail
    currentUserDisplayName = displayName || null
    currentUserAvatarUrl = avatarUrl || null

    // Firestore が利用不可の場合はスキップ
    if (!firestoreAvailable) return

    // プレゼンスを登録
    const presenceRef = doc(db, 'projects', projectId, 'presence', userEmail)
    const data: PresenceData = {
      displayName: displayName || userEmail.split('@')[0] || userEmail,
      lastActiveAt: new Date().toISOString(),
      color: getAvatarColor(userEmail),
      ...(avatarUrl ? { avatarUrl } : {}),
      ...(currentEditingTaskIds.length > 0 ? { editingTaskIds: currentEditingTaskIds } : {}),
    }

    try {
      await setDoc(presenceRef, data)
    } catch (err) {
      disableFirestore('joinProject', err)
      return
    }

    // 参加時に古い editEvents をクリーンアップ
    cleanupOldEditEvents().catch(() => {})

    // リスナーを開始
    startPresenceListener()
    startEditEventListener()

    // ハートビートを開始
    heartbeatTimer = setInterval(updatePresence, HEARTBEAT_INTERVAL)

    // ページ離脱時のクリーンアップ
    window.addEventListener('beforeunload', handleBeforeUnload)
  }

  /**
   * プロジェクトから離脱（プレゼンス削除 + リスナー停止）
   */
  const leaveProject = async () => {
    // リスナーを停止
    if (presenceUnsubscribe) {
      presenceUnsubscribe()
      presenceUnsubscribe = null
    }
    if (eventsUnsubscribe) {
      eventsUnsubscribe()
      eventsUnsubscribe = null
    }

    // ハートビートを停止
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }

    // プレゼンスを削除
    if (firestoreAvailable && currentProjectId && currentUserEmail) {
      const presenceRef = doc(db, 'projects', currentProjectId, 'presence', currentUserEmail)
      try {
        await deleteDoc(presenceRef)
      } catch (err) {
        // 離脱時のエラーは警告のみ
        console.warn('[Collaboration] Failed to remove presence:', err)
      }
    }

    // イベントリスナーを解除
    window.removeEventListener('beforeunload', handleBeforeUnload)

    // 状態をリセット
    currentProjectId = null
    currentUserEmail = null
    currentUserDisplayName = null
    currentUserAvatarUrl = null
    currentEditingTaskIds = []
    lastProcessedTimestamp = null
    activeUsers.value = []
    editLogs.value = []
  }

  /**
   * 古い editEvents ドキュメントを削除するクリーンアップ処理
   * EVENT_TIME_WINDOW 以上前のイベントをバッチ削除する。
   * 呼び出し頻度は CLEANUP_MIN_INTERVAL で制限される。
   */
  const cleanupOldEditEvents = async () => {
    if (!firestoreAvailable || !currentProjectId) return

    const now = Date.now()
    // 最小間隔チェック（不要なFirestore読み取りを抑制）
    if (now - lastCleanupTime < CLEANUP_MIN_INTERVAL) return
    lastCleanupTime = now

    const eventsCol = collection(db, 'projects', currentProjectId, 'editEvents')
    const cutoff = new Date(now - EVENT_TIME_WINDOW).toISOString()

    try {
      const q = query(eventsCol, where('timestamp', '<', cutoff))
      const snapshot = await getDocs(q)

      if (snapshot.empty) return

      // Firestore の writeBatch は最大500件まで
      const batchSize = 500
      const docs = snapshot.docs

      for (let i = 0; i < docs.length; i += batchSize) {
        const batch = writeBatch(db)
        const chunk = docs.slice(i, i + batchSize)
        chunk.forEach((d) => batch.delete(d.ref))
        await batch.commit()
      }

      console.debug(`[Collaboration] Cleaned up ${docs.length} old editEvents`)
    } catch (err) {
      // クリーンアップ失敗は致命的ではないので警告のみ
      console.warn('[Collaboration] Failed to cleanup old editEvents:', err)
    }
  }

  /**
   * 編集イベントを発行
   */
  const publishEditEvent = async (type: EditEventType, payload?: Record<string, any>) => {
    if (!firestoreAvailable || !currentProjectId || !currentUserEmail) return

    const eventsCol = collection(db, 'projects', currentProjectId, 'editEvents')
    const event: EditEvent = {
      type,
      userEmail: currentUserEmail,
      timestamp: new Date().toISOString(),
      ...(payload !== undefined ? { payload } : {}),
    }

    try {
      await addDoc(eventsCol, event)
    } catch (err) {
      console.error('[Collaboration] Failed to publish edit event:', err)
    }

    // イベント発行後に古いイベントをクリーンアップ（非同期・非ブロッキング）
    cleanupOldEditEvents().catch(() => {})
  }

  /**
   * 他ユーザーの編集イベントを受信した際のコールバックを登録
   */
  /**
   * 編集中のタスクIDを更新し、プレゼンスに即座に反映
   */
  const updateEditingTasks = async (taskIds: string[]) => {
    currentEditingTaskIds = taskIds
    await updatePresence()
  }

  const onEditEvent = (callback: (event: EditEvent) => void) => {
    editEventCallback = callback
  }

  /**
   * ページ離脱時のハンドラー
   */
  const handleBeforeUnload = () => {
    if (firestoreAvailable && currentProjectId && currentUserEmail) {
      const presenceRef = doc(db, 'projects', currentProjectId, 'presence', currentUserEmail)
      deleteDoc(presenceRef).catch(() => {
        // ページ離脱中なのでエラーは無視
      })
    }
  }

  return {
    /** 現在アクティブなユーザー一覧（リアクティブ） */
    activeUsers,
    /** 他ユーザーの変更ログ（リアクティブ） */
    editLogs,
    /** プロジェクトに参加 */
    joinProject,
    /** プロジェクトから離脱 */
    leaveProject,
    /** 編集イベントを発行 */
    publishEditEvent,
    /** 編集イベント受信コールバックの登録 */
    onEditEvent,
    /** 編集中のタスクIDを更新 */
    updateEditingTasks,
  }
}
