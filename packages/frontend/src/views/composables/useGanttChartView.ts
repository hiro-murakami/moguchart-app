import dayjs from 'dayjs'
import { DEFAULT_TASK_COLOR, UNLABELED_VALUE, ZOOM_DAILY, ZOOM_MONTHLY, ZOOM_HOURLY } from '@/modules/constants'
import {
  deleteGanttRow,
  deleteGanttTask,
  selectGanttChart,
  selectGanttRows,
  updateGanttRowOrder,
  upsertGanttRow,
  upsertGanttTasks,
  createSnapshot,
  loadSnapshot,
  selectComments,
  downloadProjectZip,
} from '@/modules/scripts'
import { db } from '@/firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { useAlert } from '@/composables/useAlert'
import { useUndoRedo } from '@/composables/useUndoRedo'
import { useCollaboration } from '@/composables/useCollaboration'
import type { ActivityLogEntry } from '@/composables/useCollaboration'
import { useConfirm } from '@/composables/useConfirm'
import { usePrompt } from '@/composables/usePrompt'
import { useLoading } from '@/composables/useLoading'
import { useExportData } from '@/composables/useExportData'
import { toDateString, toDateTimeString, toLocalDate, getContrastColor } from '@/modules/utils'
import {
  barContent,
  tooltip,
  rowHeaderContent,
  rowHeaderTooltip,
  preloadCommentsCache,
  preloadRowCommentsCache,
  createCornerContent,
} from '@/modules/ganttChartCustomRendering'
import { useProjectStore } from '@/stores/useProjectStore'
import { useUserStore } from '@/stores/useUserStore'
import type {
  ColorPalette,
  GanttRow,
  GanttTask,
  TaskAttribute,
  RowAttribute,
  MarkerAttribute,
  Project,
  EditingRowData,
  EditingTaskData,
  GanttDataJson,
  Label,
  Comment,
} from '@functions/types/shared'
import * as holiday_jp from '@holiday-jp/holiday_jp'
import * as moguchart from '@mogura/moguchart-core'
import { debounce } from 'lodash'
import { storeToRefs } from 'pinia'
import { computed, inject, nextTick, ref, watch, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchPublicGanttChart } from '@/modules/publicApi'
import { preloadImages } from '@/modules/imageCache'
import { deleteImagesFromStorage } from '@/modules/storageUtils'

const getBorderStyle = (type?: string, color?: string) => {
  if (!type || type === 'none') return ''
  const isThick = type.endsWith('_thick')
  const width = isThick ? '2px' : '1px'
  const style = type.startsWith('dashed') ? 'dashed' : type.startsWith('dotted') ? 'dotted' : 'solid'
  return `border: ${width} ${style} ${color || '#000000'} !important; box-sizing: border-box; `
}

