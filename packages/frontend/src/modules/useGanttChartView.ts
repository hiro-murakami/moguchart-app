import { DEFAULT_TASK_COLOR, UNLABELED_VALUE } from '@/modules/constants'
import {
  deleteGanttRow,
  deleteGanttTask,
  selectGanttChart,
  updateGanttRowOrder,
  upsertGanttRow,
  upsertGanttTask,
} from '@/modules/scripts'
import { useAlert } from '@/modules/useAlert'
import { useConfirm } from '@/modules/useConfirm'
import { useLoading } from '@/modules/useLoading'
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

export const useGanttChartView = () => {
  const route = useRoute()
  const router = useRouter()
  const userStore = useUserStore()

  // --- 設定値 ---
  const selectedFilterLabelNames = ref<string[]>([])
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
    if (selectedFilterLabelNames.value.length === 0) {
      return rows.value
    }
    return rows.value.map((row) => ({
      ...row,
      tasks: row.tasks.filter((task) => {
        const attribute = (task as any).attribute as TaskAttribute | undefined
        const taskLabels = attribute?.labels || []

        if (selectedFilterLabelNames.value.includes(UNLABELED_VALUE) && taskLabels.length === 0) {
          return true
        }

        return taskLabels.some((l) => selectedFilterLabelNames.value.includes(l.name))
      }),
    }))
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
              style = `background-color: ${colorPalette.backgroundColor}; border-color: ${colorPalette.backgroundColor}; ${style || ''}`
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

    await upsertGanttTask(data)
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

      await upsertGanttTask({
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
      } as any)
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
        style = `background-color: ${taskData.colorPalette.backgroundColor}; border-color: ${taskData.colorPalette.backgroundColor};`
      } else {
        style = `background-color: ${DEFAULT_TASK_COLOR};`
      }

      // アニメーションの追加
      style += ` transform-origin: center; animation: pop-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;`

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

    await upsertGanttTask(data)
    await loadData(projectId.value)
  }

  const execDeleteTasksWithAnimation = async (taskIds: string[]) => {
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

    // 4. データリロード
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
      const orderedRows = e.detail.rows.map((row, index) => ({
        id: Number(row.id),
        order: index + 1,
      }))
      await updateGanttRowOrder(orderedRows)
      // loadData() を呼ぶとローカルでの並べ替えと前後してちらつくため、ローカルデータを直接更新する
      rows.value = e.detail.rows
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

    try {
      // 一括更新
      await upsertGanttRow(
        targetRows.map((row) => ({
          id: Number(row.id),
          name: row.name,
          order: (row as any).order ?? 0,
          projectId: projectId.value,
          visible: newVisible,
          attribute: (row as any).attribute || {},
          tasks: [],
        })),
      )
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
    await deleteGanttRow(rowIds.map(Number))
    // isRowDeleteDialogVisible は削除済み
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
    filteredRows,
    isRowEditDialogVisible,
    editingRowData,
    isProjectDetailDialogVisible,

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
  }
}
