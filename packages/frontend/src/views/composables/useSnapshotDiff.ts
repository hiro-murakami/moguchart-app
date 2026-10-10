import { ref, computed, type Ref } from 'vue'
import dayjs from 'dayjs'
import type { GanttDataJson, SnapshotInfo } from '@functions/types/shared'
import type * as moguchart from '@mogura/moguchart-core'
import { loadSnapshot } from '@/modules/scripts'
import { toLocalDate } from '@/modules/utils'
import { useSnackbar } from '@/composables/useSnackbar'
import { useAlert } from '@/composables/useAlert'

export type TaskDiffStatus =
  | 'unchanged' // 変更なし
  | 'delayed' // 遅延
  | 'ahead' // 前倒し
  | 'shifted' // 期間スライド（期間長同一だが開始終了がシフト）
  | 'progress_only' // 進捗率のみ変更
  | 'name_changed' // タスク名のみ変更
  | 'added' // 新規追加（現在のみ存在）
  | 'deleted' // 削除（スナップショットのみ存在）

export interface TaskDiffSchedule {
  start: Date
  end: Date
  progress: number
  rowId: string
  rowName: string
}

export interface TaskDiffItem {
  id: string
  name: string
  rowName: string
  status: TaskDiffStatus
  current?: TaskDiffSchedule
  snapshot?: TaskDiffSchedule
  delayDays: number // 正: 遅延, 負: 前倒し
  startDiffDays: number // 正: 後ろ倒し開始, 負: 前倒し開始
  progressDiff: number // 現在 - スナップショット
}

export interface SnapshotDiffSummary {
  snapshotName: string
  snapshotDisplayName: string
  snapshotCreatedAt?: string
  totalCurrentTasks: number
  totalSnapshotTasks: number
  delayedCount: number
  aheadCount: number
  shiftedCount: number
  progressOnlyCount: number
  nameChangedCount: number
  addedCount: number
  deletedCount: number
  unchangedCount: number
  maxDelayDays: number
  items: TaskDiffItem[]
}

