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
import { toDateString } from '@/modules/utils'
import { useProjectStore } from '@/stores/useProjectStore'
import { useUserStore } from '@/stores/useUserStore'
import type { ColorPalette, GanttRow, GanttTask, TaskAttribute } from '@functions/types/shared'
import * as holiday_jp from '@holiday-jp/holiday_jp'
import * as moguchart from '@mogura/moguchart'
import { storeToRefs } from 'pinia'
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export const useGanttChartView = () => {
  const route = useRoute()
  const router = useRouter()
  const userStore = useUserStore()

  // --- 設定値 ---
  const chartStartStr = ref('2025-12-15')
  const chartEndStr = ref('2026-03-31')
  const pxPerDay = ref(28)
  const barHeight = ref(32)
  const barMargin = ref(4)
  const barCornerRadius = ref(4)
  const labelWidth = ref(150)
  const showHiddenRows = ref(false)

  // --- 状態 ---
  const projectStore = useProjectStore()
  const { projects, currentProjectId: projectId, currentRole, currentProject } = storeToRefs(projectStore)
  const { currentTheme } = storeToRefs(userStore)
  const { fetchProjects, setProjectId, clear: clearProjectStore } = projectStore

  const rows = ref<moguchart.GanttRow[]>([])
  const selectedRowIds = ref<string[]>([])

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
      start: new Date(chartStartStr.value),
      end: new Date(chartEndStr.value),
      pxPerDay: pxPerDay.value,
      isHoliday: holiday_jp.isHoliday,
      showCurrentTime: true,
    },
    rowHeader: {
      maxWidth: 400,
    },
    enableRowReordering: true,
    readOnly: isReadOnly.value,
    showHiddenRows: showHiddenRows.value,
    theme: currentTheme.value,
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
            start: new Date(task.start),
            end: new Date(task.end),
            style,
            labelStyle,
            pattern,
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

    const taskIdStr = String(data.id)
    const row = rows.value.find((r) => r.tasks.some((t) => t.id === taskIdStr))
    const task = row?.tasks.find((t) => t.id === taskIdStr)
    if (task) {
      const attribute = (task as any).attribute as TaskAttribute | undefined
      if (attribute) {
        data.attribute = { ...attribute }
      }
    }

    await upsertGanttTask(data)
    await loadData(projectId.value)
  }

  // --- ダイアログ関連 ---
  const isDialogVisible = ref(false)
  const editingTask = ref<{
    id: string
    rowId: string
    name: string
    start: string
    end: string
    colorPalette?: ColorPalette
  }>({
    id: '',
    rowId: '',
    name: '',
    start: '',
    end: '',
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
        colorPalette: taskWithAttr.attribute?.colorPalette ? { ...taskWithAttr.attribute.colorPalette } : undefined,
      }
      isDialogVisible.value = true
    }
  }

  const handleAddTask = async () => {
    if (isReadOnly.value) return
    if (rows.value.length === 0) {
      await alert({ message: '先に行を追加してください。' })
      return
    }
    if (!rows.value[0]?.id) {
      return
    }
    editingTask.value = {
      id: '0',
      rowId: rows.value[0].id,
      name: '新規タスク',
      start: chartStartStr.value,
      end: chartStartStr.value,
      colorPalette: undefined,
    }
    isDialogVisible.value = true
  }

  const saveTask = async (taskData: typeof editingTask.value) => {
    const data = {
      id: Number(taskData.id),
      rowId: Number(taskData.rowId),
      name: taskData.name,
      start: taskData.start,
      end: taskData.end,
      attribute: {
        colorPalette: taskData.colorPalette,
      },
    }
    await upsertGanttTask(data)
    isDialogVisible.value = false
    await loadData(projectId.value)
  }

  const deleteTask = async (taskId: string) => {
    await deleteGanttTask(Number(taskId))
    isDialogVisible.value = false
    await loadData(projectId.value)
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

  // --- 行追加関連 ---
  const handleAddRow = async (index?: number) => {
    setIsLoading(true)
    try {
      const targetIndex = index ?? rows.value.length
      const newName = '新規行'

      // 新規行を追加
      const newRowId = (await upsertGanttRow({
        id: 0,
        name: newName,
        order: targetIndex + 1,
        projectId: projectId.value,
        visible: true,
        attribute: {},
        tasks: [],
      })) as number

      // 挿入位置に関わらず順序を更新して正規化する
      // (既存のorderが連番でない場合に意図しない位置に入るのを防ぐため)
      const currentRows = [...rows.value]
      const newRowStub = { id: String(newRowId) } as any
      currentRows.splice(targetIndex, 0, newRowStub)

      const orderedRows = currentRows.map((row, idx) => ({
        id: Number(row.id),
        order: idx + 1,
      }))

      await updateGanttRowOrder(orderedRows)

      await loadData(projectId.value)
      startEditingRowByName(newRowId, newName)
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

    await upsertGanttRow({
      id: rowId,
      name,
      order: (row as any).order ?? 0,
      projectId: projectId.value,
      visible: row.visible || true,
      attribute: {},
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
        height: `${barHeight.value + barMargin.value * 2}px`,
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

  const handleAddRowAbove = async () => {
    if (contextMenu.value.rowId === null) return
    const index = rows.value.findIndex((r) => Number(r.id) === contextMenu.value.rowId)
    if (index !== -1) {
      await handleAddRow(index)
    }
  }

  const handleAddRowBelow = async () => {
    if (contextMenu.value.rowId === null) return
    const index = rows.value.findIndex((r) => Number(r.id) === contextMenu.value.rowId)
    if (index !== -1) {
      await handleAddRow(index + 1)
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
          attribute: {},
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

  return {
    // state
    projects,
    projectId,
    rows,
    selectedRowIds,
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
    currentProject,
    showHiddenRows,

    // methods
    handleTaskUpdate,
    handleTaskDblClick,
    handleAddTask,
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
    toggleRowVisibility,
    setProjectId,
  }
}