export const useGanttChartView = () => {
  const route = useRoute()
  const router = useRouter()
  const userStore = useUserStore()
  /** App.vue から inject: 未ログインで公開プロジェクトを閲覧中かどうか */
  const isPublicViewMode = inject<Ref<boolean>>('isPublicViewMode', ref(false))
  /** App.vue から inject: 公開閲覧モード用テーマオーバーライド */
  const publicThemeOverride = inject<Ref<'light' | 'dark' | 'system' | null>>('publicThemeOverride', ref(null))

  // --- 設定値 ---
  const selectedFilterLabelNames = ref<string[]>([])
  const selectedRowFilterLabelNames = ref<string[]>([]) // 行フィルター（コーナーセル用）
  const searchText = ref('')
  const searchIncludeRows = ref(false)
  const chartStartStr = ref('2025-12-15')
  const chartEndStr = ref('2026-03-31')
  const pxPerDay = ref(28)
  const pxPerMonth = ref(40)
  const pxPerHour = ref(140)
  const rowHeaderWidth = ref(200)
  const barHeight = ref(38)
  const barMargin = ref(4)
  const barCornerRadius = ref(4)
  const labelWidth = ref(150)
  const showHiddenRows = ref(false)
  const showCurrentTimeLine = ref(true)
  const barShadowLevel = ref<'none' | 'small' | 'medium' | 'large'>('medium')
  const readonlyMode = ref(false)
  const showCriticalPath = ref(false)
  const showMinimap = ref(true)
  const minimapWidth = ref(200)
  const manualAddRowCount = ref(1)

  const isUnassignedTasksOpen = ref(false)
  const isSnapshotListDialogVisible = ref(false)

  // --- 自動スナップショット（変更履歴）---
  /** 最後に自動スナップショットを保存した時刻のメモリキャッシュ */
  let autoSnapshotLastAtCache: string | null = null
  /** キャッシュが初期化済みかどうか */
  let autoSnapshotCacheInitialized = false

  /**
   * インターバル経過後の変更であれば、変更前のスナップショットを自動保存する。
   * fire-and-forget で呼び出し、UIをブロックしない。
   */
  const maybeAutoSnapshot = async () => {
    try {
      const intervalMinutes = currentProject.value?.attribute?.historyIntervalMinutes
      if (!intervalMinutes || intervalMinutes <= 0) return
      if (!projectId.value || isSnapshotMode.value) return

      const projectDocRef = doc(db, 'projects', projectId.value)

      // 初回のみ Firestore からキャッシュを読み込む
      if (!autoSnapshotCacheInitialized) {
        try {
          const snap = await getDoc(projectDocRef)
          autoSnapshotLastAtCache = snap.data()?.autoSnapshotLastAt || null
        } catch {
          // Firestore 読み込み失敗時はキャッシュなしで続行
        }
        autoSnapshotCacheInitialized = true
      }

      const now = Date.now()
      const intervalMs = intervalMinutes * 60 * 1000

      if (autoSnapshotLastAtCache) {
        const lastAt = new Date(autoSnapshotLastAtCache).getTime()
        if (now - lastAt < intervalMs) return
      }

      // 先に Firestore のタイムスタンプを更新（他ユーザーとの重複防止）
      const nowIso = new Date().toISOString()
      autoSnapshotLastAtCache = nowIso
      try {
        await setDoc(projectDocRef, { autoSnapshotLastAt: nowIso }, { merge: true })
      } catch {
        // Firestore 書き込み失敗でもスナップショット作成は試みる
      }

      // スナップショットを作成（変更前のDB状態を確保するためawaitする）
      try {
        await createSnapshot({ projectId: projectId.value, displayName: '自動履歴' })
      } catch (err) {
        console.warn('[AutoSnapshot] Failed to create auto snapshot:', err)
      }
    } catch (err) {
      console.warn('[AutoSnapshot] Error in maybeAutoSnapshot:', err)
    }
  }

  // --- 状態 ---
  const projectStore = useProjectStore()
  const {
    projects,
    currentProjectId: storeProjectId,
    currentRole: storeRole,
    currentProject: storeProject,
  } = storeToRefs(projectStore)
  const { fetchProjects, setProjectId, clear: clearProjectStore } = projectStore

  const isSnapshotMode = computed(() => !!route.params.snapshotName)
  const snapshotProject = ref<Project | null>(null)

  const projectId = computed(() =>
    isSnapshotMode.value
      ? ((Array.isArray(route.params.projectId) ? route.params.projectId[0] : route.params.projectId) as string)
      : storeProjectId.value,
  )
  const currentProject = computed(() => (isSnapshotMode.value ? snapshotProject.value : storeProject.value))
  const currentRole = computed(() => (isSnapshotMode.value ? 'viewer' : storeRole.value))


  // プロジェクトの変更に応じてブラウザのタブタイトルと期間を更新
  watch(
    currentProject,
    (project) => {
      document.title = project?.name ? `MoguChart - ${project.name}` : 'MoguChart'
      if (project && !isSnapshotMode.value) {
        chartStartStr.value = project.start
        chartEndStr.value = project.end
      }
    },
    { immediate: true },
  )

  // プロジェクト設定を保存する共通関数（debounce付き）
  // --- コメントサイドバー設定 ---
  const commentSidebarOpen = ref(false)
  // commentSidebarWidth は「開いたときの幅」を保持する（閉じても50に上書きしない）
  const commentSidebarWidth = ref(320)
  const CLOSED_SIDEBAR_WIDTH = 50
  const effectiveCommentSidebarWidth = computed(() =>
    commentSidebarOpen.value ? commentSidebarWidth.value : CLOSED_SIDEBAR_WIDTH,
  )

  const saveProjectSettings = debounce(
    async (settings: {
      pxPerDay?: number
      pxPerMonth?: number
      pxPerHour?: number
      selectedLabels?: string[]
      showHiddenRows?: boolean
      showCurrentTimeLine?: boolean
      barShadowLevel?: 'none' | 'small' | 'medium' | 'large'
      rowHeaderWidth?: number
      barHeight?: number
      commentSidebarOpen?: boolean
      commentSidebarWidth?: number
      readonlyMode?: boolean
      showCriticalPath?: boolean
      showMinimap?: boolean
      minimapWidth?: number
    }) => {
      // 公開閲覧モードではユーザー設定を保存しない
      if (isPublicViewMode.value) return
      if (userStore.user && projectId.value) {
        const currentSettings = userStore.user.attribute.projectSettings?.[projectId.value] || {}
        const newSettings = { ...currentSettings, ...settings }

        const projectSettings = { ...userStore.user.attribute.projectSettings }
        projectSettings[projectId.value] = newSettings

        userStore.user.attribute = {
          ...userStore.user.attribute,
          projectSettings,
        }
        await userStore.saveUser(userStore.user)
      }
    },
    500,
  )

  // pxPerDay変更時に保存
  watch(pxPerDay, (newValue) => {
    saveProjectSettings({ pxPerDay: newValue })
  })

  // pxPerMonth変更時に保存
  watch(pxPerMonth, (newValue) => {
    saveProjectSettings({ pxPerMonth: newValue })
  })

  // pxPerHour変更時に保存
  watch(pxPerHour, (newValue) => {
    saveProjectSettings({ pxPerHour: newValue })
  })

  // 行ヘッダー幅変更時に保存
  watch(rowHeaderWidth, (newValue) => {
    saveProjectSettings({ rowHeaderWidth: newValue })
  })

  // 選択ラベル変更時に保存
  watch(
    selectedFilterLabelNames,
    (newLabels) => {
      saveProjectSettings({ selectedLabels: newLabels })
    },
    { deep: true },
  )

  // 非表示行の表示設定変更時に保存
  watch(showHiddenRows, (newValue) => {
    saveProjectSettings({ showHiddenRows: newValue })
  })

  // 現在時刻線の表示設定変更時に保存
  watch(showCurrentTimeLine, (newValue) => {
    saveProjectSettings({ showCurrentTimeLine: newValue })
  })

  // バーの影段階設定変更時に保存
  watch(barShadowLevel, (newValue) => {
    saveProjectSettings({ barShadowLevel: newValue })
  })

  // 読み取り専用モード変更時に保存
  watch(readonlyMode, (newValue) => {
    saveProjectSettings({ readonlyMode: newValue })
  })

  // クリティカルパス表示設定変更時に保存
  watch(showCriticalPath, (newValue) => {
    saveProjectSettings({ showCriticalPath: newValue })
  })

  // ミニマップ表示設定変更時に保存
  watch(showMinimap, (newValue) => {
    saveProjectSettings({ showMinimap: newValue })
  })

  // ミニマップ幅変更時に保存
  watch(minimapWidth, (newValue) => {
    saveProjectSettings({ minimapWidth: newValue })
  })

  // バー高さ変更時に保存
  watch(barHeight, (newValue) => {
    saveProjectSettings({ barHeight: newValue })
  })

  // コメントサイドバー開閉状態・幅変更時に保存
  // 注意: commentSidebarOpen と commentSidebarWidth は同期的に変更されることがあるため、
  // 個別の watch で saveProjectSettings を呼ぶと debounce により片方が失われる。
  // 両方をまとめて監視し、一括で保存する。
  watch([commentSidebarOpen, commentSidebarWidth], ([newOpen, newWidth]) => {
    saveProjectSettings({ commentSidebarOpen: newOpen, commentSidebarWidth: newWidth })
  })

  // プロジェクトまたはユーザーが変わったら設定を復元
  watch(
    [() => userStore.user, projectId],
    ([newUser, newProjectId]) => {
      if (newUser && newProjectId) {
        const settings = newUser.attribute?.projectSettings?.[newProjectId]

        // pxPerDayの復元
        if (settings?.pxPerDay) {
          pxPerDay.value = settings.pxPerDay
        } else {
          pxPerDay.value = 28
        }

        // pxPerMonthの復元
        if (settings?.pxPerMonth) {
          pxPerMonth.value = settings.pxPerMonth
        } else {
          pxPerMonth.value = 40
        }

        // pxPerHourの復元
        if (settings?.pxPerHour) {
          pxPerHour.value = settings.pxPerHour
        } else {
          pxPerHour.value = 140
        }

        // rowHeaderWidthの復元
        if (settings?.rowHeaderWidth) {
          rowHeaderWidth.value = settings.rowHeaderWidth
        } else {
          rowHeaderWidth.value = 200
        }

        // selectedFilterLabelNamesの復元
        if (settings?.selectedLabels) {
          selectedFilterLabelNames.value = settings.selectedLabels
        } else {
          selectedFilterLabelNames.value = []
        }

        // showHiddenRowsの復元
        if (settings?.showHiddenRows !== undefined) {
          showHiddenRows.value = settings.showHiddenRows
        } else {
          showHiddenRows.value = false
        }

        // showCurrentTimeLineの復元
        if (settings?.showCurrentTimeLine !== undefined) {
          showCurrentTimeLine.value = settings.showCurrentTimeLine
        } else {
          showCurrentTimeLine.value = true
        }

        // barShadowLevelの復元
        if (settings?.barShadowLevel !== undefined) {
          barShadowLevel.value = settings.barShadowLevel
        } else if (settings?.showBarShadow !== undefined) {
          // 旧設定(boolean)からの移行: falseはnone、trueはmedium
          barShadowLevel.value = settings.showBarShadow ? 'medium' : 'none'
        } else {
          barShadowLevel.value = 'medium'
        }

        // readonlyModeの復元
        if (settings?.readonlyMode !== undefined) {
          readonlyMode.value = settings.readonlyMode
        } else {
          readonlyMode.value = false
        }

        // barHeightの復元
        if (settings?.barHeight) {
          barHeight.value = settings.barHeight
        } else {
          barHeight.value = 38
        }

        // showCriticalPathの復元
        if (settings?.showCriticalPath !== undefined) {
          showCriticalPath.value = settings.showCriticalPath
        } else {
          showCriticalPath.value = false
        }

        // showMinimapの復元
        if (settings?.showMinimap !== undefined) {
          showMinimap.value = settings.showMinimap
        } else {
          showMinimap.value = true
        }

        // minimapWidthの復元
        if (settings?.minimapWidth && settings.minimapWidth >= 100) {
          minimapWidth.value = settings.minimapWidth
        } else {
          minimapWidth.value = 200
        }

        // commentSidebarOpenの復元
        if (settings?.commentSidebarOpen !== undefined) {
          commentSidebarOpen.value = settings.commentSidebarOpen
        } else {
          commentSidebarOpen.value = false
        }

        // commentSidebarWidthの復元（開いたときの幅として保持）
        if (settings?.commentSidebarWidth && settings.commentSidebarWidth >= 220) {
          commentSidebarWidth.value = settings.commentSidebarWidth
        } else {
          commentSidebarWidth.value = 320
        }
      }
    },
    { immediate: true },
  )

  const rows = ref<moguchart.GanttRow[]>([])
  const selectedRowIds = ref<string[]>([])
  const selectedTaskIds = ref<string[]>([])

  const availableLabels = computed(() => {
    const labelMap = new Map<string, string>() // name -> color
    rows.value.forEach((row) => {
      if (row.tasks) {
        row.tasks.forEach((task) => {
          const attribute = (task as any).attribute as TaskAttribute | undefined
          const labels = attribute?.labels
          if (labels && Array.isArray(labels)) {
            labels.forEach((l: any) => {
              if (l && l.name) {
                labelMap.set(l.name, l.color || '#9e9e9e')
              }
            })
          }
        })
      }
    })
    return Array.from(labelMap.entries()).map(([name, color]) => ({ name, color }))
  })


  const availableRowLabels = computed(() => {
    const labelMap = new Map<string, string>() // name -> color
    rows.value.forEach((row) => {
      const rowAttr = (row as any).attribute as RowAttribute | undefined
      const labels = rowAttr?.labels
      if (labels && Array.isArray(labels)) {
        labels.forEach((l: any) => {
          if (l && l.name) {
            labelMap.set(l.name, l.color || '#9e9e9e')
          }
        })
      }
    })
    return Array.from(labelMap.entries()).map(([name, color]) => ({ name, color }))
  })


  /**
   * 他ユーザー編集中のタスクにハイライトスタイルを付与するヘルパー
   */
  const applyRemoteEditingHighlight = (
    task: moguchart.GanttTask,
    editingMap: Map<string, { color: string; displayName: string }>,
  ): moguchart.GanttTask => {
    const editing = editingMap.get(String(task.id))
    if (!editing) return task

    const newTask = { ...task }
    const styleStr = (newTask as any).style || ''
    const separator = styleStr && !styleStr.trim().endsWith(';') ? ';' : ''
    const highlightStyle = `${styleStr}${separator} outline: 2.5px solid ${editing.color}; outline-offset: 2px; box-shadow: 0 0 8px 2px ${editing.color}66; animation: collab-pulse 2s ease-in-out infinite;`
    Object.assign(newTask, { style: highlightStyle })
    return newTask
  }

  const filteredRows = computed(() => {
    const hasLabelFilter = selectedFilterLabelNames.value.length > 0
    const hasRowLabelFilter = selectedRowFilterLabelNames.value.length > 0
    const trimmed = (searchText.value || '').trim()
    const hasKeywordFilter = trimmed !== ''
    const editingMap = remoteEditingTaskMap.value
    const hasRemoteEditing = editingMap.size > 0

    if (!hasLabelFilter && !hasRowLabelFilter && !hasKeywordFilter && !hasRemoteEditing) {
      return rows.value
    }

    // フィルタ不要だが他ユーザー編集中のタスクだけハイライトする場合
    if (!hasLabelFilter && !hasRowLabelFilter && !hasKeywordFilter && hasRemoteEditing) {
      return rows.value.map((row) => ({
        ...row,
        tasks: row.tasks.map((task) => applyRemoteEditingHighlight(task, editingMap)),
      }))
    }

    const keywords = hasKeywordFilter ? trimmed.split(/\s+/).filter(Boolean) : []
    const lowerKeywords = keywords.map((k) => k.toLowerCase())

    const matchesAnyKw = (text: string | undefined) => {
      if (!text || !hasKeywordFilter) return false
      const lower = text.toLowerCase()
      return lowerKeywords.some((kw) => lower.includes(kw))
    }

    return rows.value
      .map((row) => {
        // --- 行ラベルフィルター（コーナーセル）: マッチしない行は除外 ---
        if (hasRowLabelFilter) {
          const rowAttr = (row as any).attribute as RowAttribute | undefined
          const rowLabels: string[] = rowAttr?.labels?.map((l: any) => l.name) ?? []
          let rowLabelMatch = false
          if (selectedRowFilterLabelNames.value.includes(UNLABELED_VALUE) && rowLabels.length === 0) {
            rowLabelMatch = true
          } else {
            rowLabelMatch = rowLabels.some((l) => selectedRowFilterLabelNames.value.includes(l))
          }
          if (!rowLabelMatch) return null
        }

        const rowAttr = (row as any).attribute as RowAttribute | undefined
        const rowNameMatch = matchesAnyKw(row.name)
        const rowDescMatch = matchesAnyKw(rowAttr?.description)
        const rowLevelMatch = rowNameMatch || rowDescMatch

        let hasAnyMatchedTask = false

        const newTasks = row.tasks.map((task) => {
          let isLabelMatch = true
          if (hasLabelFilter) {
            const attribute = (task as any).attribute as TaskAttribute | undefined
            const taskLabels = attribute?.labels || []

            if (selectedFilterLabelNames.value.includes(UNLABELED_VALUE) && taskLabels.length === 0) {
              isLabelMatch = true
            } else {
              isLabelMatch = taskLabels.some((l) => selectedFilterLabelNames.value.includes(l.name))
            }
          }

          let isSearchMatch = true
          if (hasKeywordFilter) {
            const attr = (task as any).attribute as TaskAttribute | undefined
            isSearchMatch = matchesAnyKw(task.name) || matchesAnyKw(attr?.description)
          }

          let isTaskMatch = isLabelMatch
          if (hasKeywordFilter) {
            if (searchIncludeRows.value && rowLevelMatch) {
              // 行レベルでマッチしている場合、その行のタスクは（ラベル条件を満たしていれば）マッチとみなす
            } else {
              isTaskMatch = isTaskMatch && isSearchMatch
            }
          }

          if (isTaskMatch) {
            hasAnyMatchedTask = true
          }

          let newTask = { ...task }
          if (hasKeywordFilter && isTaskMatch) {
            Object.assign(newTask, { _searchKeywords: keywords })
          }

          if (!isTaskMatch) {
            // 対象外のタスクは非表示にするのではなく透過率を上げて区別する
            const styleStr = (newTask as any).style || ''
            const separator = styleStr && !styleStr.trim().endsWith(';') ? ';' : ''
            Object.assign(newTask, {
              style: `${styleStr}${separator} opacity: 0.2;`,
              _isFilteredOut: true,
            })
          }

          // 他ユーザーが編集中のタスクにハイライトスタイルを適用
          if (hasRemoteEditing) {
            newTask = applyRemoteEditingHighlight(newTask, editingMap)
          }

          return newTask
        })

        // 行検索ONの場合で、行レベルがマッチせず、かつマッチするタスクが一つもない場合は、その行ごと非表示にする
        if (hasKeywordFilter && searchIncludeRows.value) {
          if (!rowLevelMatch && !hasAnyMatchedTask) {
            return null
          }
        }

        return {
          ...row,
          _searchKeywords: hasKeywordFilter ? keywords : undefined,
          tasks: newTasks,
        }
      })
      .filter(Boolean) as typeof rows.value
  })

  /** filteredRows に選択中マーカーの情報を付与した表示用行データ */
  const displayRows = computed(() => {
    const selRowId = isMarkerDialogVisible.value ? editingMarkerRowId.value : null
    const selMarkerId = isMarkerDialogVisible.value ? editingMarker.value?.id : null
    if (!selRowId || !selMarkerId) return filteredRows.value

    return filteredRows.value.map((row) => {
      if (String(row.id) === selRowId) {
        return { ...row, selectedMarkerId: selMarkerId }
      }
      return row
    })
  })

  const isReadOnly = computed(() => readonlyMode.value || currentRole.value === 'viewer' || isPublicViewMode.value)
  const isOwner = computed(() => currentRole.value === 'owner' && !isPublicViewMode.value)

  const chartOption = computed<moguchart.GanttChartOption>(() => {
    // プロジェクトのマイルストーンを GanttChartMilestone に変換
    const projectMilestones = currentProject.value?.attribute?.milestones ?? []
    const milestones: moguchart.GanttChartMilestone[] = projectMilestones.map((ms, i) => ({
      id: `milestone-${i}`,
      name: ms.name,
      start: toLocalDate(ms.datetime),
      color: ms.color,
    }))

    // 月単位表示かどうか
    const isMonthly = currentProject.value?.attribute?.granularity === 'monthly'
    // 時間単位表示かどうか
    const isHourly = currentProject.value?.attribute?.granularity === 'hourly'
    // 1時間あたりのpx数をpxPerDayに換算
    const pxPerDayFromHour = pxPerHour.value * 24

    return {
      bar: {
        height: barHeight.value,
        margin: barMargin.value,
        cornerRadius: barCornerRadius.value,
      },
      label: {
        width: labelWidth.value,
      },
      calendar: {
        start: toLocalDate(chartStartStr.value),
        end: toLocalDate(chartEndStr.value),
        pxPerDay: isHourly ? pxPerDayFromHour : pxPerDay.value,
        ...(isMonthly
          ? {
              // 月単位表示: pxPerMonth を直接使用
              pxPerMonth: pxPerMonth.value,
              showDays: false,
              showWeeks: false,
              showMonthsRow: true,
              monthTextAlign: 'left' as const,
            }
          : isHourly
            ? {
                // 時間単位表示: 時刻グリッドを表示、年月ヘッダーは非表示
                showTime: true,
                showMonths: false,
                showWeeks: false,
                weekTextAlign: 'left' as const,
              }
            : {
                // 日単位表示: pxPerDay が 20 未満の場合は週番号表示に切り替え
                ...(pxPerDay.value < 20 ? { showWeeks: true, showDays: false, weekStartDay: 1 as const } : {}),
                weekTextAlign: 'left' as const,
                weekFormat: (_: number, startDate: Date) => startDate.getDate().toString(),
              }),
        ...(isHourly ? {} : { isHoliday: holiday_jp.isHoliday }),
        showCurrentTime: showCurrentTimeLine.value,
        currentTimeUpdateInterval: 1000 * 60,
        milestones: milestones.length > 0 ? milestones : undefined,
      },
      rowHeader: {
        maxWidth: 400,
        width: rowHeaderWidth.value,
      },
      enableRowReordering: !currentProject.value?.attribute?.disableRowReorder,
      enableCrossRowMove: !currentProject.value?.attribute?.disableCrossRowMove,
      snapDuration: currentProject.value?.attribute?.snapDurationMinutes ?? (isHourly ? 60 : 1440),
      readOnly: isReadOnly.value,
      showHiddenRows: showHiddenRows.value,
      theme: isPublicViewMode.value
        ? (publicThemeOverride.value || 'system') as 'light' | 'dark' | 'system'
        : userStore.currentTheme,
      // 時間単位表示では曜日・祝日の背景色を無効化する
      ...(isHourly
        ? {
            customTheme: {
              saturday: '',
              sunday: '',
              holiday: '',
              monday: '',
              tuesday: '',
              wednesday: '',
              thursday: '',
              friday: '',
            },
          }
        : {}),
      customRendering: {
        barContent,
        tooltip: (task: moguchart.GanttTask) => tooltip(task, isHourly),
        rowHeaderContent: (row: moguchart.GanttRow) => rowHeaderContent(row, barHeight.value),
        rowHeaderTooltip,
        cornerContent: createCornerContent(() => ({
          availableLabels: availableRowLabels.value,
          selectedLabels: selectedRowFilterLabelNames.value,
          onSelectionChange: (labels: string[]) => {
            selectedRowFilterLabelNames.value = labels
          },
        })),
      },
      zoom: {
        enabled: true,
        ...(isMonthly
          ? { min: ZOOM_MONTHLY.min, max: ZOOM_MONTHLY.max }
          : isHourly
            ? { min: ZOOM_HOURLY.min * 24, max: ZOOM_HOURLY.max * 24 }
            : { min: ZOOM_DAILY.min, max: ZOOM_DAILY.max }),
      },
      dependency: {
        showCriticalPath: showCriticalPath.value,
      },
      minimap: {
        enabled: showMinimap.value,
        width: minimapWidth.value,
        resizable: true,
      },
    }
  })

  /**
   * zoom-change イベントハンドラ
   * ホイールズームで変更された pxPerDay/pxPerMonth を ref に反映し、
   * DisplaySettingsMenu のスライダーおよびユーザー設定と同期する。
   */
  const handleZoomChange = (e: Event) => {
    const detail = (e as CustomEvent).detail as { pxPerDay: number; pxPerMonth?: number }
    const granularity = currentProject.value?.attribute?.granularity

    if (granularity === 'monthly' && detail.pxPerMonth !== undefined) {
      pxPerMonth.value = Math.round(detail.pxPerMonth)
    } else if (granularity === 'hourly') {
      // core は pxPerDay で通知するので pxPerHour に逆変換
      pxPerHour.value = Math.round(detail.pxPerDay / 24)
    } else {
      pxPerDay.value = Math.round(detail.pxPerDay)
    }
  }

  /**
   * minimap-resize イベントハンドラ
   * ユーザーがミニマップをドラッグリサイズした際に幅を同期
   */
  const handleMinimapResize = (e: Event) => {
    const detail = (e as CustomEvent).detail as { width: number; height: number }
    if (detail?.width) {
      minimapWidth.value = Math.round(detail.width)
    }
  }

  const alert = useAlert()
  const { exportAsCsv, exportAsExcel } = useExportData()

  const exportAsPng = async (projectName: string) => {
    const chart = ganttChartRef.value
    if (!chart) return
    try {
      await chart.exportImage('png', { filename: projectName, download: true })
    } catch (e) {
      console.error('PNG export failed:', e)
    }
  }

  const exportAsPdf = async (projectName: string) => {
    const chart = ganttChartRef.value
    if (!chart) return
    try {
      await chart.exportImage('pdf', { filename: projectName, download: true })
    } catch (e) {
      console.error('PDF export failed:', e)
    }
  }

  const exportAsZip = async (projectId: string, projectName: string) => {
    setIsLoading(true)
    try {
      const base64Data = await downloadProjectZip(projectId)
      const binaryString = atob(base64Data)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      const blob = new Blob([bytes], { type: 'application/zip' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${projectName}.json.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e: any) {
      console.error(e)
      alert({
        title: 'エラー',
        message: 'ZIPのダウンロードに失敗しました。',
      })
    } finally {
      setIsLoading(false)
    }
  }
  const { setIsLoading } = useLoading()
  const confirm = useConfirm()
  const prompt = usePrompt()
  const { canUndo, canRedo, isUndoRedoing, pushAction, undo: _undo, redo: _redo, clearHistory } = useUndoRedo()

  // --- リアルタイムコラボレーション ---
  const { activeUsers, editLogs, joinProject, leaveProject, publishEditEvent, onEditEvent, updateEditingTasks } =
    useCollaboration()

  /**
   * 他ユーザーが編集中のタスクIDとユーザー色のマップ
   * Map<taskId, { color, displayName }>
   */
  const remoteEditingTaskMap = computed(() => {
    const map = new Map<string, { color: string; displayName: string }>()
    for (const user of activeUsers.value) {
      if (!user.editingTaskIds) continue
      for (const taskId of user.editingTaskIds) {
        map.set(String(taskId), { color: user.color, displayName: user.displayName })
      }
    }
    return map
  })

  // undo/redo 実行後に他ユーザーへ通知するラッパー
  const undo = async () => {
    await _undo()
    publishEditEvent('full_reload')
  }
  const redo = async () => {
    await _redo()
    publishEditEvent('full_reload')
  }

  /**
   * サーバーからデータを取得し、ローカルの rows.value に対して変更があった行だけ差し替える。
   * affectedRowIds が指定された場合はその行のみ取得・差し替え、未指定時は全行を取得・差し替える。
   */
  const applyDelta = async (affectedRowIds?: string[]) => {
    if (!projectId.value) return
    try {
      // 影響行が指定されている場合は行単位の取得APIを使用し、それ以外は全行取得
      const data =
        affectedRowIds && affectedRowIds.length > 0
          ? await selectGanttRows({ projectId: projectId.value, rowIds: affectedRowIds.map(Number) })
          : await selectGanttChart(projectId.value)

      const convertRow = (row: GanttRow) => ({
        ...row,
        id: row.id.toString(),
        tasks: row.tasks.map((task: GanttTask) => {
          const attribute = (task as any).attribute as TaskAttribute | undefined
          const colorPalette = attribute?.colorPalette

          let style: string | undefined = 'box-shadow: var(--task-box-shadow, 0 2px 4px rgba(0, 0, 0, 0.3)); '
          let labelStyle: string | undefined
          let pattern: moguchart.GanttTaskPattern | undefined

          if (colorPalette) {
            if (colorPalette.backgroundColor) {
              style = `background-color: ${colorPalette.backgroundColor}; ${style || ''}`
              if (!colorPalette.borderType || (colorPalette.borderType as string) === 'none') {
                style += `border-color: ${colorPalette.backgroundColor}; `
              }
            }
            if (colorPalette.color) {
              labelStyle = `color: ${colorPalette.color}; ${labelStyle || ''}`
            }
            if (colorPalette.pattern) {
              pattern = {
                type: colorPalette.pattern.type as moguchart.BarPattern,
                color: colorPalette.pattern.color,
              }
            }
            if (colorPalette.borderType && (colorPalette.borderType as string) !== 'none') {
              const borderStr = getBorderStyle(colorPalette.borderType, colorPalette.borderColor)
              if (borderStr) {
                style += borderStr
              }
            }
          }

          // lock → moguchart の resizable / movable に変換
          const isLocked = attribute?.lock === true
          const resizable = isLocked ? false : undefined
          const movable = isLocked ? ('none' as const) : undefined

          return {
            ...task,
            id: task.id.toString(),
            start: toLocalDate(task.start),
            end: toLocalDate(task.end),
            style,
            labelStyle,
            pattern,
            resizable,
            movable,
            dependencies: attribute?.dependencies,
            html:
              attribute?.labels && attribute.labels.length > 0
                ? `<div style="display: flex; gap: 4px; padding: 2px 4px; overflow: hidden;">${attribute?.labels
                    .map(
                      (l) =>
                        `<span style="background-color: ${l.color}; color: ${getContrastColor(l.color)}; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; white-space: nowrap;">${l.name}</span>`,
                    )
                    .join('')}</div>`
                : undefined,
          }
        }),
        // RowAttribute のマーカーを moguchart.GanttMarker[] に変換
        markers: ((row as any).attribute as RowAttribute | undefined)?.markers?.map(
          (m: MarkerAttribute): moguchart.GanttMarker => ({
            id: m.id,
            name: m.name,
            date: toLocalDate(m.date),
            anchor: m.anchor,
            type: m.type,
            color: m.color,
            fontSize: m.fontSize,
          }),
        ),
      })

      const freshRows = data.map(convertRow)

      if (affectedRowIds && affectedRowIds.length > 0) {
        // 影響を受ける行だけ差し替え（他の行はそのまま保持）
        const freshMap = new Map(freshRows.map((r: any) => [String(r.id), r]))
        rows.value = rows.value.map((row) => {
          if (affectedRowIds.includes(String(row.id))) {
            const fresh = freshMap.get(String(row.id))
            return fresh || row
          }
          return row
        })
      } else {
        // 行の追加・削除・並べ替えなど構造的な変更 → 全行差し替え
        rows.value = freshRows
      }
    } catch (err) {
      console.error('[Collaboration] Failed to apply delta:', err)
    }
  }

  // 他ユーザーの編集イベントを受信して差分のみ反映（debounce付き）
  // イベント蓄積用バッファ
  let pendingEditEvents: { type: string; payload?: Record<string, any> }[] = []

  const flushRemoteEdits = debounce(async () => {
    const events = pendingEditEvents
    pendingEditEvents = []

    if (!projectId.value || events.length === 0) return

    // プロジェクトコメント更新がある場合、ストアのcommentCountを更新
    const hasProjectCommentUpdate = events.some(
      (e) => e.type === 'comment_update' && e.payload?.commentTarget === 'project',
    )
    if (hasProjectCommentUpdate) {
      invalidateProjectCommentsCache()
      await fetchProjectComments()
      await fetchProjects()
    }

    // full_reload / row_delete / row_upsert / row_reorder が含まれる場合は全行差し替え
    const needsFullReload = events.some((e) =>
      ['full_reload', 'row_delete', 'row_upsert', 'row_reorder'].includes(e.type),
    )

    if (needsFullReload) {
      await applyDelta()
      return
    }

    // task_upsert / task_delete / comment_update → 影響行だけ差分更新
    const affectedRowIds = new Set<string>()
    for (const e of events) {
      if (e.payload?.rowIds) {
        for (const id of e.payload.rowIds) {
          affectedRowIds.add(String(id))
        }
      }
    }

    if (affectedRowIds.size > 0) {
      await applyDelta([...affectedRowIds])
    } else {
      // rowId 情報がない場合はフォールバックで全行差し替え
      await applyDelta()
    }
  }, 1000)

  // タスクの表示用フォーマット関数
  const formatGanttTask = (task: any) => {
    const attribute = task.attribute as TaskAttribute | undefined
    const colorPalette = attribute?.colorPalette

    let style: string | undefined = 'box-shadow: var(--task-box-shadow, 0 2px 4px rgba(0, 0, 0, 0.3)); '
    let labelStyle: string | undefined
    let pattern: moguchart.GanttTaskPattern | undefined

    if (colorPalette) {
      if (colorPalette.backgroundColor) {
        style = `background-color: ${colorPalette.backgroundColor}; ${style || ''}`
        if (!colorPalette.borderType || (colorPalette.borderType as string) === 'none') {
          style += `border-color: ${colorPalette.backgroundColor}; `
        }
      }
      if (colorPalette.color) {
        labelStyle = `color: ${colorPalette.color}; ${labelStyle || ''}`
      }
      if (colorPalette.pattern) {
        pattern = {
          type: colorPalette.pattern.type as moguchart.BarPattern,
          color: colorPalette.pattern.color,
        }
      }
      if (colorPalette.borderType && (colorPalette.borderType as string) !== 'none') {
        const borderStr = getBorderStyle(colorPalette.borderType, colorPalette.borderColor)
        if (borderStr) {
          style += borderStr
        }
      }
    }

    // lock → moguchart の resizable / movable に変換
    const isLocked = attribute?.lock === true
    const resizable = isLocked ? false : undefined
    const movable = isLocked ? ('none' as const) : undefined

    return {
      ...task,
      id: task.id.toString(),
      start: toLocalDate(task.start),
      end: toLocalDate(task.end),
      style,
      labelStyle,
      pattern,
      resizable,
      movable,
      dependencies: attribute?.dependencies,
      html:
        attribute?.labels && attribute.labels.length > 0
          ? `<div style="display: flex; gap: 4px; padding: 2px 4px; overflow: hidden;">${attribute?.labels
              .map(
                (l) =>
                  `<span style="background-color: ${l.color}; color: ${getContrastColor(l.color)}; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; white-space: nowrap;">${l.name}</span>`,
              )
              .join('')}</div>`
          : undefined,
    }
  }

  onEditEvent((event) => {
    pendingEditEvents.push({ type: event.type, payload: event.payload })
    flushRemoteEdits()
  })

  // --- データ永続化ロジック ---

  async function loadData(pId: string, options?: { silent?: boolean }) {
    if (!pId) return
    const silent = options?.silent ?? false
    if (!silent) setIsLoading(true)
    try {
      // 公開閲覧モードでは REST API 経由でデータを取得（認証不要）
      let data: GanttRow[]
      if (isPublicViewMode.value) {
        const publicData = await fetchPublicGanttChart(pId)
        if (!publicData) {
          throw new Error('Public project data not available')
        }
        data = publicData
      } else {
        data = await selectGanttChart(pId)
      }
      rows.value = data.map((row: GanttRow) => ({
        ...row,
        id: row.id.toString(),
        tasks: row.tasks.map(formatGanttTask),
        // RowAttribute のマーカーを moguchart.GanttMarker[] に変換
        markers: (row.attribute as RowAttribute | undefined)?.markers?.map(
          (m: MarkerAttribute): moguchart.GanttMarker => ({
            id: m.id,
            name: m.name,
            date: toLocalDate(m.date),
            anchor: m.anchor,
            type: m.type,
            color: m.color,
            fontSize: m.fontSize,
          }),
        ),
      }))

      // 全タスクおよび行の画像URLをプリロードしてキャッシュを温める
      const allImageUrls: string[] = []
      for (const row of rows.value) {
        const rowUrls = (row as any).attribute?.imageUrls as string[] | undefined
        if (rowUrls) allImageUrls.push(...rowUrls.filter(Boolean))
        for (const task of row.tasks) {
          const urls = (task as any).attribute?.imageUrls as string[] | undefined
          if (urls) allImageUrls.push(...urls.filter(Boolean))
        }
      }
      if (allImageUrls.length > 0) preloadImages(allImageUrls)
    } catch (err) {
      console.error('Failed to load data:', err)
      alert({
        title: 'エラー',
        message: 'データの読み込みに失敗しました。',
      })
    } finally {
      if (!silent) setIsLoading(false)
    }
  }

  const loadSnapshotData = async (pId: string, sName: string) => {
    setIsLoading(true)
    try {
      const data = await loadSnapshot({ projectId: pId, snapshotName: sName })
      snapshotProject.value = { ...data.project, role: 'viewer' }

      // スナップショットのコメントデータをキャッシュにプリロード
      const taskCommentEntries: { taskId: number; comments: any[] }[] = []
      const rowCommentEntries: { rowId: number; comments: any[] }[] = []

      rows.value = data.rows.map((row: any) => {
        // 行コメントの処理
        const rowComments = row.comments as any[] | undefined
        if (rowComments && rowComments.length > 0) {
          row.commentCount = rowComments.length
          rowCommentEntries.push({ rowId: Number(row.id), comments: rowComments })
        }

        return {
          ...row,
          id: row.id.toString(),
          tasks: row.tasks.map((task: any) => {
            // タスクコメントの処理
            const taskComments = task.comments as any[] | undefined
            if (taskComments && taskComments.length > 0) {
              task.commentCount = taskComments.length
              taskCommentEntries.push({ taskId: Number(task.id), comments: taskComments })
            }
            return formatGanttTask(task)
          }),
          // RowAttribute のマーカーを moguchart.GanttMarker[] に変換
          markers: (row.attribute as RowAttribute | undefined)?.markers?.map(
            (m: MarkerAttribute): moguchart.GanttMarker => ({
              id: m.id,
              name: m.name,
              date: toLocalDate(m.date),
              anchor: m.anchor,
              type: m.type,
              color: m.color,
              fontSize: m.fontSize,
            }),
          ),
        }
      }) as any

      if (taskCommentEntries.length > 0) {
        preloadCommentsCache(taskCommentEntries)
      }
      if (rowCommentEntries.length > 0) {
        preloadRowCommentsCache(rowCommentEntries)
      }

      // 全タスクおよび行の画像URLをプリロードしてキャッシュを温める
      const allImageUrls: string[] = []
      for (const row of rows.value) {
        const rowUrls = (row as any).attribute?.imageUrls as string[] | undefined
        if (rowUrls) allImageUrls.push(...rowUrls.filter(Boolean))
        for (const task of row.tasks) {
          const urls = (task as any).attribute?.imageUrls as string[] | undefined
          if (urls) allImageUrls.push(...urls.filter(Boolean))
        }
      }
      if (allImageUrls.length > 0) preloadImages(allImageUrls)

      // プロジェクトコメントの処理
      const snapshotProjectComments = data.project.comments as any[] | undefined
      if (snapshotProjectComments && snapshotProjectComments.length > 0) {
        snapshotProject.value = { ...snapshotProject.value!, commentCount: snapshotProjectComments.length }
        projectComments.value = snapshotProjectComments as Comment[]
        projectCommentsFetchedAt = Infinity
      }

      chartStartStr.value = data.project.start || chartStartStr.value
      chartEndStr.value = data.project.end || chartEndStr.value
    } catch (err) {
      console.error('Failed to load snapshot data:', err)
      alert({
        title: 'エラー',
        message: 'スナップショットの読み取りに失敗しました。',
      })
    } finally {
      setIsLoading(false)
    }
  }

  watch(storeProjectId, async (newProjectId, oldProjectId) => {
    if (isSnapshotMode.value) return // スナップショットモード時はストアの監視を無視

    const project = projects.value.find((p) => p.id === newProjectId)
    if (project) {
      chartStartStr.value = project.start
      chartEndStr.value = project.end
    }
    clearHistory()
    loadData(newProjectId)

    const currentRouteId = Array.isArray(route.params.id) ? route.params.id[0] : route.params.id
    if (newProjectId && currentRouteId !== newProjectId) {
      router.push(`/${newProjectId}`)
    }

    // コラボレーション: プロジェクト切替時にプレゼンスを更新（公開閲覧モードでは不要）
    if (!isPublicViewMode.value) {
      if (oldProjectId) {
        await leaveProject()
      }
      if (newProjectId && userStore.user) {
        await joinProject(
          newProjectId,
          userStore.user.email,
          userStore.user.displayName,
          userStore.firebaseUser?.photoURL || undefined,
        )
      }
    }
  })

  watch(
    () => route.params.snapshotName,
    async (newSnapshotName) => {
      if (newSnapshotName && projectId.value) {
        clearHistory()
        loadSnapshotData(projectId.value, newSnapshotName as string)
      }
    },
    { immediate: true },
  )

  watch(
    () => userStore.user,
    async (newUser) => {
      if (isSnapshotMode.value) return // スナップショットモードではプロジェクト読み込みや未ログイン解除を無視

      if (newUser) {
        // ユーザーがログインした場合、プロジェクトリストを読み込む
        await fetchProjects()

        const routeId = Array.isArray(route.params.id) ? route.params.id[0] : route.params.id
        const targetProject = routeId ? projects.value.find((p) => p.id === routeId) : undefined

        if (targetProject) {
          setProjectId(targetProject.id)
        } else if (!userStore.suppressProjectList) {
          // 匿名ログイン後の案内ダイアログ表示中は抑制する
          isProjectListDialogVisible.value = true
        }
      } else if (!isPublicViewMode.value) {
        // ユーザーがログアウトした場合、データをクリアする
        // ただし公開閲覧モードではクリアしない
        await leaveProject()
        rows.value = []
        clearProjectStore()
      }
    },
    { immediate: true }, // コンポーネントのマウント時に即時実行する
  )

  // 公開閲覧モードに切り替わったらガントデータを読み込む
  watch(isPublicViewMode, async (isPublic) => {
    if (isPublic && projectId.value) {
      // すでに App.vue でプロジェクト情報はストアに設定済み
      // ここではガントチャートデータを読み込む
      const project = storeProject.value
      if (project) {
        chartStartStr.value = project.start
        chartEndStr.value = project.end
      }
      clearHistory()
      await loadData(projectId.value)
    }
  }, { immediate: true })

  // 匿名ログイン後の案内ダイアログが閉じられたらプロジェクト一覧を表示する
  watch(
    () => userStore.suppressProjectList,
    (suppressed) => {
      if (!suppressed && userStore.user && !isSnapshotMode.value) {
        const routeId = Array.isArray(route.params.id) ? route.params.id[0] : route.params.id
        const targetProject = routeId ? projects.value.find((p) => p.id === routeId) : undefined
        if (!targetProject) {
          isProjectListDialogVisible.value = true
        }
      }
    },
  )

  const handleTaskUpdate = async (e: CustomEvent<moguchart.TaskUpdateEventDetail>) => {
    if (e.detail.isDragging || e.detail.isCancel || e.detail.isOutside) {
      return
    }

    await maybeAutoSnapshot()

    // 複数タスク一括移動の処理
    const selectedIds = e.detail.selectedTaskIds
    const isDisableCrossRowMove = !!currentProject.value?.attribute?.disableCrossRowMove
    if (selectedIds && selectedIds.length >= 2 && e.detail.dx !== undefined) {
      const msPerPx = (24 * 60 * 60 * 1000) / pxPerDay.value
      const timeDiff = e.detail.dx * msPerPx

      // 行移動が発生するかどうかを判定
      const targetRowId = e.detail.targetRowId
      const hasRowChange = !isDisableCrossRowMove && !!targetRowId && rows.value.some((r) => {
        const hasTask = r.tasks.some((t) => selectedIds.includes(t.id))
        return hasTask && String(r.id) !== String(targetRowId)
      })

      // 水平移動も行移動もない場合は何もしない
      if (timeDiff === 0 && !hasRowChange) return

      // 変更前データ（undo用）と変更後データを構築
      const beforeDataList: { id: number; rowId: number; name: string; start: string; end: string; attribute: any }[] =
        []
      const afterDataList: { id: number; rowId: number; name: string; start: string; end: string; attribute: any }[] =
        []
      const affectedRowIdSet = new Set<number>()

      for (const taskId of selectedIds) {
        const taskIdStr = String(taskId)
        const taskRow = rows.value.find((r) => r.tasks.some((t) => t.id === taskIdStr))
        const taskItem = taskRow?.tasks.find((t) => t.id === taskIdStr)
        if (!taskRow || !taskItem) continue

        const attr = (taskItem as any).attribute as TaskAttribute | undefined
        affectedRowIdSet.add(Number(taskRow.id))

        // 行移動先のrowIdを決定
        const afterRowId = hasRowChange ? Number(targetRowId) : Number(taskRow.id)
        if (hasRowChange) {
          affectedRowIdSet.add(Number(targetRowId))
        }

        beforeDataList.push({
          id: Number(taskItem.id),
          rowId: Number(taskRow.id),
          name: taskItem.name || '',
          start: toDateTimeString(taskItem.start),
          end: toDateTimeString(taskItem.end),
          attribute: attr ? { ...attr } : {},
        })

        afterDataList.push({
          id: Number(taskItem.id),
          rowId: afterRowId,
          name: taskItem.name || '',
          start: toDateTimeString(new Date(taskItem.start.getTime() + timeDiff)),
          end: toDateTimeString(new Date(taskItem.end.getTime() + timeDiff)),
          attribute: attr ? { ...attr } : {},
        })
      }

      if (afterDataList.length === 0) return

      pushAction({
        description: `タスク一括移動 (${afterDataList.length}件)`,
        undo: async () => {
          await upsertGanttTasks(beforeDataList)
          await loadData(projectId.value, { silent: true })
        },
        redo: async () => {
          await upsertGanttTasks(afterDataList)
          await loadData(projectId.value, { silent: true })
        },
      })
      await upsertGanttTasks(afterDataList)
      await loadData(projectId.value, { silent: true })
      publishEditEvent('task_upsert', {
        rowIds: [...affectedRowIdSet],
        targetName: `${afterDataList.length}件のタスク`,
        isNew: false,
        taskId: String(afterDataList[0]!.id),
      })
      return
    }

    const data = {
      id: e.detail.mode === 'copy' ? 0 : Number(e.detail.id),
      rowId: Number(e.detail.targetRowId),
      name: e.detail.name || '',
      start: toDateTimeString(e.detail.start),
      end: toDateTimeString(e.detail.end),
      attribute: {},
    }

    // コピー時はdata.idが0なので、元タスクのIDで検索する
    const sourceTaskIdStr = String(e.detail.id)
    const row = rows.value.find((r) => r.tasks.some((t) => t.id === sourceTaskIdStr))
    if (isDisableCrossRowMove && row) {
      data.rowId = Number(row.id)
    }
    const task = row?.tasks.find((t) => t.id === sourceTaskIdStr)
    if (task) {
      const attribute = (task as any).attribute as TaskAttribute | undefined
      if (attribute) {
        if (e.detail.mode === 'copy') {
          // コピー時は接続線情報（dependencies）を引き継がない
          const { dependencies: _deps, ...attributeWithoutDeps } = attribute
          data.attribute = attributeWithoutDeps
        } else {
          data.attribute = { ...attribute }
        }
      }

      // 変更がない場合は何もしない
      if (
        data.id !== 0 && // 新規作成(コピー)でない
        data.rowId === Number(row?.id) &&
        data.name === task.name &&
        data.start === toDateString(task.start) &&
        data.end === toDateString(task.end)
      ) {
        return
      }
    }

    let affectedTaskId = String(data.id)
    if (data.id === 0) {
      // コピー（新規作成）の場合
      const result = await upsertGanttTasks([data])
      const newTaskId = result[0]!
      affectedTaskId = String(newTaskId)
      pushAction({
        description: 'タスクコピー',
        undo: async () => {
          await deleteGanttTask([newTaskId])
          await loadData(projectId.value, { silent: true })
        },
        redo: async () => {
          await upsertGanttTasks([{ ...data, id: 0 }])
          await loadData(projectId.value, { silent: true })
        },
      })
    } else if (task && row) {
      // 移動/リサイズの場合
      const beforeData = {
        id: Number(task.id),
        rowId: Number(row.id),
        name: task.name || '',
        start: toDateTimeString(task.start),
        end: toDateTimeString(task.end),
        attribute: { ...((task as any).attribute || {}) },
      }
      pushAction({
        description: 'タスク移動/リサイズ',
        undo: async () => {
          await upsertGanttTasks([beforeData])
          await loadData(projectId.value, { silent: true })
        },
        redo: async () => {
          await upsertGanttTasks([data])
          await loadData(projectId.value, { silent: true })
        },
      })
      await upsertGanttTasks([data])
    } else {
      await upsertGanttTasks([data])
    }
    await loadData(projectId.value, { silent: true })
    // 行をまたぐ移動の場合、元の行と移動先の行の両方を差分更新対象にする
    const affectedRowIds = [...new Set([Number(e.detail.targetRowId), ...(row ? [Number(row.id)] : [])])]
    publishEditEvent('task_upsert', {
      rowIds: affectedRowIds,
      targetName: data.name,
      isNew: data.id === 0,
      taskId: affectedTaskId,
    })
  }

  const handleDependencyCreate = async (e: CustomEvent<moguchart.DependencyCreateEventDetail>) => {
    if (isReadOnly.value) return
    const { sourceTaskId, targetTaskId } = e.detail

    const targetRow = rows.value.find((r) => r.tasks.some((t) => t.id === targetTaskId))
    const targetTask = targetRow?.tasks.find((t) => t.id === targetTaskId)

    if (!targetRow || !targetTask) return

    const attribute = ((targetTask as any).attribute as TaskAttribute) || {}
    const deps = attribute.dependencies || []

    // すでに依存関係が存在する場合は何もしない
    if (deps.includes(sourceTaskId)) return

    const newDependencies = [...deps, sourceTaskId]

    const data = {
      id: Number(targetTask.id),
      rowId: Number(targetRow.id),
      name: targetTask.name || '',
      start: toDateTimeString(targetTask.start),
      end: toDateTimeString(targetTask.end),
      attribute: { ...attribute, dependencies: newDependencies },
    }

    pushAction({
      description: 'タスクの依存関係を追加',
      undo: async () => {
        const undoData = { ...data, attribute }
        await upsertGanttTasks([undoData])
        await loadData(projectId.value, { silent: true })
      },
      redo: async () => {
        await upsertGanttTasks([data])
        await loadData(projectId.value, { silent: true })
      },
    })

    await upsertGanttTasks([data])
    await loadData(projectId.value, { silent: true })
    publishEditEvent('task_upsert', {
      rowIds: [Number(targetRow.id)],
      targetName: targetTask.name,
      isNew: false,
      taskId: String(targetTask.id),
    })
  }

  const dependencyContextMenu = ref({
    visible: false,
    x: 0,
    y: 0,
    sourceTaskId: null as string | null,
    targetTaskId: null as string | null,
  })

  const handleDependencyClick = (e: CustomEvent<moguchart.DependencyClickEventDetail>) => {
    if (isReadOnly.value) return
    const event = e.detail.event
    if (event) {
      event.preventDefault()
      dependencyContextMenu.value = {
        visible: true,
        x: event.clientX,
        y: event.clientY,
        sourceTaskId: e.detail.sourceTaskId,
        targetTaskId: e.detail.targetTaskId,
      }
    }
  }

  const handleDeleteDependencyFromContextMenu = async () => {
    dependencyContextMenu.value.visible = false
    const { sourceTaskId, targetTaskId } = dependencyContextMenu.value
    if (!sourceTaskId || !targetTaskId) return

    const targetRow = rows.value.find((r) => r.tasks.some((t) => t.id === targetTaskId))
    const targetTask = targetRow?.tasks.find((t) => t.id === targetTaskId)

    if (!targetRow || !targetTask) return

    const attribute = ((targetTask as any).attribute as TaskAttribute) || {}
    const deps = attribute.dependencies || []

    const newDependencies = deps.filter((id) => id !== sourceTaskId)

    const data = {
      id: Number(targetTask.id),
      rowId: Number(targetRow.id),
      name: targetTask.name || '',
      start: toDateTimeString(targetTask.start),
      end: toDateTimeString(targetTask.end),
      attribute: { ...attribute, dependencies: newDependencies },
    }

    pushAction({
      description: 'タスクの依存関係を削除',
      undo: async () => {
        const undoData = { ...data, attribute }
        await upsertGanttTasks([undoData])
        await loadData(projectId.value, { silent: true })
      },
      redo: async () => {
        await upsertGanttTasks([data])
        await loadData(projectId.value, { silent: true })
      },
    })

    await upsertGanttTasks([data])
    await loadData(projectId.value, { silent: true })
    publishEditEvent('task_upsert', {
      rowIds: [Number(targetRow.id)],
      targetName: targetTask.name,
      isNew: false,
      taskId: String(targetTask.id),
    })
  }

  // --- ドラッグ＆ドロップ関連 ---
  const ganttChartRef = ref<any | null>(null)

  const handleTaskDragStart = (e: DragEvent, task: moguchart.GanttTask) => {
    if (e.dataTransfer) {
      e.dataTransfer.setData('application/json', JSON.stringify(task))
      e.dataTransfer.effectAllowed = 'copy'

      // ドラッグイメージをカスタマイズ
      const dragImage = document.createElement('div')
      dragImage.id = 'custom-drag-image'
      dragImage.style.cssText = `
        position: absolute;
        top: -9999px;
        left: -9999px;
        width: 180px;
        height: ${barHeight.value}px;
        border-radius: 4px;
        padding: 0 8px;
        display: flex;
        align-items: center;
        font-size: 12px;
        ${task.labelStyle || 'color: #ffffff'};
        font-weight: bold;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        background-color: #3b82f6;
        ${task.style || ''};
        ${moguchart.getPatternStyle(task.pattern)};
      `
      dragImage.textContent = task.name || ''
      document.body.appendChild(dragImage)

      e.dataTransfer.setDragImage(dragImage, 0, 0)
    }

    if (ganttChartRef.value) {
      ganttChartRef.value.externalDraggingTask = {
        ...task,
        type: 'normal',
        attribute: (task as any).attribute,
      }
    }
  }

  const handleTaskDragEnd = () => {
    if (ganttChartRef.value) {
      ganttChartRef.value.externalDraggingTask = null
    }

    // カスタムドラッグイメージのクリーンアップ
    const dragImage = document.getElementById('custom-drag-image')
    if (dragImage) {
      dragImage.remove()
    }
  }

  const handleTaskDrop = async (e: CustomEvent<moguchart.TaskDropEventDetail>) => {
    const { task, dropDate, targetRowId } = e.detail
    try {
      const newStart = new Date(dropDate)
      const duration = new Date(task.end).getTime() - new Date(task.start).getTime()
      const newEnd = new Date(newStart.getTime() + duration)

      // 楽観的UI更新: アニメーション用の仮タスクを表示
      const tempId = -Date.now()
      const optimisticTask = {
        ...task,
        id: tempId,
        rowId: Number(targetRowId),
        name: task.name || '',
        start: newStart,
        end: newEnd,
        style: `box-shadow: var(--task-box-shadow, 0 2px 4px rgba(0, 0, 0, 0.3)); ${(task as any).style || ''}; transform-origin: center; animation: pop-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;`,
      }

      rows.value = rows.value.map((r) => {
        if (String(r.id) === String(targetRowId)) {
          return { ...r, tasks: [...r.tasks, optimisticTask as any] }
        }
        return r
      })

      // 新規タスク作成
      const taskAny = task as any
      let colorPalette = taskAny.attribute?.colorPalette

      if (!colorPalette && taskAny.style) {
        const bgMatch = taskAny.style.match(/background-color:\s*([^;]+)/)
        if (bgMatch) {
          colorPalette = {
            backgroundColor: bgMatch[1].trim(),
            color: taskAny.labelStyle?.match(/color:\s*([^;]+)/)?.[1].trim() || '#ffffff',
            pattern: taskAny.pattern,
          }
        }
      }

      const taskData = {
        id: 0, // 新規作成
        rowId: Number(targetRowId),
        name: task.name,
        start: toDateTimeString(newStart),
        end: toDateTimeString(newEnd),
        attribute: {
          ...(taskAny.attribute || {}),
          description: taskAny.attribute?.description || '',
          colorPalette,
        },
      } as any

      const result = await upsertGanttTasks([taskData])
      const newTaskId = result[0]!
      pushAction({
        description: 'タスクドロップ',
        undo: async () => {
          await deleteGanttTask([newTaskId])
          await loadData(projectId.value, { silent: true })
        },
        redo: async () => {
          await upsertGanttTasks([{ ...taskData, id: 0 }])
          await loadData(projectId.value, { silent: true })
        },
      })
      await loadData(projectId.value, { silent: true })
      publishEditEvent('task_upsert', {
        rowIds: [Number(targetRowId)],
        targetName: task.name,
        isNew: true,
        taskId: String(newTaskId),
      })
    } catch (err) {
      console.error('Failed to drop task:', err)
      await alert({
        title: 'エラー',
        message: 'タスクの作成に失敗しました。',
      })
    }
  }

  const handleSelectTaskFromLog = (taskId: string) => {
    if (ganttChartRef.value && typeof ganttChartRef.value.selectTask === 'function') {
      ganttChartRef.value.selectTask(taskId)
    } else {
      // Fallback in case selectTask is not directly available, though the user requested to call it.
      selectedTaskIds.value = [taskId]
    }
  }

  const handleClickLogFromActivity = (log: ActivityLogEntry) => {
    // プロジェクトコメント更新ログのクリック → サイドバーを開く（既に開いていたら何もしない）
    if (log.type === 'comment_update' && log.commentTarget === 'project') {
      if (!commentSidebarOpen.value) {
        commentSidebarOpen.value = true
      }
    }
  }

  const handleDblClickTaskFromLog = (log: ActivityLogEntry) => {
    if (log.type === 'comment_update') {
      // コメント更新ログ: commentTarget に応じて適切なダイアログを開く
      const commentTarget = log.commentTarget || (log.taskId ? 'task' : log.rowId ? 'row' : 'project')

      if (commentTarget === 'task' && log.taskId) {
        handleSelectTaskFromLog(log.taskId)
        const taskIdNum = Number(log.taskId)
        const row = rows.value.find((r) => r.tasks.some((t) => Number(t.id) === taskIdNum))
        const task = row?.tasks.find((t) => Number(t.id) === taskIdNum)

        commentDialogTaskId.value = taskIdNum
        commentDialogRowId.value = null
        commentDialogProjectId.value = null
        commentDialogTargetName.value = task?.name || ''
        isCommentDialogVisible.value = true
      } else if (commentTarget === 'row' && log.rowId) {
        const rowIdNum = Number(log.rowId)
        const row = rows.value.find((r) => Number(r.id) === rowIdNum)

        commentDialogTaskId.value = null
        commentDialogRowId.value = rowIdNum
        commentDialogProjectId.value = null
        commentDialogTargetName.value = row?.name || log.targetName || ''
        isCommentDialogVisible.value = true
      } else if (commentTarget === 'project') {
        handleAddCommentToProject()
      }
      return
    }

    if (!log.taskId) return

    // タスクを選択状態にする
    handleSelectTaskFromLog(log.taskId)
    startEditingTask(log.taskId)
  }

  // --- ダイアログ関連 ---
  const isDialogVisible = ref(false)

  // ダイアログが閉じられた場合（バツボタン・ESC・背景クリック等）に編集中タスク通知を解除
  watch(isDialogVisible, (visible) => {
    if (!visible) {
      updateEditingTasks([])
    }
  })

  // --- マーカーダイアログ関連 ---
  const isMarkerDialogVisible = ref(false)
  const editingMarker = ref<MarkerAttribute | null>(null)
  const editingMarkerRowId = ref<string | undefined>()
  const editingMarkerDefaultDate = ref<string | undefined>()

  const editingTask = ref<EditingTaskData>({
    id: '',
    rowId: '',
    name: '',
    start: '',
    end: '',
    description: '',
    labels: [],
    progress: undefined,
  })

  const startEditingTask = (taskId: string) => {
    const row = rows.value.find((r) => r.tasks.some((t) => t.id === taskId))
    const task = row?.tasks.find((t) => t.id === taskId)

    if (row && task) {
      const taskWithAttr = task as unknown as { attribute?: TaskAttribute }
      editingTask.value = {
        id: task.id,
        rowId: row.id,
        name: task.name || '',
        start: toDateTimeString(task.start),
        end: toDateTimeString(task.end),
        description: taskWithAttr.attribute?.description || '',
        colorPalette: taskWithAttr.attribute?.colorPalette ? { ...taskWithAttr.attribute.colorPalette } : undefined,
        labels: taskWithAttr.attribute?.labels ? [...taskWithAttr.attribute.labels] : [],
        lock: taskWithAttr.attribute?.lock,
        progress: taskWithAttr.attribute?.progress,
        dependencies: taskWithAttr.attribute?.dependencies ? [...taskWithAttr.attribute.dependencies] : undefined,
        imageUrls: taskWithAttr.attribute?.imageUrls ? [...taskWithAttr.attribute.imageUrls] : undefined,
      }
      isDialogVisible.value = true
      // 他ユーザーにこのタスクを編集中であることを通知
      updateEditingTasks([task.id])
    }
  }

  const handleTaskDblClick = (e: CustomEvent<moguchart.TaskClickEventDetail>) => {
    if (isReadOnly.value) return
    const taskId = String(e.detail.task.id)
    startEditingTask(taskId)
  }

  const saveTask = async (taskData: typeof editingTask.value) => {
    await maybeAutoSnapshot()

    // 新規作成の場合、アニメーション用の楽観的UI更新を行う
    if (!taskData.id) {
      const tempId = -Date.now()
      const start = toLocalDate(taskData.start)
      const end = toLocalDate(taskData.end)

      // スタイルの構築
      let style = 'box-shadow: var(--task-box-shadow, 0 2px 4px rgba(0, 0, 0, 0.3)); '
      if (taskData.colorPalette?.backgroundColor) {
        style += `background-color: ${taskData.colorPalette.backgroundColor}; `
      } else {
        style += `background-color: ${DEFAULT_TASK_COLOR}; `
      }

      const borderStr = getBorderStyle(taskData.colorPalette?.borderType, taskData.colorPalette?.borderColor)
      if (borderStr) {
        style += borderStr
      } else if (taskData.colorPalette?.backgroundColor) {
        // デフォルトでは背景色と同じ色を枠線にする（既存の挙動）
        style += `border-color: ${taskData.colorPalette.backgroundColor}; `
      }

      // アニメーションの追加
      style += `transform-origin: center; animation: pop-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;`

      const optimisticTask = {
        id: tempId,
        name: taskData.name,
        start,
        end,
        style,
      }

      rows.value = rows.value.map((r) => {
        if (Number(r.id) === Number(taskData.rowId)) {
          return { ...r, tasks: [...r.tasks, optimisticTask as any] }
        }
        return r
      })
    }

    const data = {
      id: Number(taskData.id),
      rowId: Number(taskData.rowId),
      name: taskData.name,
      start: taskData.start,
      end: taskData.end,
      attribute: {
        description: taskData.description || undefined,
        colorPalette: taskData.colorPalette,
        labels: taskData.labels,
        lock: taskData.lock || undefined,
        progress: taskData.progress != null ? taskData.progress : undefined,
        dependencies: taskData.dependencies && taskData.dependencies.length > 0 ? taskData.dependencies : undefined,
        imageUrls: taskData.imageUrls && taskData.imageUrls.length > 0 ? taskData.imageUrls : undefined,
      },
    }

    // ダイアログを閉じる
    isDialogVisible.value = false
    // 編集中タスクの通知を解除
    updateEditingTasks([])

    let affectedTaskId = String(taskData.id)
    if (!taskData.id) {
      // 新規作成
      const result = await upsertGanttTasks([data])
      const newTaskId = result[0]!
      affectedTaskId = String(newTaskId)
      pushAction({
        description: 'タスク作成',
        undo: async () => {
          await deleteGanttTask([newTaskId])
          await loadData(projectId.value, { silent: true })
        },
        redo: async () => {
          await upsertGanttTasks([{ ...data, id: 0 }])
          await loadData(projectId.value, { silent: true })
        },
      })
    } else {
      // 編集：変更前のデータを保持
      const taskIdStr = String(taskData.id)
      const beforeRow = rows.value.find((r) => r.tasks.some((t) => t.id === taskIdStr))
      const beforeTask = beforeRow?.tasks.find((t) => t.id === taskIdStr)
      if (beforeTask && beforeRow) {
        const beforeAttr = (beforeTask as any).attribute as TaskAttribute | undefined
        const beforeData = {
          id: Number(beforeTask.id),
          rowId: Number(beforeRow.id),
          name: beforeTask.name || '',
          start: toDateTimeString(beforeTask.start),
          end: toDateTimeString(beforeTask.end),
          attribute: {
            description: beforeAttr?.description || undefined,
            colorPalette: beforeAttr?.colorPalette ? { ...beforeAttr.colorPalette } : undefined,
            labels: beforeAttr?.labels ? [...beforeAttr.labels] : undefined,
            lock: beforeAttr?.lock,
            progress: beforeAttr?.progress,
            dependencies: beforeAttr?.dependencies ? [...beforeAttr.dependencies] : undefined,
          },
        }
        pushAction({
          description: 'タスク編集',
          undo: async () => {
            await upsertGanttTasks([beforeData])
            await loadData(projectId.value, { silent: true })
          },
          redo: async () => {
            await upsertGanttTasks([data])
            await loadData(projectId.value, { silent: true })
          },
        })
      }
      await upsertGanttTasks([data])
    }
    await loadData(projectId.value, { silent: true })
    publishEditEvent('task_upsert', {
      rowIds: [Number(taskData.rowId)],
      targetName: taskData.name,
      isNew: !taskData.id,
      taskId: affectedTaskId,
    })
  }

  const execDeleteTasksWithAnimation = async (taskIds: string[]) => {
    // ロックされたタスクを除外
    const unlocked = taskIds.filter((taskId) => {
      const row = rows.value.find((r) => r.tasks.some((t) => t.id === taskId))
      const task = row?.tasks.find((t) => t.id === taskId)
      const attr = (task as any)?.attribute as TaskAttribute | undefined
      return !attr?.lock
    })
    if (unlocked.length === 0) {
      alert({ title: '削除不可', message: 'ロックされたタスクは削除できません。' })
      return
    }
    if (unlocked.length < taskIds.length) {
      alert({ title: '注意', message: 'ロックされたタスクはスキップされました。' })
    }

    await maybeAutoSnapshot()

    // Undo用に削除前のタスクデータを保持
    const deletedTasks: { taskData: any; rowId: string }[] = []
    for (const taskId of unlocked) {
      const row = rows.value.find((r) => r.tasks.some((t) => t.id === taskId))
      const task = row?.tasks.find((t) => t.id === taskId)
      if (row && task) {
        const attr = (task as any).attribute as TaskAttribute | undefined
        deletedTasks.push({
          rowId: row.id,
          taskData: {
            id: Number(task.id), // Undo時は元のIDで復元
            rowId: Number(row.id),
            name: task.name || '',
            start: toDateTimeString(task.start),
            end: toDateTimeString(task.end),
            attribute: attr ? { ...attr } : {},
          },
        })
      }
    }

    // 1. アニメーション適用
    rows.value = rows.value.map((row) => ({
      ...row,
      tasks: row.tasks.map((t) => {
        if (unlocked.includes(String(t.id))) {
          return {
            ...t,
            style: `${(t as any).style || ''}; animation: fade-out 0.3s ease-out forwards; pointer-events: none;`,
          }
        }
        return t
      }),
    }))

    // 2. 待機
    await new Promise((resolve) => setTimeout(resolve, 300))

    // 3. API削除
    await deleteGanttTask(unlocked.map(Number))

    // 3.5. 削除されたタスクに紐付く画像を Storage から削除
    const imageUrlsToDelete = deletedTasks
      .flatMap((d) => (d.taskData.attribute?.imageUrls as string[] | undefined) ?? [])
      .filter(Boolean)
    if (imageUrlsToDelete.length > 0) {
      deleteImagesFromStorage(imageUrlsToDelete) // 非同期で実行（メイン処理をブロックしない）
    }

    // 4. Undo/Redo記録
    if (deletedTasks.length > 0) {
      pushAction({
        description: `タスク削除 (${deletedTasks.length}件)`,
        undo: async () => {
          await upsertGanttTasks(deletedTasks.map((d) => d.taskData))
          await loadData(projectId.value, { silent: true })
        },
        redo: async () => {
          // NOTE: Undo復元後のIDは変わるので、最新のrowsから名前で再検索
          // ただし完全一致は保証できないため、loadData後に再取得して削除
          // ここではシンプルにredo用のタスクデータを再作成して削除
          const currentTaskIds: number[] = []
          for (const dt of deletedTasks) {
            const row = rows.value.find((r) => String(r.id) === String(dt.rowId))
            if (row) {
              const matchingTask = row.tasks.find(
                (t) =>
                  t.name === dt.taskData.name &&
                  toDateTimeString(t.start) === dt.taskData.start &&
                  toDateTimeString(t.end) === dt.taskData.end,
              )
              if (matchingTask) {
                currentTaskIds.push(Number(matchingTask.id))
              }
            }
          }
          if (currentTaskIds.length > 0) {
            await deleteGanttTask(currentTaskIds)
          }
          await loadData(projectId.value, { silent: true })
        },
      })
    }

    // 5. データリロード
    selectedTaskIds.value = []
    // 削除前に収集したrowId情報を使って通知（loadData後はタスクが消えているため）
    const affectedRowIds = [...new Set(deletedTasks.map((d) => Number(d.rowId)))]
    await loadData(projectId.value, { silent: true })
    const deletedNames = deletedTasks.map((d) => d.taskData.name).filter(Boolean)
    publishEditEvent('task_delete', {
      rowIds: affectedRowIds,
      targetName: deletedNames.length === 1 ? deletedNames[0] : `${deletedNames.length}件`,
    })
  }

  const deleteTask = async (taskId: string) => {
    isDialogVisible.value = false
    await execDeleteTasksWithAnimation([taskId])
  }

  const handleRowReordered = async (e: CustomEvent<moguchart.RowReorderEventDetail>) => {
    if (currentProject.value?.attribute?.disableRowReorder) return
    await maybeAutoSnapshot()

    setIsLoading(true)
    try {
      // Undo用に並び替え前の順序を保持
      const beforeOrder = rows.value.map((row, index) => ({
        id: Number(row.id),
        order: index + 1,
      }))

      const orderedRows = e.detail.rows.map((row, index) => ({
        id: Number(row.id),
        order: index + 1,
      }))
      await updateGanttRowOrder(orderedRows)
      // loadData() を呼ぶとローカルでの並べ替えと前後してちらつくため、ローカルデータを直接更新する
      rows.value = e.detail.rows
      publishEditEvent('row_reorder')

      pushAction({
        description: '行並び替え',
        undo: async () => {
          await updateGanttRowOrder(beforeOrder)
          await loadData(projectId.value, { silent: true })
        },
        redo: async () => {
          await updateGanttRowOrder(orderedRows)
          await loadData(projectId.value, { silent: true })
        },
      })
    } catch (err) {
      console.error('Failed to reorder rows:', err)
      alert({
        title: 'エラー',
        message: '行の並び順の更新に失敗しました。',
      })
      // エラーが発生した場合はサーバーの状態に戻す
      await loadData(projectId.value, { silent: true })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRowHeaderResize = (e: CustomEvent<moguchart.RowHeaderResizeEventDetail>) => {
    rowHeaderWidth.value = e.detail.width
  }

  // --- 行追加関連 ---
  const handleAddRow = async (index?: number, count: number = 1) => {
    await maybeAutoSnapshot()

    setIsLoading(true)
    try {
      const targetIndex = index ?? rows.value.length
      const newName = '新規行'
      const newRowIds: number[] = []

      // 指定された数だけ新規行を追加
      for (let i = 0; i < count; i++) {
        const newRowId = (await upsertGanttRow({
          id: 0,
          name: newName,
          order: targetIndex + 1 + i,
          projectId: projectId.value,
          visible: true,
          attribute: {},
          tasks: [],
        })) as number
        newRowIds.push(newRowId)
      }

      // 挿入位置に関わらず順序を更新して正規化する
      // (既存のorderが連番でない場合に意図しない位置に入るのを防ぐため)
      const currentRows = [...rows.value]
      const newRowStubs = newRowIds.map((id) => ({ id: String(id) }) as any)
      currentRows.splice(targetIndex, 0, ...newRowStubs)

      const orderedRows = currentRows.map((row, idx) => ({
        id: Number(row.id),
        order: idx + 1,
      }))

      await updateGanttRowOrder(orderedRows)

      // Undo/Redo記録
      pushAction({
        description: `行追加 (${count}件)`,
        undo: async () => {
          await deleteGanttRow(newRowIds)
          await loadData(projectId.value, { silent: true })
        },
        redo: async () => {
          // 再作成
          const reNewRowIds: number[] = []
          for (let i = 0; i < count; i++) {
            const id = (await upsertGanttRow({
              id: 0,
              name: newName,
              order: targetIndex + 1 + i,
              projectId: projectId.value,
              visible: true,
              attribute: {},
              tasks: [],
            })) as number
            reNewRowIds.push(id)
          }
          await loadData(projectId.value, { silent: true })
        },
      })

      await loadData(projectId.value, { silent: true })
      publishEditEvent('row_upsert', { targetName: newName, isNew: true })
      // 最後に追加した行の名前を編集状態にする
      const lastRowId = newRowIds[newRowIds.length - 1]
      if (lastRowId !== undefined) {
        startEditingRowByName(lastRowId, newName)
      }
    } catch (err) {
      console.error('Failed to add row:', err)
      alert({
        title: 'エラー',
        message: '行の追加に失敗しました。',
      })
    } finally {
      setIsLoading(false)
      closeContextMenu()
    }
  }

  const startEditingRowByName = async (rowId: number, name: string) => {
    await nextTick()
    // DOM描画完了を待つために少し遅延させる
    setTimeout(() => {
      // 名前を含む要素を探す (XPath)
      const xpath = `//div[text()="${name}"] | //span[text()="${name}"]`
      const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null)

      let target: HTMLElement | null = null
      if (result.snapshotLength > 0) {
        // 複数ヒットする場合は最後の要素を採用する（新規追加行はDOMの後方にある可能性が高いため）
        target = result.snapshotItem(result.snapshotLength - 1) as HTMLElement
      }

      if (target) {
        const targetRect = target.getBoundingClientRect()
        editingInputStyle.value = {
          top: `${targetRect.top}px`,
          left: `${targetRect.left}px`,
          width: `${Math.max(targetRect.width, 140)}px`,
          height: `${barHeight.value + barMargin.value * 2}px`,
        }
        editingRowId.value = rowId
        editingRowName.value = name

        setTimeout(() => {
          const input = document.getElementById('row-edit-input')
          if (input) {
            ;(input as HTMLInputElement).focus()
            ;(input as HTMLInputElement).select()
          }
        }, 0)
      }
    }, 100)
  }

  const updateRowName = async (rowId: number, name: string) => {
    const row = rows.value.find((r) => Number(r.id) === rowId)
    if (!row) return

    const attribute = (row as any).attribute as RowAttribute | undefined
    const beforeName = row.name

    await upsertGanttRow({
      id: rowId,
      name,
      order: (row as any).order ?? 0,
      projectId: projectId.value,
      visible: row.visible || true,
      attribute: attribute || {},
      tasks: [],
    })

    if (beforeName !== name) {
      pushAction({
        description: '行名変更',
        undo: async () => {
          await upsertGanttRow({
            id: rowId,
            name: beforeName,
            order: (row as any).order ?? 0,
            projectId: projectId.value,
            visible: row.visible || true,
            attribute: attribute || {},
            tasks: [],
          })
          await loadData(projectId.value, { silent: true })
        },
        redo: async () => {
          await upsertGanttRow({
            id: rowId,
            name,
            order: (row as any).order ?? 0,
            projectId: projectId.value,
            visible: row.visible || true,
            attribute: attribute || {},
            tasks: [],
          })
          await loadData(projectId.value, { silent: true })
        },
      })
    }

    await loadData(projectId.value, { silent: true })
    publishEditEvent('row_upsert', { targetName: name })
  }

  // --- Inline Row Editing ---
  const editingRowId = ref<number | null>(null)
  const editingRowName = ref('')
  const editingInputStyle = ref({
    top: '0px',
    left: '0px',
    width: '0px',
    height: '0px',
  })

  // --- Row Edit Dialog ---
  const isRowEditDialogVisible = ref(false)
  const editingRowData = ref<EditingRowData>({
    id: 0,
    name: '',
    description: '',
  })

  const handleEditRowFromContextMenu = async () => {
    const rowId = contextMenu.value.rowId
    if (rowId === null) return

    const row = rows.value.find((r) => Number(r.id) === rowId)
    if (!row) return

    const attribute = (row as any).attribute as RowAttribute | undefined

    closeContextMenu()
    await new Promise((resolve) => setTimeout(resolve, 200))

    editingRowData.value = {
      id: rowId,
      name: row.name,
      description: attribute?.description || '',
      labels: attribute?.labels ? attribute.labels.map((l) => ({ ...l })) : [],
    }
    isRowEditDialogVisible.value = true
  }

  const saveRow = async (data: {
    id: number
    name: string
    description?: string
    labels?: import('@functions/types/shared').Label[]
  }) => {
    await maybeAutoSnapshot()

    const row = rows.value.find((r) => Number(r.id) === data.id)
    if (!row) return

    const beforeName = row.name
    const beforeAttr = (row as any).attribute as RowAttribute | undefined
    const beforeDescription = beforeAttr?.description || ''
    const beforeLabels = JSON.stringify(beforeAttr?.labels || [])

    await upsertGanttRow({
      id: data.id,
      name: data.name,
      order: (row as any).order ?? 0,
      projectId: projectId.value,
      visible: row.visible || true,
      attribute: {
        ...((row as any).attribute || {}),
        description: data.description || undefined,
        labels: data.labels && data.labels.length > 0 ? data.labels : undefined,
      },
      tasks: [],
    })

    if (
      beforeName !== data.name ||
      beforeDescription !== (data.description || '') ||
      beforeLabels !== JSON.stringify(data.labels || [])
    ) {
      pushAction({
        description: '行編集',
        undo: async () => {
          await upsertGanttRow({
            id: data.id,
            name: beforeName,
            order: (row as any).order ?? 0,
            projectId: projectId.value,
            visible: row.visible || true,
            attribute: {
              ...((row as any).attribute || {}),
              description: beforeDescription || undefined,
              labels: beforeAttr?.labels && beforeAttr.labels.length > 0 ? beforeAttr.labels : undefined,
            },
            tasks: [],
          })
          await loadData(projectId.value, { silent: true })
        },
        redo: async () => {
          await upsertGanttRow({
            id: data.id,
            name: data.name,
            order: (row as any).order ?? 0,
            projectId: projectId.value,
            visible: row.visible || true,
            attribute: {
              ...((row as any).attribute || {}),
              description: data.description || undefined,
              labels: data.labels && data.labels.length > 0 ? data.labels : undefined,
            },
            tasks: [],
          })
          await loadData(projectId.value, { silent: true })
        },
      })
    }

    isRowEditDialogVisible.value = false
    await loadData(projectId.value, { silent: true })
    publishEditEvent('row_upsert', { targetName: data.name })
  }

  const handleRowHeaderDblClick = (e: CustomEvent<moguchart.RowHeaderDblClickEventDetail>) => {
    if (isReadOnly.value) return
    if (editingRowId.value !== null) return // Already editing

    const { row, target, event } = e.detail
    if (!row) return

    if (event.shiftKey) {
      editingRowId.value = Number(row.id)
      editingRowName.value = row.name

      if (target) {
        const targetRect = (target as HTMLElement).getBoundingClientRect()

        // Use fixed positioning relative to the viewport
        editingInputStyle.value = {
          top: `${targetRect.top}px`,
          left: `${targetRect.left}px`,
          // Ensure minimum dimensions for better UX
          width: `${Math.max(targetRect.width, 140)}px`,
          height: `${Math.min(barHeight.value, 30)}px`,
        }

        // Focus the input next tick
        setTimeout(() => {
          const input = document.getElementById('row-edit-input')
          if (input) (input as HTMLInputElement).focus()
        }, 0)
      }
    } else {
      const r = rows.value.find((r) => Number(r.id) === Number(row.id))
      if (!r) return
      const attribute = (r as any).attribute as RowAttribute | undefined

      editingRowData.value = {
        id: Number(row.id),
        name: r.name,
        description: attribute?.description || '',
        labels: attribute?.labels ? attribute.labels.map((l) => ({ ...l })) : [],
      }
      isRowEditDialogVisible.value = true
    }
  }

  const handleRowNameUpdate = async (e?: KeyboardEvent) => {
    if (e?.isComposing) return

    if (editingRowId.value !== null && editingRowName.value.trim() !== '') {
      await updateRowName(editingRowId.value, editingRowName.value)
    }
    editingRowId.value = null
  }

  const cancelRowNameUpdate = (e?: KeyboardEvent) => {
    if (e?.isComposing) return
    editingRowId.value = null
  }

  // --- コンテキストメニュー関連 ---
  const contextMenu = ref({
    visible: false,
    x: 0,
    y: 0,
    rowId: null as number | null,
    isHidden: false,
  })

  // --- タスクコンテキストメニュー関連 ---
  const taskContextMenu = ref({
    visible: false,
    x: 0,
    y: 0,
    taskId: null as string | null,
  })

  const handleTaskContextMenu = (e: CustomEvent<moguchart.TaskContextMenuEventDetail>) => {
    const { task, event } = e.detail
    event.preventDefault()

    if (isReadOnly.value) return

    taskContextMenu.value = {
      visible: true,
      x: event.clientX,
      y: event.clientY,
      taskId: String(task.id),
    }
  }

  /** コンテキストメニュー対象のタスク群にロック済みのものが含まれているか */
  const hasLockedTaskInContextMenu = computed(() => {
    const menuTaskId = taskContextMenu.value.taskId
    if (!menuTaskId) return false

    // 複数選択中の場合は選択中のタスクをすべてチェック
    const targetIds =
      selectedTaskIds.value.includes(menuTaskId) && selectedTaskIds.value.length > 1
        ? selectedTaskIds.value
        : [menuTaskId]

    return targetIds.some((taskId) => {
      const row = rows.value.find((r) => r.tasks.some((t) => t.id === taskId))
      const task = row?.tasks.find((t) => t.id === taskId)
      const attr = (task as any)?.attribute as TaskAttribute | undefined
      return attr?.lock === true
    })
  })

  const handleEditTaskFromContextMenu = async () => {
    const taskId = taskContextMenu.value.taskId
    if (!taskId) return

    taskContextMenu.value.visible = false
    await new Promise((resolve) => setTimeout(resolve, 200))
    startEditingTask(taskId)
  }

  // --- 画像ダイアログ関連 ---
  const isImageDialogVisible = ref(false)
  const imageDialogTaskId = ref<string | null>(null)
  const imageDialogTargetType = ref<'task' | 'row'>('task')
  const imageDialogImageUrls = ref<string[]>([])

  const handleImageFromContextMenu = async () => {
    const taskId = taskContextMenu.value.taskId
    if (!taskId) return

    const row = rows.value.find((r) => r.tasks.some((t) => t.id === taskId))
    const task = row?.tasks.find((t) => t.id === taskId)
    const taskAttr = (task as any)?.attribute as TaskAttribute | undefined

    taskContextMenu.value.visible = false
    await new Promise((resolve) => setTimeout(resolve, 200))

    imageDialogTaskId.value = taskId
    imageDialogTargetType.value = 'task'
    imageDialogImageUrls.value = taskAttr?.imageUrls ? [...taskAttr.imageUrls] : []
    isImageDialogVisible.value = true
  }

  const handleImageFromRowContextMenu = async () => {
    const rowId = contextMenu.value.rowId
    if (rowId === null) return

    const row = rows.value.find((r) => Number(r.id) === rowId)
    if (!row) return

    const rowAttr = (row as any).attribute as RowAttribute | undefined

    contextMenu.value.visible = false
    await new Promise((resolve) => setTimeout(resolve, 200))

    imageDialogTaskId.value = String(rowId)
    imageDialogTargetType.value = 'row'
    imageDialogImageUrls.value = rowAttr?.imageUrls ? [...rowAttr.imageUrls] : []
    isImageDialogVisible.value = true
  }

  const handleSaveTaskImages = async (imageUrls: string[]) => {
    const taskId = imageDialogTaskId.value
    if (!taskId) return

    const row = rows.value.find((r) => r.tasks.some((t) => t.id === taskId))
    const task = row?.tasks.find((t) => t.id === taskId)
    if (!row || !task) return

    const taskWithAttr = task as unknown as { attribute?: TaskAttribute }
    const existingAttr = taskWithAttr.attribute || ({} as TaskAttribute)

    const data = {
      id: Number(taskId),
      rowId: Number(row.id),
      name: task.name || '',
      start: toDateTimeString(task.start),
      end: toDateTimeString(task.end),
      attribute: {
        ...existingAttr,
        imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
      },
    }

    await upsertGanttTasks([data])
    await loadData(projectId.value, { silent: true })
  }

  const handleSaveRowImages = async (imageUrls: string[]) => {
    const rowId = imageDialogTaskId.value
    if (!rowId) return

    const row = rows.value.find((r) => String(r.id) === rowId)
    if (!row) return

    const rowAttr = (row as any).attribute as RowAttribute | undefined

    await upsertGanttRow({
      id: Number(rowId),
      name: row.name,
      order: (row as any).order ?? 0,
      projectId: projectId.value,
      visible: row.visible || true,
      attribute: {
        ...((row as any).attribute || {}),
        imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
      },
      tasks: [],
    })

    await loadData(projectId.value, { silent: true })
    publishEditEvent('row_upsert', { targetName: row.name })
  }

  const handleSaveImages = async (imageUrls: string[]) => {
    if (imageDialogTargetType.value === 'row') {
      await handleSaveRowImages(imageUrls)
    } else {
      await handleSaveTaskImages(imageUrls)
    }
  }

  const confirmAndDeleteTasks = async (taskIds: string[]) => {
    if (taskIds.length === 0) return

    if (taskIds.length > 1) {
      const result = await confirm({
        title: 'タスク削除の確認',
        message: `選択された<b>${taskIds.length}件</b>のタスクを削除してもよろしいですか？`,
        confirmText: '削除',
        confirmColor: 'error',
      })

      if (result) {
        setIsLoading(true)
        try {
          await execDeleteTasksWithAnimation(taskIds)
        } catch (err) {
          console.error('Failed to delete tasks:', err)
          alert({
            title: 'エラー',
            message: 'タスクの削除に失敗しました。',
          })
        } finally {
          setIsLoading(false)
        }
      }
    } else {
      const taskId = taskIds[0]
      if (!taskId) return
      const row = rows.value.find((r) => r.tasks.some((t) => t.id === taskId))
      const task = row?.tasks.find((t) => t.id === taskId)
      const taskName = task?.name || '選択したタスク'

      const result = await confirm({
        title: 'タスク削除の確認',
        message: `「<b>${taskName}</b>」を削除してもよろしいですか？`,
        confirmText: '削除',
        confirmColor: 'error',
      })

      if (result) {
        await deleteTask(taskId)
      }
    }
  }

  const handleDeleteTaskFromContextMenu = async () => {
    const taskId = taskContextMenu.value.taskId
    if (!taskId) return

    taskContextMenu.value.visible = false

    const isMultiSelect = selectedTaskIds.value.includes(taskId) && selectedTaskIds.value.length > 1
    const taskIdsToDelete = isMultiSelect ? selectedTaskIds.value : [taskId]

    await confirmAndDeleteTasks(taskIdsToDelete)
  }

  /**
   * moguchart-core の task-delete イベントハンドラー。
   * Delete / Backspace キー押下時に発火される。
   */
  const handleTaskDelete = async (e: CustomEvent<moguchart.TaskDeleteEventDetail>) => {
    if (isReadOnly.value) return
    await confirmAndDeleteTasks(e.detail.taskIds)
  }

  // --- コメントダイアログ関連 ---
  const isCommentDialogVisible = ref(false)
  const commentDialogTaskId = ref<number | null>(null)
  const commentDialogRowId = ref<number | null>(null)
  const commentDialogProjectId = ref<string | null>(null)
  const commentDialogTargetName = ref('')

  const handleAddCommentFromContextMenu = async () => {
    const taskId = taskContextMenu.value.taskId
    if (!taskId) return

    const row = rows.value.find((r) => r.tasks.some((t) => t.id === taskId))
    const task = row?.tasks.find((t) => t.id === taskId)

    taskContextMenu.value.visible = false
    await new Promise((resolve) => setTimeout(resolve, 200))

    commentDialogTaskId.value = Number(taskId)
    commentDialogRowId.value = null
    commentDialogProjectId.value = null
    commentDialogTargetName.value = task?.name || ''
    isCommentDialogVisible.value = true
  }

  const handleAddCommentToRow = async () => {
    const rowId = contextMenu.value.rowId
    if (rowId === null) return

    const row = rows.value.find((r) => Number(r.id) === rowId)

    contextMenu.value.visible = false
    await new Promise((resolve) => setTimeout(resolve, 200))

    commentDialogTaskId.value = null
    commentDialogRowId.value = rowId
    commentDialogProjectId.value = null
    commentDialogTargetName.value = row?.name || `行 #${rowId}`
    isCommentDialogVisible.value = true
  }

  const handleAddCommentToProject = () => {
    if (!projectId.value || !currentProject.value) return

    commentDialogTaskId.value = null
    commentDialogRowId.value = null
    commentDialogProjectId.value = projectId.value
    commentDialogTargetName.value = currentProject.value.name
    isCommentDialogVisible.value = true
  }

  // プロジェクトコメントツールチップ用
  const projectComments = ref<Comment[]>([])
  const isProjectCommentsLoading = ref(false)
  let projectCommentsFetchedAt = 0

  const fetchProjectComments = async () => {
    if (!projectId.value) return
    // 1分以内の再取得を防止
    if (Date.now() - projectCommentsFetchedAt < 60000 && projectComments.value.length > 0) return
    isProjectCommentsLoading.value = true
    try {
      const comments = await selectComments({ projectId: projectId.value })
      projectComments.value = comments
      projectCommentsFetchedAt = Date.now()
    } catch (e) {
      console.error('Failed to load project comments', e)
    } finally {
      isProjectCommentsLoading.value = false
    }
  }

  const invalidateProjectCommentsCache = () => {
    projectCommentsFetchedAt = 0
    projectComments.value = []
  }

  const handleCommentUpdated = async () => {
    // コメント件数を反映するためにデータをリロード
    invalidateProjectCommentsCache()
    if (projectId.value) {
      const rowIds: number[] = []
      if (commentDialogTaskId.value) {
        const row = rows.value.find((r) => r.tasks.some((t) => Number(t.id) === commentDialogTaskId.value))
        if (row) rowIds.push(Number(row.id))
      } else if (commentDialogRowId.value) {
        rowIds.push(commentDialogRowId.value)
      }
      await loadData(projectId.value, { silent: true })

      // プロジェクトのcommentCountを最新に更新
      if (commentDialogProjectId.value) {
        try {
          const comments = await selectComments({ projectId: projectId.value })
          const project = projects.value.find((p) => p.id === projectId.value)
          if (project) {
            project.commentCount = comments.length
          }
          projectComments.value = comments
          projectCommentsFetchedAt = Date.now()
        } catch (e) {
          console.error('Failed to update project comment count', e)
        }
      }

      // Firestoreはundefined値を受け付けないため、値がある場合のみpayloadに含める
      const payload: Record<string, any> = {
        targetName: commentDialogTargetName.value,
        commentTarget: commentDialogTaskId.value ? 'task' : commentDialogRowId.value ? 'row' : 'project',
      }
      if (rowIds.length > 0) payload.rowIds = rowIds
      if (commentDialogTaskId.value) payload.taskId = String(commentDialogTaskId.value)
      if (commentDialogRowId.value) payload.rowId = String(commentDialogRowId.value)

      publishEditEvent('comment_update', payload)
    }
  }

  /** プロジェクトコメントサイドバーからの更新ハンドラ（ダイアログ状態に依存しない） */
  const handleProjectCommentPanelUpdated = async () => {
    invalidateProjectCommentsCache()
    if (!projectId.value) return

    try {
      const comments = await selectComments({ projectId: projectId.value })
      const project = projects.value.find((p) => p.id === projectId.value)
      if (project) {
        project.commentCount = comments.length
      }
      projectComments.value = comments
      projectCommentsFetchedAt = Date.now()
    } catch (e) {
      console.error('Failed to update project comment count', e)
    }

    publishEditEvent('comment_update', {
      targetName: currentProject.value?.name || '',
      commentTarget: 'project',
    })
  }

  const handleRowHeaderContextMenu = (e: CustomEvent<moguchart.RowHeaderContextMenuEventDetail>) => {
    e.preventDefault()
    if (isReadOnly.value) return
    const { row, event } = e.detail
    if (!row) return

    contextMenu.value = {
      visible: true,
      x: event.clientX,
      y: event.clientY,
      rowId: Number(row.id),
      isHidden: !(row.visible ?? true),
    }
  }

  const closeContextMenu = () => {
    contextMenu.value.visible = false
  }

  const getSelectedRowCount = (): number => {
    if (contextMenu.value.rowId === null) return 1
    const targetRowIdStr = String(contextMenu.value.rowId)
    if (selectedRowIds.value.includes(targetRowIdStr) && selectedRowIds.value.length > 1) {
      // 選択行が連続しているかチェック
      const selectedIndices = selectedRowIds.value
        .map((id) => rows.value.findIndex((r) => r.id === id))
        .filter((i) => i !== -1)
        .sort((a, b) => a - b)

      const isContiguous = selectedIndices.every((val, i) => i === 0 || val === selectedIndices[i - 1]! + 1)
      if (isContiguous) {
        return selectedRowIds.value.length
      }
    }
    return 1
  }

  const addRowCount = computed(() => {
    if (contextMenu.value.rowId === null) return 1
    const targetRowIdStr = String(contextMenu.value.rowId)
    if (selectedRowIds.value.includes(targetRowIdStr) && selectedRowIds.value.length > 1) {
      const selectedIndices = selectedRowIds.value
        .map((id) => rows.value.findIndex((r) => r.id === id))
        .filter((i) => i !== -1)
        .sort((a, b) => a - b)

      const isContiguous = selectedIndices.every((val, i) => i === 0 || val === selectedIndices[i - 1]! + 1)
      if (isContiguous) {
        return selectedRowIds.value.length
      }
    }
    return 1
  })

  const handleAddRowAbove = async () => {
    if (contextMenu.value.rowId === null) return
    const count = getSelectedRowCount()

    if (count > 1) {
      // 複数選択時は選択行ブロックの最上部に挿入
      const selectedIndices = selectedRowIds.value
        .map((id) => rows.value.findIndex((r) => r.id === id))
        .filter((i) => i !== -1)
      const minIndex = Math.min(...selectedIndices)
      await handleAddRow(minIndex, count)
    } else {
      const index = rows.value.findIndex((r) => Number(r.id) === contextMenu.value.rowId)
      if (index !== -1) {
        await handleAddRow(index, 1)
      }
    }
  }

  const handleAddRowBelow = async () => {
    if (contextMenu.value.rowId === null) return
    const count = getSelectedRowCount()

    if (count > 1) {
      // 複数選択時は選択行ブロックの最下部の下に挿入
      const selectedIndices = selectedRowIds.value
        .map((id) => rows.value.findIndex((r) => r.id === id))
        .filter((i) => i !== -1)
      const maxIndex = Math.max(...selectedIndices)
      await handleAddRow(maxIndex + 1, count)
    } else {
      const index = rows.value.findIndex((r) => Number(r.id) === contextMenu.value.rowId)
      if (index !== -1) {
        await handleAddRow(index + 1, 1)
      }
    }
  }

  const toggleRowVisibility = async () => {
    const rowId = contextMenu.value.rowId
    if (rowId === null) return

    const targetRowIdStr = String(rowId)
    const isMultiSelect = selectedRowIds.value.includes(targetRowIdStr) && selectedRowIds.value.length > 1

    const targetRows = isMultiSelect
      ? rows.value.filter((r) => selectedRowIds.value.includes(String(r.id)))
      : rows.value.filter((r) => Number(r.id) === rowId)

    if (targetRows.length === 0) return

    // 右クリックされた行の状態を基準にする（反転させる）
    const baseRow = rows.value.find((r) => Number(r.id) === rowId) ?? targetRows[0]

    if (!baseRow) return
    const newVisible = !(baseRow.visible ?? true)
    const oldVisible = baseRow.visible ?? true

    try {
      const rowUpdateData = targetRows.map((row) => ({
        id: Number(row.id),
        name: row.name,
        order: (row as any).order ?? 0,
        projectId: projectId.value,
        visible: newVisible,
        attribute: (row as any).attribute || {},
        tasks: [],
      }))

      // 一括更新
      await upsertGanttRow(rowUpdateData)

      pushAction({
        description: '行表示切り替え',
        undo: async () => {
          await upsertGanttRow(
            targetRows.map((row) => ({
              id: Number(row.id),
              name: row.name,
              order: (row as any).order ?? 0,
              projectId: projectId.value,
              visible: oldVisible,
              attribute: (row as any).attribute || {},
              tasks: [],
            })),
          )
          await loadData(projectId.value, { silent: true })
        },
        redo: async () => {
          await upsertGanttRow(rowUpdateData)
          await loadData(projectId.value, { silent: true })
        },
      })

      await loadData(projectId.value, { silent: true })
      closeContextMenu()
      publishEditEvent('row_upsert', { targetName: baseRow.name })
    } catch (err) {
      console.error('Failed to toggle row visibility:', err)
      alert({
        title: 'エラー',
        message: '行の表示切り替えに失敗しました。',
      })
    }
  }

  // --- 行削除関連 ---

  const deleteRow = async (rowIds: string[]) => {
    await maybeAutoSnapshot()

    // Undo用に削除前の行データ（タスク含む）を保持
    const deletedRowsData = rowIds
      .map((rowId) => {
        const row = rows.value.find((r) => String(r.id) === rowId)
        if (!row) return null
        const attr = (row as any).attribute as RowAttribute | undefined
        return {
          id: Number(row.id),
          name: row.name,
          order: (row as any).order ?? 0,
          projectId: projectId.value,
          visible: row.visible ?? true,
          attribute: attr ? { ...attr } : {},
          tasks: row.tasks.map((t) => {
            const tAttr = (t as any).attribute as TaskAttribute | undefined
            return {
              id: Number(t.id), // Undo時は元のIDで復元
              rowId: Number(row.id), // 復元後に設定
              name: t.name || '',
              start: toDateTimeString(t.start),
              end: toDateTimeString(t.end),
              attribute: tAttr ? { ...tAttr } : {},
            }
          }),
        }
      })
      .filter(Boolean) as any[]

    await deleteGanttRow(rowIds.map(Number))

    // 行に含まれるタスクの画像と行自体の画像を Storage から削除
    const imageUrlsToDelete = deletedRowsData
      .flatMap((rd: any) => [
        ...((rd.attribute?.imageUrls as string[] | undefined) ?? []),
        ...(rd.tasks as any[]).flatMap(
          (t: any) => (t.attribute?.imageUrls as string[] | undefined) ?? [],
        ),
      ])
      .filter(Boolean)
    if (imageUrlsToDelete.length > 0) {
      deleteImagesFromStorage(imageUrlsToDelete) // 非同期で実行
    }

    if (deletedRowsData.length > 0) {
      pushAction({
        description: `行削除 (${deletedRowsData.length}件)`,
        undo: async () => {
          // 行を再作成
          for (const rowData of deletedRowsData) {
            const tasks = rowData.tasks
            const newRowId = (await upsertGanttRow({
              id: rowData.id, // 元のIDで復元
              name: rowData.name,
              order: rowData.order,
              projectId: rowData.projectId,
              visible: rowData.visible,
              attribute: rowData.attribute,
              tasks: [],
            })) as number
            // タスクも復元
            if (tasks.length > 0) {
              await upsertGanttTasks(tasks.map((t: any) => ({ ...t, rowId: newRowId })))
            }
          }
          await loadData(projectId.value, { silent: true })
        },
        redo: async () => {
          // 再度削除（現在のrowsから該当する行を検索して削除）
          const currentRowIds: number[] = []
          for (const rd of deletedRowsData) {
            const match = rows.value.find((r) => r.name === rd.name && (r as any).order === rd.order)
            if (match) currentRowIds.push(Number(match.id))
          }
          if (currentRowIds.length > 0) {
            await deleteGanttRow(currentRowIds)
          }
          await loadData(projectId.value, { silent: true })
        },
      })
    }

    await loadData(projectId.value, { silent: true })
    const deletedRowNames = deletedRowsData.map((d: any) => d.name).filter(Boolean)
    publishEditEvent('row_delete', {
      targetName: deletedRowNames.length === 1 ? deletedRowNames[0] : `${deletedRowNames.length}件`,
    })
  }

  const handleDeleteRowFromContextMenu = async () => {
    const rowId = contextMenu.value.rowId
    if (rowId === null) return

    closeContextMenu()

    const targetRowIdStr = String(rowId)
    const isMultiSelect = selectedRowIds.value.includes(targetRowIdStr) && selectedRowIds.value.length > 1

    if (isMultiSelect) {
      const count = selectedRowIds.value.length
      const result = await confirm({
        title: '行削除の確認',
        message: `選択された<b>${count}件</b>の行を削除してもよろしいですか？<br>含まれるタスクもすべて削除されます。`,
        confirmText: '削除',
        confirmColor: 'error',
      })

      if (result) {
        setIsLoading(true)
        try {
          await deleteRow(selectedRowIds.value) // 一括削除
          selectedRowIds.value = [] // 選択解除
        } catch (err) {
          console.error('Failed to delete rows:', err)
          alert({
            title: 'エラー',
            message: '行の削除に失敗しました。',
          })
        } finally {
          setIsLoading(false)
        }
      }
    } else {
      const targetRow = rows.value.find((r) => Number(r.id) === rowId)
      const rowName = targetRow ? targetRow.name : '選択した行'

      const result = await confirm({
        title: '行削除の確認',
        message: `「<b>${rowName}</b>」を削除してもよろしいですか？<br>含まれるタスクもすべて削除されます。`,
        confirmText: '削除',
        confirmColor: 'error',
      })

      if (result) {
        await deleteRow([String(rowId)])
      }
    }
  }

  // --- プロジェクト追加/編集関連 ---
  const isProjectListDialogVisible = ref(false)

  const handleRowSelectionChange = (e: CustomEvent<moguchart.RowSelectionChangeEventDetail>) => {
    selectedRowIds.value = e.detail.selectedIds
  }

  const handleBarSelectionChange = (e: CustomEvent<moguchart.BarSelectionChangeEventDetail>) => {
    selectedTaskIds.value = e.detail.selectedIds
  }

  // --- Chart Context Menu ---
  const chartContextMenu = ref({
    visible: false,
    x: 0,
    y: 0,
    date: undefined as Date | undefined,
    rowId: undefined as string | undefined,
  })

  const handleChartContextMenu = (e: CustomEvent<moguchart.ChartContextMenuEventDetail>) => {
    if (isReadOnly.value) return
    const { event, date, rowId } = e.detail
    // event.preventDefault() は gantt-chart 側で行われている

    chartContextMenu.value = {
      visible: true,
      x: event.clientX,
      y: event.clientY,
      date,
      rowId,
    }
  }

  // --- コピー＆ペースト ---
  const CLIPBOARD_PREFIX = 'moguchart:tasks:'

  interface ClipboardTaskData {
    name: string
    durationDays: number
    description?: string
    colorPalette?: ColorPalette
    labels?: Label[]
  }

  const copySelectedTasks = async () => {
    const targetTaskIds =
      selectedTaskIds.value.length > 0
        ? selectedTaskIds.value
        : taskContextMenu.value.taskId
          ? [taskContextMenu.value.taskId]
          : []
    if (targetTaskIds.length === 0) return

    const clipboardData: ClipboardTaskData[] = []

    for (const taskId of targetTaskIds) {
      const row = rows.value.find((r) => r.tasks.some((t) => t.id === taskId))
      const task = row?.tasks.find((t) => t.id === taskId)
      if (task) {
        const startDate = task.start instanceof Date ? task.start : new Date(task.start)
        const endDate = task.end instanceof Date ? task.end : new Date(task.end)
        const durationDays = Math.round((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000))
        const attr = (task as any).attribute as TaskAttribute | undefined
        clipboardData.push({
          name: task.name || '',
          durationDays,
          description: attr?.description,
          colorPalette: attr?.colorPalette ? { ...attr.colorPalette } : undefined,
          labels: attr?.labels ? [...attr.labels] : undefined,
        })
      }
    }

    if (clipboardData.length === 0) return

    try {
      await navigator.clipboard.writeText(CLIPBOARD_PREFIX + JSON.stringify(clipboardData))
      hasClipboardData.value = true
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
    }
  }

  const pasteTasks = async (date: Date, rowId: string) => {
    if (isReadOnly.value) return

    let clipboardText: string
    try {
      clipboardText = await navigator.clipboard.readText()
    } catch (err) {
      console.error('Failed to read clipboard:', err)
      return
    }

    if (!clipboardText.startsWith(CLIPBOARD_PREFIX)) return

    let tasksData: ClipboardTaskData[]
    try {
      tasksData = JSON.parse(clipboardText.slice(CLIPBOARD_PREFIX.length))
    } catch {
      return
    }

    if (!Array.isArray(tasksData) || tasksData.length === 0) return

    await maybeAutoSnapshot()

    const upsertDataList = tasksData.map((t) => {
      const startDate = new Date(date)
      const endDate = new Date(startDate.getTime() + t.durationDays * 24 * 60 * 60 * 1000)
      return {
        id: 0,
        rowId: Number(rowId),
        name: t.name,
        start: toDateTimeString(startDate),
        end: toDateTimeString(endDate),
        attribute: {
          description: t.description,
          colorPalette: t.colorPalette,
          labels: t.labels,
        },
      }
    })

    const result = await upsertGanttTasks(upsertDataList)
    const newTaskIds = result as number[]

    pushAction({
      description: 'タスク貼り付け',
      undo: async () => {
        await deleteGanttTask(newTaskIds)
        await loadData(projectId.value, { silent: true })
      },
      redo: async () => {
        await upsertGanttTasks(upsertDataList.map((d) => ({ ...d, id: 0 })))
        await loadData(projectId.value, { silent: true })
      },
    })

    await loadData(projectId.value, { silent: true })
    publishEditEvent('task_upsert', {
      rowIds: [Number(rowId)],
      targetName: tasksData.length === 1 ? (tasksData[0]?.name ?? 'タスク') : `${tasksData.length}件のタスク`,
      isNew: true,
      taskId: String(newTaskIds?.[0] ?? ''),
    })
  }

  const handleCopyTasksFromContextMenu = async () => {
    await copySelectedTasks()
    taskContextMenu.value.visible = false
  }

  const handlePasteTasksFromContextMenu = async () => {
    const { date, rowId } = chartContextMenu.value
    if (!date || !rowId) return
    chartContextMenu.value.visible = false
    await pasteTasks(date, rowId)
  }

  // クリップボードにデータがあるかどうかを追跡するフラグ
  const hasClipboardData = ref(false)

  // クリップボードの状態を確認
  const checkClipboardData = async () => {
    try {
      const text = await navigator.clipboard.readText()
      hasClipboardData.value = text.startsWith(CLIPBOARD_PREFIX)
    } catch {
      hasClipboardData.value = false
    }
  }

  // キーボードショートカット: コピー
  const handleCopyTasksShortcut = async () => {
    await copySelectedTasks()
  }

  // キーボードショートカット: ペースト（マウス位置からhitTestで日時・行を取得）
  const handlePasteTasksShortcut = async (e: KeyboardEvent) => {
    if (isReadOnly.value) return

    // クリップボードを確認
    let text: string
    try {
      text = await navigator.clipboard.readText()
    } catch {
      return
    }

    if (!text.startsWith(CLIPBOARD_PREFIX)) return

    // ganttChartRef が存在し hitTest が使える場合、最後のマウス位置で判定
    const chart = ganttChartRef.value
    if (!chart) return

    // hitTest を使ってマウスカーソル下の行と日付を取得
    const hitResult = chart.hitTest(lastMouseX.value, lastMouseY.value)
    if (!hitResult) return

    await pasteTasks(hitResult.date, hitResult.rowId)
  }

  // マウス位置の追跡
  const lastMouseX = ref(0)
  const lastMouseY = ref(0)
  const handleMouseMove = (e: MouseEvent) => {
    lastMouseX.value = e.clientX
    lastMouseY.value = e.clientY
  }

  // mousemoveとfocusのイベントリスナー
  if (typeof window !== 'undefined') {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('focus', checkClipboardData)
  }

  const handleCreateNewTask = async (date: Date, rowId: string) => {
    chartContextMenu.value.visible = false
    await new Promise((resolve) => setTimeout(resolve, 200))

    const isMonthly = currentProject.value?.attribute?.granularity === 'monthly'
    const isHourly = currentProject.value?.attribute?.granularity === 'hourly'

    editingTask.value = {
      id: '', // 新規作成
      rowId: rowId,
      name: '新規タスク',
      start: isMonthly
        ? dayjs(date).startOf('month').format('YYYY-MM-DD')
        : isHourly
          ? dayjs(date).format('YYYY-MM-DD HH:00:00')
          : toDateString(date),
      end: isMonthly
        ? dayjs(date).startOf('month').add(3, 'month').format('YYYY-MM-DD') // デフォルト3ヶ月分
        : isHourly
          ? dayjs(date).add(2, 'hour').format('YYYY-MM-DD HH:00:00') // デフォルト2時間
          : toDateString(new Date(date.getTime() + 2 * 24 * 60 * 60 * 1000)), // デフォルト2日
      description: '',
      progress: undefined,
      labels: [],
    }
    isDialogVisible.value = true
  }

  // --- マーカー操作 ---

  /**
   * コンテキストメニューの「新規マーカー」からマーカーフォームダイアログを開く
   */
  const handleCreateNewMarker = async (date: Date, rowId: string) => {
    chartContextMenu.value.visible = false
    await new Promise((resolve) => setTimeout(resolve, 200))

    const isMonthly = currentProject.value?.attribute?.granularity === 'monthly'
    const isHourly = currentProject.value?.attribute?.granularity === 'hourly'

    editingMarker.value = null
    editingMarkerRowId.value = rowId
    editingMarkerDefaultDate.value = isMonthly
      ? dayjs(date).startOf('month').format('YYYY-MM-DD')
      : isHourly
        ? dayjs(date).format('YYYY-MM-DD')
        : toDateString(date)
    isMarkerDialogVisible.value = true
  }

  /**
   * マーカーダブルクリック時に既存マーカーの編集ダイアログを開く
   */
  const handleMarkerDblClick = (e: CustomEvent<moguchart.MarkerDblClickEventDetail>) => {
    if (isReadOnly.value) return
    const { marker, rowId } = e.detail

    // moguchart.GanttMarker → MarkerAttribute に変換
    const markerAttr: MarkerAttribute = {
      id: marker.id,
      name: marker.name,
      date: toDateTimeString(marker.date instanceof Date ? marker.date : new Date(marker.date)).slice(0, 16),
      anchor: marker.anchor as MarkerAttribute['anchor'],
      type: marker.type as MarkerAttribute['type'],
      color: marker.color,
      fontSize: marker.fontSize,
    }

    editingMarker.value = markerAttr
    editingMarkerRowId.value = String(rowId)
    editingMarkerDefaultDate.value = undefined
    isMarkerDialogVisible.value = true
  }

  // --- マーカーコンテキストメニュー関連 ---
  const markerContextMenu = ref({
    visible: false,
    x: 0,
    y: 0,
    markerId: null as string | null,
    rowId: null as string | null,
  })

  /**
   * マーカー右クリック時にコンテキストメニューを表示
   */
  const handleMarkerContextMenu = (e: CustomEvent<moguchart.MarkerContextMenuEventDetail>) => {
    const { marker, rowId, event } = e.detail
    event.preventDefault()

    markerContextMenu.value = {
      visible: true,
      x: event.clientX,
      y: event.clientY,
      markerId: marker.id,
      rowId: String(rowId),
    }
  }

  /**
   * マーカーコンテキストメニューの「編集」
   */
  const handleEditMarkerFromContextMenu = () => {
    const { markerId, rowId } = markerContextMenu.value
    markerContextMenu.value.visible = false
    if (!markerId || !rowId) return

    const row = rows.value.find((r) => String(r.id) === rowId)
    if (!row) return

    const rowAttr = (row as any).attribute as RowAttribute | undefined
    const found = rowAttr?.markers?.find((m) => m.id === markerId)
    if (!found) return

    // moguchart.GanttMarker → MarkerAttribute に変換（dblclick と同ロジック）
    editingMarker.value = {
      ...found,
      date: found.date.length <= 10 ? found.date : found.date.replace(' ', 'T').slice(0, 16),
    }
    editingMarkerRowId.value = rowId
    editingMarkerDefaultDate.value = undefined
    isMarkerDialogVisible.value = true
  }

  /**
   * マーカーコンテキストメニューの「削除」
   */
  const handleDeleteMarkerFromContextMenu = async () => {
    const { markerId, rowId } = markerContextMenu.value
    markerContextMenu.value.visible = false
    if (!markerId || !rowId) return

    const result = await confirm({
      title: 'マーカーの削除',
      message: 'このマーカーを削除しますか？',
      confirmText: '削除',
      confirmColor: 'error',
    })
    if (!result) return

    // deleteMarker が editingMarkerRowId を使うため、事前にセット
    editingMarkerRowId.value = rowId
    deleteMarker(markerId)
  }

  /**
   * マーカーの保存（新規作成・更新共通）
   */
  const saveMarker = async (markerData: MarkerAttribute) => {
    // ダイアログを先に閉じてから非同期処理を行う（v-if競合防止）
    isMarkerDialogVisible.value = false

    if (!editingMarkerRowId.value || !projectId.value) return

    const rowIdNum = Number(editingMarkerRowId.value)
    const row = rows.value.find((r) => Number(r.id) === rowIdNum)
    if (!row) return

    const rowAttr = (row as any).attribute as RowAttribute | undefined
    const beforeMarkers = rowAttr?.markers ? [...rowAttr.markers] : []

    // 新規作成の場合はIDを生成
    const marker: MarkerAttribute = {
      ...markerData,
      id: markerData.id || `marker-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    }

    let afterMarkers: MarkerAttribute[]
    const existingIndex = beforeMarkers.findIndex((m) => m.id === marker.id)
    if (existingIndex >= 0) {
      // 既存マーカーの更新
      afterMarkers = [...beforeMarkers]
      afterMarkers[existingIndex] = marker
    } else {
      // 新規追加
      afterMarkers = [...beforeMarkers, marker]
    }

    await maybeAutoSnapshot()

    await upsertGanttRow({
      id: rowIdNum,
      name: row.name,
      order: (row as any).order ?? 0,
      projectId: projectId.value,
      visible: row.visible || true,
      attribute: {
        ...((row as any).attribute || {}),
        markers: afterMarkers,
      },
      tasks: [],
    })

    pushAction({
      description: existingIndex >= 0 ? 'マーカー編集' : 'マーカー作成',
      undo: async () => {
        await upsertGanttRow({
          id: rowIdNum,
          name: row.name,
          order: (row as any).order ?? 0,
          projectId: projectId.value,
          visible: row.visible || true,
          attribute: {
            ...((row as any).attribute || {}),
            markers: beforeMarkers.length > 0 ? beforeMarkers : undefined,
          },
          tasks: [],
        })
        await loadData(projectId.value, { silent: true })
      },
      redo: async () => {
        await upsertGanttRow({
          id: rowIdNum,
          name: row.name,
          order: (row as any).order ?? 0,
          projectId: projectId.value,
          visible: row.visible || true,
          attribute: {
            ...((row as any).attribute || {}),
            markers: afterMarkers,
          },
          tasks: [],
        })
        await loadData(projectId.value, { silent: true })
      },
    })

    await loadData(projectId.value, { silent: true })
    publishEditEvent('row_upsert', { targetName: row.name })
  }

  /**
   * マーカーの削除
   */
  const deleteMarker = async (markerId: string) => {
    // ダイアログを先に閉じてから非同期処理を行う（v-if競合防止）
    isMarkerDialogVisible.value = false

    if (!editingMarkerRowId.value || !projectId.value) return

    const rowIdNum = Number(editingMarkerRowId.value)
    const row = rows.value.find((r) => Number(r.id) === rowIdNum)
    if (!row) return

    const rowAttr = (row as any).attribute as RowAttribute | undefined
    const beforeMarkers = rowAttr?.markers ? [...rowAttr.markers] : []
    const afterMarkers = beforeMarkers.filter((m) => m.id !== markerId)

    await maybeAutoSnapshot()

    await upsertGanttRow({
      id: rowIdNum,
      name: row.name,
      order: (row as any).order ?? 0,
      projectId: projectId.value,
      visible: row.visible || true,
      attribute: {
        ...((row as any).attribute || {}),
        markers: afterMarkers.length > 0 ? afterMarkers : undefined,
      },
      tasks: [],
    })

    pushAction({
      description: 'マーカー削除',
      undo: async () => {
        await upsertGanttRow({
          id: rowIdNum,
          name: row.name,
          order: (row as any).order ?? 0,
          projectId: projectId.value,
          visible: row.visible || true,
          attribute: {
            ...((row as any).attribute || {}),
            markers: beforeMarkers.length > 0 ? beforeMarkers : undefined,
          },
          tasks: [],
        })
        await loadData(projectId.value, { silent: true })
      },
      redo: async () => {
        await upsertGanttRow({
          id: rowIdNum,
          name: row.name,
          order: (row as any).order ?? 0,
          projectId: projectId.value,
          visible: row.visible || true,
          attribute: {
            ...((row as any).attribute || {}),
            markers: afterMarkers.length > 0 ? afterMarkers : undefined,
          },
          tasks: [],
        })
        await loadData(projectId.value, { silent: true })
      },
    })

    await loadData(projectId.value, { silent: true })
    publishEditEvent('row_upsert', { targetName: row.name })
  }

  const selectAllLabels = () => {
    selectedFilterLabelNames.value = [...availableLabels.value.map((l) => l.name), UNLABELED_VALUE]
  }

  const clearAllLabels = () => {
    selectedFilterLabelNames.value = []
  }

  // --- Project Edit Dialog ---
  const isProjectDetailDialogVisible = ref(false)

  const updateProject = async (project: Partial<Project>) => {
    if (!currentProject.value) return
    setIsLoading(true)
    try {
      await maybeAutoSnapshot()
      const updatedProject = { ...currentProject.value, ...project }
      // ストアのアクションを経由して更新する
      await projectStore.updateProject(updatedProject)
      isProjectDetailDialogVisible.value = false
      publishEditEvent('full_reload')
    } catch (err) {
      console.error('Failed to update project:', err)
      await alert({
        title: 'エラー',
        message: 'プロジェクトの更新に失敗しました。',
      })
    } finally {
      setIsLoading(false)
    }
  }

  // --- 期間スライド ---
  const isSlideScheduleDialogVisible = ref(false)
  const slideScheduleSaving = ref(false)

  const handleSlideSchedule = async (options: { newStart: string; clearProgress: boolean }) => {
    if (!currentProject.value || !projectId.value) return

    slideScheduleSaving.value = true
    setIsLoading(true)
    try {
      await maybeAutoSnapshot()

      const granularity = currentProject.value.attribute?.granularity || 'daily'
      const originalStart = dayjs(currentProject.value.start)
      const newStart = dayjs(options.newStart)
      const diffMs = newStart.diff(originalStart, 'millisecond')

      // 差分が0なら何もしない
      if (diffMs === 0) {
        isSlideScheduleDialogVisible.value = false
        return
      }

      // 1. 全タスクをスライド
      const allTasks: GanttTask[] = []
      for (const row of rows.value) {
        for (const task of row.tasks) {
          const taskStart = dayjs((task as any).start)
          const taskEnd = dayjs((task as any).end)
          const newTaskStart = taskStart.add(diffMs, 'millisecond')
          const newTaskEnd = taskEnd.add(diffMs, 'millisecond')

          const attr = { ...((task as any).attribute || {}) } as TaskAttribute
          if (options.clearProgress) {
            attr.progress = undefined
          }

          allTasks.push({
            id: Number(task.id),
            rowId: Number((task as any).rowId ?? row.id),
            name: task.name || '',
            start: toDateTimeString(newTaskStart.toDate()),
            end: toDateTimeString(newTaskEnd.toDate()),
            attribute: attr,
          })
        }
      }

      if (allTasks.length > 0) {
        await upsertGanttTasks(allTasks)
      }

      // 2. プロジェクトの期間を更新
      const originalEnd = dayjs(currentProject.value.end)
      const newEnd = originalEnd.add(diffMs, 'millisecond')

      const isHourly = granularity === 'hourly'
      const isMonthly = granularity === 'monthly'

      const newStartStr = isHourly
        ? newStart.format('YYYY-MM-DD HH:mm:ss')
        : isMonthly
          ? newStart.format('YYYY-MM-DD')
          : newStart.format('YYYY-MM-DD')
      const newEndStr = isHourly
        ? newEnd.format('YYYY-MM-DD HH:mm:ss')
        : isMonthly
          ? newEnd.format('YYYY-MM-DD')
          : newEnd.format('YYYY-MM-DD')

      // 3. マイルストーンをスライド
      const originalMilestones = currentProject.value.attribute?.milestones || []
      const slidMilestones = originalMilestones.map((m) => {
        const mDate = dayjs(m.datetime)
        const newMDate = mDate.add(diffMs, 'millisecond')
        return {
          ...m,
          datetime: isHourly
            ? newMDate.format('YYYY-MM-DDTHH:mm')
            : newMDate.format('YYYY-MM-DD'),
        }
      })

      const updatedProject = {
        ...currentProject.value,
        start: newStartStr,
        end: newEndStr,
        attribute: {
          ...currentProject.value.attribute,
          milestones: slidMilestones.length > 0 ? slidMilestones : undefined,
        },
      }

      await projectStore.updateProject(updatedProject)
      await loadData(projectId.value, { silent: true })

      isSlideScheduleDialogVisible.value = false
      publishEditEvent('full_reload')
    } catch (err) {
      console.error('Failed to slide schedule:', err)
      await alert({
        title: 'エラー',
        message: '期間スライドに失敗しました。',
      })
    } finally {
      slideScheduleSaving.value = false
      setIsLoading(false)
    }
  }

  const refresh = async () => {
    if (projectId.value) {
      await loadData(projectId.value)
    }
  }

  const handleCreateSnapshot = async () => {
    if (!projectId.value) return

    const defaultName = dayjs().format('YYYYMMDD_HHmmss')

    const displayName = await prompt({
      title: 'スナップショットの作成',
      message: 'スナップショットに名前を付けることができます（省略可）',
      label: 'スナップショット名',
      defaultValue: defaultName,
      confirmText: '作成',
    })

    // キャンセルされた場合
    if (displayName === null) return

    setIsLoading(true)
    try {
      const snapshotName = await createSnapshot({
        projectId: projectId.value,
        displayName: displayName || undefined,
      })

      const routeUrl = router.resolve({
        path: `/${projectId.value}/snapshot/${snapshotName}`,
      })
      window.open(routeUrl.href, '_blank', 'noopener,noreferrer')
    } catch (err) {
      console.error('Failed to create snapshot:', err)
      await alert({
        title: 'エラー',
        message: 'スナップショットの作成に失敗しました。',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return {
    // state
    isSnapshotMode,
    projects,
    projectId,
    rows,
    selectedRowIds,
    selectedTaskIds,
    chartOption,
    isDialogVisible,
    editingTask,
    isProjectListDialogVisible,
    currentRole,
    isReadOnly,
    isOwner,
    editingRowId,
    editingRowName,
    editingInputStyle,
    contextMenu,
    taskContextMenu,
    hasLockedTaskInContextMenu,
    chartContextMenu,
    currentProject,
    showHiddenRows,
    showCurrentTimeLine,
    showCriticalPath,
    showMinimap,
    minimapWidth,
    barShadowLevel,
    readonlyMode,
    pxPerDay,
    pxPerMonth,
    pxPerHour,
    barHeight,
    addRowCount,
    manualAddRowCount,
    isUnassignedTasksOpen,
    ganttChartRef,
    availableLabels,
    selectedFilterLabelNames,
    selectedRowFilterLabelNames,
    searchText,
    searchIncludeRows,
    filteredRows,
    displayRows,
    isRowEditDialogVisible,
    editingRowData,
    isProjectDetailDialogVisible,
    canUndo,
    canRedo,
    activeUsers,
    editLogs,
    dependencyContextMenu,
    handleDependencyClick,
    handleDeleteDependencyFromContextMenu,
    isCommentDialogVisible,
    commentDialogTaskId,
    commentDialogRowId,
    commentDialogProjectId,
    commentDialogTargetName,
    isSnapshotListDialogVisible,
    isSlideScheduleDialogVisible,
    slideScheduleSaving,
    isMarkerDialogVisible,
    editingMarker,
    editingMarkerRowId,
    editingMarkerDefaultDate,

    // methods
    handleCreateSnapshot,
    handleTaskUpdate,
    handleTaskDblClick,
    saveTask,
    deleteTask,
    handleRowReordered,
    handleAddRow,
    updateRowName,
    deleteRow,
    handleRowHeaderDblClick,
    handleRowNameUpdate,
    cancelRowNameUpdate,
    handleRowHeaderContextMenu,
    closeContextMenu,
    handleAddRowAbove,
    handleAddRowBelow,
    handleDeleteRowFromContextMenu,
    fetchProjects,
    handleRowSelectionChange,
    handleBarSelectionChange,
    toggleRowVisibility,
    setProjectId,
    handleTaskContextMenu,
    handleEditTaskFromContextMenu,
    handleDeleteTaskFromContextMenu,
    handleTaskDelete,
    handleTaskDragStart,
    handleTaskDragEnd,
    handleTaskDrop,
    handleSelectTaskFromLog,
    handleClickLogFromActivity,
    handleDblClickTaskFromLog,
    handleChartContextMenu,
    handleCreateNewTask,
    handleCreateNewMarker,
    handleMarkerDblClick,
    handleMarkerContextMenu,
    handleEditMarkerFromContextMenu,
    handleDeleteMarkerFromContextMenu,
    markerContextMenu,
    saveMarker,
    deleteMarker,
    selectAllLabels,
    clearAllLabels,
    getContrastColor,
    handleEditRowFromContextMenu,
    saveRow,
    updateProject,
    handleRowHeaderResize,
    undo,
    redo,
    refresh,
    handleAddCommentFromContextMenu,
    handleAddCommentToRow,
    handleAddCommentToProject,
    handleCommentUpdated,
    handleProjectCommentPanelUpdated,
    handleCopyTasksFromContextMenu,
    handlePasteTasksFromContextMenu,
    handleCopyTasksShortcut,
    handlePasteTasksShortcut,
    hasClipboardData,
    projectComments,
    isProjectCommentsLoading,
    fetchProjectComments,
    invalidateProjectCommentsCache,
    exportAsCsv,
    exportAsExcel,
    exportAsPng,
    exportAsPdf,
    exportAsZip,
    commentSidebarOpen,
    commentSidebarWidth,
    effectiveCommentSidebarWidth,
    handleDependencyCreate,
    handleSlideSchedule,
    handleZoomChange,
    handleMinimapResize,
    isImageDialogVisible,
    imageDialogTaskId,
    imageDialogImageUrls,
    handleImageFromContextMenu,
    handleSaveTaskImages,
    handleImageFromRowContextMenu,
    handleSaveImages,
  }
}