export const useSnapshotDiff = (currentRows: Ref<moguchart.GanttRow[]>) => {
  const snackbar = useSnackbar()
  const alert = useAlert()

  const comparingSnapshotData = ref<GanttDataJson | null>(null)
  const comparingSnapshotInfo = ref<{ name: string; displayName: string; createdAt?: string } | null>(null)
  const isSnapshotDiffLoading = ref(false)
  const isDiffSummaryDialogVisible = ref(false)
  const baselinePosition = ref<'bottom' | 'top' | 'overlay'>('bottom')
  const diffHighlightOnly = ref(true)

  const isDiffActive = computed(() => !!comparingSnapshotData.value)

  /**
   * スナップショット内の全タスクをIDキーでインデックス化
   */
  const snapshotTaskMap = computed(() => {
    const map = new Map<
      string,
      {
        id: string
        name: string
        start: Date
        end: Date
        progress: number
        rowId: string
        rowName: string
        raw: any
      }
    >()

    if (!comparingSnapshotData.value?.rows) return map

    for (const row of comparingSnapshotData.value.rows) {
      const rowId = String(row.id)
      const rowName = row.name || ''
      for (const task of row.tasks || []) {
        const taskId = String(task.id)
        const start = toLocalDate(task.start)
        const end = toLocalDate(task.end)
        const progress =
          typeof (task as any).attribute?.progress === 'number'
            ? (task as any).attribute.progress
            : typeof (task as any).progress === 'number'
              ? (task as any).progress
              : 0

        map.set(taskId, {
          id: taskId,
          name: task.name || '',
          start,
          end,
          progress,
          rowId,
          rowName,
          raw: task,
        })
      }
    }

    return map
  })

  /**
   * 現在のプロジェクト内の全タスクをIDキーでインデックス化
   */
  const currentTaskMap = computed(() => {
    const map = new Map<
      string,
      {
        id: string
        name: string
        start: Date
        end: Date
        progress: number
        rowId: string
        rowName: string
        raw: moguchart.GanttTask
      }
    >()

    for (const row of currentRows.value) {
      const rowId = String(row.id)
      const rowName = row.name || ''
      for (const task of row.tasks || []) {
        const taskId = String(task.id)
        const start = task.start instanceof Date ? task.start : new Date(task.start)
        const end = task.end instanceof Date ? task.end : new Date(task.end)
        const progress =
          typeof (task as any).attribute?.progress === 'number'
            ? (task as any).attribute.progress
            : typeof task.progress === 'number'
              ? task.progress
              : 0

        map.set(taskId, {
          id: taskId,
          name: task.name || '',
          start,
          end,
          progress,
          rowId,
          rowName,
          raw: task,
        })
      }
    }

    return map
  })

  /**
   * 差分詳細サマリーの計算
   */
  const diffSummary = computed<SnapshotDiffSummary | null>(() => {
    if (!isDiffActive.value || !comparingSnapshotInfo.value) return null

    const currentMap = currentTaskMap.value
    const snapMap = snapshotTaskMap.value
    const oneDayMs = 1000 * 60 * 60 * 24

    const items: TaskDiffItem[] = []
    let delayedCount = 0
    let aheadCount = 0
    let shiftedCount = 0
    let progressOnlyCount = 0
    let nameChangedCount = 0
    let unchangedCount = 0
    let addedCount = 0
    let deletedCount = 0
    let maxDelayDays = 0

    // 1. 現在存在するタスクの突合（一致、変更、遅延、前倒し、追加）
    for (const [taskId, curr] of currentMap.entries()) {
      const snap = snapMap.get(taskId)

      if (!snap) {
        // 新規追加
        addedCount++
        items.push({
          id: taskId,
          name: curr.name,
          rowName: curr.rowName,
          status: 'added',
          current: {
            start: curr.start,
            end: curr.end,
            progress: curr.progress,
            rowId: curr.rowId,
            rowName: curr.rowName,
          },
          delayDays: 0,
          startDiffDays: 0,
          progressDiff: curr.progress,
        })
        continue
      }

      // スナップショットと照合
      const endDiffMs = curr.end.getTime() - snap.end.getTime()
      const startDiffMs = curr.start.getTime() - snap.start.getTime()
      const delayDays = Math.round((endDiffMs / oneDayMs) * 10) / 10
      const startDiffDays = Math.round((startDiffMs / oneDayMs) * 10) / 10
      const progressDiff = curr.progress - snap.progress
      const isNameSame = curr.name === snap.name

      let status: TaskDiffStatus = 'unchanged'

      if (delayDays > 0) {
        status = 'delayed'
        delayedCount++
        if (delayDays > maxDelayDays) {
          maxDelayDays = delayDays
        }
      } else if (delayDays < 0) {
        status = 'ahead'
        aheadCount++
      } else if (startDiffDays !== 0) {
        status = 'shifted'
        shiftedCount++
      } else if (progressDiff !== 0) {
        status = 'progress_only'
        progressOnlyCount++
      } else if (!isNameSame) {
        status = 'name_changed'
        nameChangedCount++
      } else {
        status = 'unchanged'
        unchangedCount++
      }

      items.push({
        id: taskId,
        name: curr.name,
        rowName: curr.rowName,
        status,
        current: {
          start: curr.start,
          end: curr.end,
          progress: curr.progress,
          rowId: curr.rowId,
          rowName: curr.rowName,
        },
        snapshot: {
          start: snap.start,
          end: snap.end,
          progress: snap.progress,
          rowId: snap.rowId,
          rowName: snap.rowName,
        },
        delayDays,
        startDiffDays,
        progressDiff,
      })
    }

    // 2. スナップショットにのみ存在するタスク（削除）
    for (const [taskId, snap] of snapMap.entries()) {
      if (!currentMap.has(taskId)) {
        deletedCount++
        items.push({
          id: taskId,
          name: snap.name,
          rowName: snap.rowName,
          status: 'deleted',
          snapshot: {
            start: snap.start,
            end: snap.end,
            progress: snap.progress,
            rowId: snap.rowId,
            rowName: snap.rowName,
          },
          delayDays: 0,
          startDiffDays: 0,
          progressDiff: -snap.progress,
        })
      }
    }

    // 遅延の大きい順、追加・削除、状態順でソート
    const statusOrder: Record<TaskDiffStatus, number> = {
      delayed: 0,
      ahead: 1,
      shifted: 2,
      progress_only: 3,
      name_changed: 4,
      added: 5,
      deleted: 6,
      unchanged: 7,
    }

    items.sort((a, b) => {
      const orderA = statusOrder[a.status]
      const orderB = statusOrder[b.status]
      if (orderA !== orderB) return orderA - orderB
      if (a.status === 'delayed' && b.status === 'delayed') {
        return b.delayDays - a.delayDays
      }
      return a.name.localeCompare(b.name)
    })

    return {
      snapshotName: comparingSnapshotInfo.value.name,
      snapshotDisplayName: comparingSnapshotInfo.value.displayName,
      snapshotCreatedAt: comparingSnapshotInfo.value.createdAt,
      totalCurrentTasks: currentMap.size,
      totalSnapshotTasks: snapMap.size,
      delayedCount,
      aheadCount,
      shiftedCount,
      progressOnlyCount,
      nameChangedCount,
      addedCount,
      deletedCount,
      unchangedCount,
      maxDelayDays,
      items,
    }
  })

  /**
   * 差分が存在するタスクIDのSet（delayed, ahead, shifted, progress_only, name_changed, added）
   */
  const diffTaskIds = computed<Set<string>>(() => {
    const set = new Set<string>()
    if (!diffSummary.value) return set
    for (const item of diffSummary.value.items) {
      if (item.status !== 'unchanged' && item.status !== 'deleted') {
        set.add(String(item.id))
      }
    }
    return set
  })

  /**
   * 現在の各行タスクにスナップショットのベースライン（計画日程）をマッピングして返す
   */
  const applyBaselineToRows = (rows: moguchart.GanttRow[]): moguchart.GanttRow[] => {
    if (!isDiffActive.value || snapshotTaskMap.value.size === 0) {
      return rows
    }

    const snapMap = snapshotTaskMap.value

    return rows.map((row) => ({
      ...row,
      tasks: (row.tasks || []).map((task) => {
        const snap = snapMap.get(String(task.id))
        if (!snap) {
          return task
        }

        const isFilteredOut = (task as any)._isFilteredOut === true

        return {
          ...task,
          baseline: {
            start: snap.start,
            end: snap.end,
            progress: snap.progress,
            name: snap.name,
            style: isFilteredOut ? 'opacity: 0.2;' : undefined,
          },
        }
      }),
    }))
  }

  /**
   * スナップショットとの差分比較を開始
   */
  const startSnapshotDiff = async (
    projectId: string,
    snapshotItem: SnapshotInfo & { displayName?: string },
  ): Promise<boolean> => {
    if (!projectId || !snapshotItem.name) return false

    isSnapshotDiffLoading.value = true
    try {
      const data = await loadSnapshot({ projectId, snapshotName: snapshotItem.name })
      comparingSnapshotData.value = data
      comparingSnapshotInfo.value = {
        name: snapshotItem.name,
        displayName: snapshotItem.displayName || snapshotItem.name,
        createdAt: snapshotItem.createdAt,
      }
      snackbar({
        message: `スナップショット「${snapshotItem.displayName || snapshotItem.name}」との差分比較を表示しました`,
        color: 'info',
      })
      return true
    } catch (err) {
      console.error('[useSnapshotDiff] Failed to load snapshot for diff:', err)
      await alert({
        title: 'エラー',
        message: 'スナップショットの差分データの読み込みに失敗しました。',
      })
      return false
    } finally {
      isSnapshotDiffLoading.value = false
    }
  }

  /**
   * 差分比較を解除
   */
  const stopSnapshotDiff = () => {
    comparingSnapshotData.value = null
    comparingSnapshotInfo.value = null
    isDiffSummaryDialogVisible.value = false
  }

  /**
   * スナップショット表示名を更新
   */
  const updateSnapshotDisplayName = (name: string, displayName: string) => {
    if (comparingSnapshotInfo.value && comparingSnapshotInfo.value.name === name) {
      comparingSnapshotInfo.value.displayName = displayName
    }
  }

  return {
    comparingSnapshotData,
    comparingSnapshotInfo,
    isSnapshotDiffLoading,
    isDiffSummaryDialogVisible,
    baselinePosition,
    diffHighlightOnly,
    isDiffActive,
    diffSummary,
    diffTaskIds,
    applyBaselineToRows,
    startSnapshotDiff,
    stopSnapshotDiff,
    updateSnapshotDisplayName,
  }
}
