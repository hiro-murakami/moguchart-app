import { DEFAULT_TASK_COLOR, UNLABELED_VALUE } from '@/modules/constants'
import {
  deleteGanttRow,
  deleteGanttTask,
  selectGanttChart,
  updateGanttRowOrder,
  upsertGanttRow,
  upsertGanttTasks,
} from '@/modules/scripts'
import { useAlert } from '@/composables/useAlert'
import { useUndoRedo } from '@/composables/useUndoRedo'
import { useConfirm } from '@/composables/useConfirm'
import { useLoading } from '@/composables/useLoading'
import { toDateString, toLocalDate, getContrastColor } from '@/modules/utils'
import { barContent, tooltip, rowHeaderContent } from '@/modules/ganttChartCustomRendering'
import { useProjectStore } from '@/stores/useProjectStore'
import { useUserStore } from '@/stores/useUserStore'
import type {
  ColorPalette,
  GanttRow,
  GanttTask,
  TaskAttribute,
  RowAttribute,
  Project,
  EditingRowData,
  EditingTaskData,
} from '@functions/types/shared'
import * as holiday_jp from '@holiday-jp/holiday_jp'
import * as moguchart from '@mogura/moguchart'
import { debounce } from 'lodash'
import { storeToRefs } from 'pinia'
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

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

  // --- 設定値 ---
  const selectedFilterLabelNames = ref<string[]>([])
  const searchText = ref('')
  const searchIncludeRows = ref(false)
  const chartStartStr = ref('2025-12-15')
  const chartEndStr = ref('2026-03-31')
  const pxPerDay = ref(28)
  const rowHeaderWidth = ref(200)
  const barHeight = ref(38)
  const barMargin = ref(4)
  const barCornerRadius = ref(4)
  const labelWidth = ref(150)
  const showHiddenRows = ref(false)
  const manualAddRowCount = ref(1)

  const isUnassignedTasksOpen = ref(false)

  // --- 状態 ---
  const projectStore = useProjectStore()
  const { projects, currentProjectId: projectId, currentRole, currentProject } = storeToRefs(projectStore)
  const { currentTheme } = storeToRefs(userStore)
  const { fetchProjects, setProjectId, clear: clearProjectStore } = projectStore

  // プロジェクト設定を保存する共通関数（debounce付き）
  const saveProjectSettings = debounce(
    async (settings: {
      pxPerDay?: number
      selectedLabels?: string[]
      showHiddenRows?: boolean
      rowHeaderWidth?: number
    }) => {
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
      }
    },
    { immediate: true },
  )

  const rows = ref<moguchart.GanttRow[]>([])
  const selectedRowIds = ref<string[]>([])
  const selectedTaskIds = ref<string[]>([])

  const availableLabels = computed(() => {
    return currentProject.value?.attribute?.labels || []
  })

  const filteredRows = computed(() => {
    const hasLabelFilter = selectedFilterLabelNames.value.length > 0
    const trimmed = (searchText.value || '').trim()
    const hasKeywordFilter = trimmed !== ''

    if (!hasLabelFilter && !hasKeywordFilter) {
      return rows.value
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

          const newTask = { ...task }
          if (hasKeywordFilter && isTaskMatch) {
            Object.assign(newTask, { _searchKeywords: keywords })
          }

          if (!isTaskMatch) {
            // 対象外のタスクは非表示にするのではなく透過率を上げて区別する
            const styleStr = (newTask as any).style || ''
            const separator = styleStr && !styleStr.trim().endsWith(';') ? ';' : ''
            Object.assign(newTask, { style: `${styleStr}${separator} opacity: 0.2;` })
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

  const isReadOnly = computed(() => currentRole.value === 'viewer')

  const chartOption = computed<moguchart.GanttChartOption>(() => ({
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
      pxPerDay: pxPerDay.value,
      isHoliday: holiday_jp.isHoliday,
      showCurrentTime: true,
      currentTimeUpdateInterval: 1000 * 60,
    },
    rowHeader: {
      maxWidth: 400,
      width: rowHeaderWidth.value,
    },
    enableRowReordering: true,
    readOnly: isReadOnly.value,
    showHiddenRows: showHiddenRows.value,
    theme: currentTheme.value,
    customRendering: {
      barContent,
      tooltip,
      rowHeaderContent,
    },
  }))

  const alert = useAlert()
  const { setIsLoading } = useLoading()
  const confirm = useConfirm()
  const { canUndo, canRedo, isUndoRedoing, pushAction, undo, redo, clearHistory } = useUndoRedo()

  // --- データ永続化ロジック ---

  async function loadData(pId: string) {
    if (!pId) return
    setIsLoading(true)
    try {
      const data = await selectGanttChart(pId)
      rows.value = data.map((row: GanttRow) => ({
        ...row,
        id: row.id.toString(),
        tasks: row.tasks.map((task: GanttTask) => {
          const attribute = (task as any).attribute as TaskAttribute | undefined
          const colorPalette = attribute?.colorPalette

          let style: string | undefined
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

          return {
            ...task,
            id: task.id.toString(),
            start: toLocalDate(task.start),
            end: toLocalDate(task.end),
            style,
            labelStyle,
            pattern,
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
      }))
    } catch (err) {
      console.error('Failed to load data:', err)
      alert({
        title: 'エラー',
        message: 'データの読み込みに失敗しました。',
      })
    } finally {
      setIsLoading(false)
    }
  }

  watch(projectId, (newProjectId) => {
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
  })

  watch(
    () => userStore.user,
    async (newUser) => {
      if (newUser) {
        // ユーザーがログインした場合、プロジェクトリストを読み込む
        await fetchProjects()

        const routeId = Array.isArray(route.params.id) ? route.params.id[0] : route.params.id
        const targetProject = routeId ? projects.value.find((p) => p.id === routeId) : undefined

        if (targetProject) {
          setProjectId(targetProject.id)
        } else {
          isProjectListDialogVisible.value = true
        }
      } else {
        // ユーザーがログアウトした場合、データをクリアする
        rows.value = []
        clearProjectStore()
      }
    },
    { immediate: true }, // コンポーネントのマウント時に即時実行する
  )

  const handleTaskUpdate = async (e: CustomEvent<moguchart.TaskUpdateEventDetail>) => {
    if (e.detail.isDragging) {
      return
    }

    const data = {
      id: e.detail.mode === 'copy' ? 0 : Number(e.detail.id),
      rowId: Number(e.detail.targetRowId),
      name: e.detail.name || '',
      start: toDateString(e.detail.start),
      end: toDateString(e.detail.end),
      attribute: {},
    }

    // コピー時はdata.idが0なので、元タスクのIDで検索する
    const sourceTaskIdStr = String(e.detail.id)
    const row = rows.value.find((r) => r.tasks.some((t) => t.id === sourceTaskIdStr))
    const task = row?.tasks.find((t) => t.id === sourceTaskIdStr)
    if (task) {
      const attribute = (task as any).attribute as TaskAttribute | undefined
      if (attribute) {
        data.attribute = { ...attribute }
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

    if (data.id === 0) {
      // コピー（新規作成）の場合
      const result = await upsertGanttTasks([data])
      const newTaskId = result[0]!
      pushAction({
        description: 'タスクコピー',
        undo: async () => {
          await deleteGanttTask([newTaskId])
          await loadData(projectId.value)
        },
        redo: async () => {
          await upsertGanttTasks([{ ...data, id: 0 }])
          await loadData(projectId.value)
        },
      })
    } else if (task && row) {
      // 移動/リサイズの場合
      const beforeData = {
        id: Number(task.id),
        rowId: Number(row.id),
        name: task.name || '',
        start: toDateString(task.start),
        end: toDateString(task.end),
        attribute: { ...((task as any).attribute || {}) },
      }
      pushAction({
        description: 'タスク移動/リサイズ',
        undo: async () => {
          await upsertGanttTasks([beforeData])
          await loadData(projectId.value)
        },
        redo: async () => {
          await upsertGanttTasks([data])
          await loadData(projectId.value)
        },
      })
      await upsertGanttTasks([data])
    } else {
      await upsertGanttTasks([data])
    }
    await loadData(projectId.value)
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
        style: `${(task as any).style || ''}; transform-origin: center; animation: pop-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;`,
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
        start: toDateString(newStart),
        end: toDateString(newEnd),
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
          await loadData(projectId.value)
        },
        redo: async () => {
          await upsertGanttTasks([{ ...taskData, id: 0 }])
          await loadData(projectId.value)
        },
      })
      await loadData(projectId.value)
    } catch (err) {
      console.error('Failed to drop task:', err)
      await alert({
        title: 'エラー',
        message: 'タスクの作成に失敗しました。',
      })
    }
  }

  // --- ダイアログ関連 ---
  const isDialogVisible = ref(false)
  const editingTask = ref<EditingTaskData>({
    id: '',
    rowId: '',
    name: '',
    start: '',
    end: '',
    description: '',
    labels: [],
  })

  const handleTaskDblClick = (e: CustomEvent<moguchart.TaskClickEventDetail>) => {
    if (isReadOnly.value) return
    const detail = e.detail
    const taskId = String(detail.task.id)
    const row = rows.value.find((r) => r.tasks.some((t) => t.id === taskId))
    const task = row?.tasks.find((t) => t.id === taskId)

    if (row && task) {
      const taskWithAttr = task as unknown as { attribute?: TaskAttribute }
      editingTask.value = {
        id: task.id,
        rowId: row.id,
        name: task.name || '',
        start: toDateString(task.start),
        end: toDateString(task.end),
        description: taskWithAttr.attribute?.description || '',
        colorPalette: taskWithAttr.attribute?.colorPalette ? { ...taskWithAttr.attribute.colorPalette } : undefined,
        labels: taskWithAttr.attribute?.labels ? [...taskWithAttr.attribute.labels] : [],
      }
      isDialogVisible.value = true
    }
  }

  const saveTask = async (taskData: typeof editingTask.value) => {
    // 新規作成の場合、アニメーション用の楽観的UI更新を行う
    if (!taskData.id) {
      const tempId = -Date.now()
      const start = toLocalDate(taskData.start)
      const end = toLocalDate(taskData.end)

      // スタイルの構築
      let style = ''
      if (taskData.colorPalette?.backgroundColor) {
        style = `background-color: ${taskData.colorPalette.backgroundColor}; `
      } else {
        style = `background-color: ${DEFAULT_TASK_COLOR}; `
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
      },
    }

    // ダイアログを閉じる
    isDialogVisible.value = false

    if (!taskData.id) {
      // 新規作成
      const result = await upsertGanttTasks([data])
      const newTaskId = result[0]!
      pushAction({
        description: 'タスク作成',
        undo: async () => {
          await deleteGanttTask([newTaskId])
          await loadData(projectId.value)
        },
        redo: async () => {
          await upsertGanttTasks([{ ...data, id: 0 }])
          await loadData(projectId.value)
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
          start: toDateString(beforeTask.start),
          end: toDateString(beforeTask.end),
          attribute: {
            description: beforeAttr?.description || undefined,
            colorPalette: beforeAttr?.colorPalette ? { ...beforeAttr.colorPalette } : undefined,
            labels: beforeAttr?.labels ? [...beforeAttr.labels] : undefined,
          },
        }
        pushAction({
          description: 'タスク編集',
          undo: async () => {
            await upsertGanttTasks([beforeData])
            await loadData(projectId.value)
          },
          redo: async () => {
            await upsertGanttTasks([data])
            await loadData(projectId.value)
          },
        })
      }
      await upsertGanttTasks([data])
    }
    await loadData(projectId.value)
  }

  const execDeleteTasksWithAnimation = async (taskIds: string[]) => {
    // Undo用に削除前のタスクデータを保持
    const deletedTasks: { taskData: any; rowId: string }[] = []
    for (const taskId of taskIds) {
      const row = rows.value.find((r) => r.tasks.some((t) => t.id === taskId))
      const task = row?.tasks.find((t) => t.id === taskId)
      if (row && task) {
        const attr = (task as any).attribute as TaskAttribute | undefined
        deletedTasks.push({
          rowId: row.id,
          taskData: {
            id: 0, // Undo時は新規作成として復元
            rowId: Number(row.id),
            name: task.name || '',
            start: toDateString(task.start),
            end: toDateString(task.end),
            attribute: attr ? { ...attr } : {},
          },
        })
      }
    }

    // 1. アニメーション適用
    rows.value = rows.value.map((row) => ({
      ...row,
      tasks: row.tasks.map((t) => {
        if (taskIds.includes(String(t.id))) {
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
    await deleteGanttTask(taskIds.map(Number))

    // 4. Undo/Redo記録
    if (deletedTasks.length > 0) {
      pushAction({
        description: `タスク削除 (${deletedTasks.length}件)`,
        undo: async () => {
          await upsertGanttTasks(deletedTasks.map((d) => d.taskData))
          await loadData(projectId.value)
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
                  toDateString(t.start) === dt.taskData.start &&
                  toDateString(t.end) === dt.taskData.end,
              )
              if (matchingTask) {
                currentTaskIds.push(Number(matchingTask.id))
              }
            }
          }
          if (currentTaskIds.length > 0) {
            await deleteGanttTask(currentTaskIds)
          }
          await loadData(projectId.value)
        },
      })
    }

    // 5. データリロード
    selectedTaskIds.value = []
    await loadData(projectId.value)
  }

  const deleteTask = async (taskId: string) => {
    isDialogVisible.value = false
    await execDeleteTasksWithAnimation([taskId])
  }

  const handleRowReordered = async (e: CustomEvent<moguchart.RowReorderEventDetail>) => {
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

      pushAction({
        description: '行並び替え',
        undo: async () => {
          await updateGanttRowOrder(beforeOrder)
          await loadData(projectId.value)
        },
        redo: async () => {
          await updateGanttRowOrder(orderedRows)
          await loadData(projectId.value)
        },
      })
    } catch (err) {
      console.error('Failed to reorder rows:', err)
      alert({
        title: 'エラー',
        message: '行の並び順の更新に失敗しました。',
      })
      // エラーが発生した場合はサーバーの状態に戻す
      await loadData(projectId.value)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRowHeaderResize = (e: CustomEvent<moguchart.RowHeaderResizeEventDetail>) => {
    rowHeaderWidth.value = e.detail.width
  }

  // --- 行追加関連 ---
  const handleAddRow = async (index?: number, count: number = 1) => {
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
          await loadData(projectId.value)
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
          await loadData(projectId.value)
        },
      })

      await loadData(projectId.value)
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
          await loadData(projectId.value)
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
          await loadData(projectId.value)
        },
      })
    }

    await loadData(projectId.value)
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

  const handleEditRowFromContextMenu = () => {
    const rowId = contextMenu.value.rowId
    if (rowId === null) return

    const row = rows.value.find((r) => Number(r.id) === rowId)
    if (!row) return

    const attribute = (row as any).attribute as RowAttribute | undefined

    editingRowData.value = {
      id: rowId,
      name: row.name,
      description: attribute?.description || '',
    }
    isRowEditDialogVisible.value = true
    closeContextMenu()
  }

  const saveRow = async (data: { id: number; name: string; description?: string }) => {
    const row = rows.value.find((r) => Number(r.id) === data.id)
    if (!row) return

    const beforeName = row.name
    const beforeAttr = (row as any).attribute as RowAttribute | undefined
    const beforeDescription = beforeAttr?.description || ''

    await upsertGanttRow({
      id: data.id,
      name: data.name,
      order: (row as any).order ?? 0,
      projectId: projectId.value,
      visible: row.visible || true,
      attribute: {
        ...((row as any).attribute || {}),
        description: data.description || undefined,
      },
      tasks: [],
    })

    if (beforeName !== data.name || beforeDescription !== (data.description || '')) {
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
            },
            tasks: [],
          })
          await loadData(projectId.value)
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
            },
            tasks: [],
          })
          await loadData(projectId.value)
        },
      })
    }

    isRowEditDialogVisible.value = false
    await loadData(projectId.value)
  }

  const handleRowHeaderDblClick = (e: CustomEvent<moguchart.RowHeaderDblClickEventDetail>) => {
    if (isReadOnly.value) return
    if (editingRowId.value !== null) return // Already editing

    const { row, target } = e.detail
    if (!row) return

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
        height: `${barHeight.value - 6}px`,
      }

      // Focus the input next tick
      setTimeout(() => {
        const input = document.getElementById('row-edit-input')
        if (input) (input as HTMLInputElement).focus()
      }, 0)
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
    if (isReadOnly.value) return
    const { task, event } = e.detail
    event.preventDefault()

    taskContextMenu.value = {
      visible: true,
      x: event.clientX,
      y: event.clientY,
      taskId: String(task.id),
    }
  }

  const handleEditTaskFromContextMenu = () => {
    const taskId = taskContextMenu.value.taskId
    if (!taskId) return

    const row = rows.value.find((r) => r.tasks.some((t) => t.id === taskId))
    const task = row?.tasks.find((t) => t.id === taskId)

    if (row && task) {
      const taskWithAttr = task as unknown as { attribute?: TaskAttribute }
      editingTask.value = {
        id: task.id,
        rowId: row.id,
        name: task.name || '',
        start: toDateString(task.start),
        end: toDateString(task.end),
        description: taskWithAttr.attribute?.description || '',
        colorPalette: taskWithAttr.attribute?.colorPalette ? { ...taskWithAttr.attribute.colorPalette } : undefined,
      }
      isDialogVisible.value = true
    }
    taskContextMenu.value.visible = false
  }

  const handleDeleteTaskFromContextMenu = async () => {
    const taskId = taskContextMenu.value.taskId
    if (!taskId) return

    taskContextMenu.value.visible = false

    const isMultiSelect = selectedTaskIds.value.includes(taskId) && selectedTaskIds.value.length > 1

    if (isMultiSelect) {
      const count = selectedTaskIds.value.length
      const result = await confirm({
        title: 'タスク削除の確認',
        message: `選択された<b>${count}件</b>のタスクを削除してもよろしいですか？`,
        confirmText: '削除',
        confirmColor: 'error',
      })

      if (result) {
        setIsLoading(true)
        try {
          await execDeleteTasksWithAnimation(selectedTaskIds.value)
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
          await loadData(projectId.value)
        },
        redo: async () => {
          await upsertGanttRow(rowUpdateData)
          await loadData(projectId.value)
        },
      })

      await loadData(projectId.value)
      closeContextMenu()
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
              id: 0, // Undo時は新規作成
              rowId: 0, // 復元後に設定
              name: t.name || '',
              start: toDateString(t.start),
              end: toDateString(t.end),
              attribute: tAttr ? { ...tAttr } : {},
            }
          }),
        }
      })
      .filter(Boolean) as any[]

    await deleteGanttRow(rowIds.map(Number))

    if (deletedRowsData.length > 0) {
      pushAction({
        description: `行削除 (${deletedRowsData.length}件)`,
        undo: async () => {
          // 行を再作成
          for (const rowData of deletedRowsData) {
            const tasks = rowData.tasks
            const newRowId = (await upsertGanttRow({
              id: 0,
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
          await loadData(projectId.value)
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
          await loadData(projectId.value)
        },
      })
    }

    await loadData(projectId.value)
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

  const handleCreateNewTask = (date: Date, rowId: string) => {
    editingTask.value = {
      id: '', // 新規作成
      rowId: rowId,
      name: '新規タスク',
      start: toDateString(date),
      end: toDateString(new Date(date.getTime() + 2 * 24 * 60 * 60 * 1000)), // デフォルト2日
      description: '',
    }
    isDialogVisible.value = true
    chartContextMenu.value.visible = false
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
      const updatedProject = { ...currentProject.value, ...project }
      // ストアのアクションを経由して更新する
      await projectStore.updateProject(updatedProject)
      isProjectDetailDialogVisible.value = false
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

  const refresh = async () => {
    if (projectId.value) {
      await loadData(projectId.value)
    }
  }

  return {
    // state
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
    editingRowId,
    editingRowName,
    editingInputStyle,
    contextMenu,
    taskContextMenu,
    chartContextMenu,
    currentProject,
    showHiddenRows,
    pxPerDay,
    addRowCount,
    manualAddRowCount,

    isUnassignedTasksOpen,
    ganttChartRef,
    availableLabels,
    selectedFilterLabelNames,
    searchText,
    searchIncludeRows,
    filteredRows,
    isRowEditDialogVisible,
    editingRowData,
    isProjectDetailDialogVisible,
    canUndo,
    canRedo,

    // methods
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
    handleTaskDragStart,
    handleTaskDragEnd,
    handleTaskDrop,
    handleChartContextMenu,
    handleCreateNewTask,
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
  }
}
