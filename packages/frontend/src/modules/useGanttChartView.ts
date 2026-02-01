import {
  deleteGanttRow,
  deleteGanttTask,
  selectGanttChart,
  selectProjects,
  updateGanttRowOrder,
  upsertGanttRow,
  upsertGanttTask,
  upsertProject,
} from '@/modules/scripts'
import { useAlert } from '@/modules/useAlert'
import { useAuth } from '@/modules/useAuth'
import { useLoading } from '@/modules/useLoading'
import { toDateString } from '@/modules/utils'
import type {
  GanttRow,
  GanttTask,
  Project,
  Role,
} from '@functions/types/shared'
import type {
  RowReorderEventDetail,
  TaskClickEventDetail,
  TaskUpdateEventDetail,
} from '@mogura/moguchart'
import * as moguchart from '@mogura/moguchart'
import { computed, ref, watch } from 'vue'

const calculateDaysBetween = (start: string, end: string): number => {
  const startDate = new Date(start)
  const endDate = new Date(end)
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime())
  // 終了日も期間に含めるため、+1 する
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
  return diffDays
}

export function useGanttChartView() {
  const { user } = useAuth()

  // --- 設定値 ---
  const chartStartStr = ref('2025-12-15')
  const chartEndStr = ref('2026-03-31')
  const pxPerDay = ref(28)
  const barHeight = ref(32)
  const barMargin = ref(4)
  const barCornerRadius = ref(4)
  const labelWidth = ref(150)

  // --- 状態 ---
  const projects = ref<Project[]>([])
  const projectId = ref<string>('')
  const currentRole = ref<Role>('viewer') // デフォルト値を viewer に
  const rows = ref<moguchart.GanttRow[]>([])

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
    },
    rowHeader: {
      maxWidth: 400,
    },
    enableRowReordering: true,
    readOnly: isReadOnly.value,
  }))

  const alert = useAlert()
  const { setIsLoading } = useLoading()

  // --- データ永続化ロジック ---

  async function loadData(pId: string) {
    if (!pId) return
    setIsLoading(true)
    try {
      const data = await selectGanttChart(pId)
      rows.value = data.map((row: GanttRow) => ({
        ...row,
        id: row.id.toString(),
        tasks: row.tasks.map((task: GanttTask) => ({
          ...task,
          id: task.id.toString(),
          start: new Date(task.start),
          end: new Date(task.end),
        })),
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
      currentRole.value = project.role
    }
    loadData(newProjectId)
  })

  watch(
    user,
    async (newUser) => {
      if (newUser) {
        // ユーザーがログインした場合、プロジェクトリストを読み込む
        projects.value = await selectProjects()
        const firstProject = projects.value[0]
        if (firstProject) {
          // 最初のプロジェクトを選択状態にする
          projectId.value = firstProject.id
        }
      } else {
        // ユーザーがログアウトした場合、データをクリアする
        rows.value = []
        projects.value = []
        projectId.value = ''
        currentRole.value = 'viewer' // ロールもリセット
      }
    },
    { immediate: true }, // コンポーネントのマウント時に即時実行する
  )

  const handleTaskUpdate = async (e: CustomEvent<TaskUpdateEventDetail>) => {
    if (e.detail.isDragging) {
      return
    }

    const data = {
      id: e.detail.mode === 'copy' ? 0 : Number(e.detail.id),
      rowId: Number(e.detail.targetRowId),
      name: e.detail.name || '',
      start: toDateString(e.detail.start),
      end: toDateString(e.detail.end),
    }
    await upsertGanttTask(data)
    await loadData(projectId.value)
  }

  // --- ダイアログ関連 ---
  const isDialogVisible = ref(false)
  const editingTask = ref({
    id: '',
    rowId: '',
    name: '',
    start: '',
    end: '',
  })

  const handleTaskDblClick = (e: CustomEvent<TaskClickEventDetail>) => {
    const detail = e.detail
    const taskId = String(detail.task.id)
    const row = rows.value.find((r) => r.tasks.some((t) => t.id === taskId))
    const task = row?.tasks.find((t) => t.id === taskId)

    if (row && task) {
      editingTask.value = {
        id: task.id,
        rowId: row.id,
        name: task.name || '',
        start: toDateString(task.start, 'YYYY-MM-DD'),
        end: toDateString(task.end, 'YYYY-MM-DD'),
      }
      isDialogVisible.value = true
    }
  }

  const handleAddTask = async () => {
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

  const handleRowReordered = async (e: CustomEvent<RowReorderEventDetail>) => {
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
  const isRowDialogVisible = ref(false)

  const saveNewRow = async (name: string) => {
    // 行を追加するAPI呼び出し
    await upsertGanttRow({
      id: 0,
      name,
      order: 0,
      projectId: projectId.value,
      tasks: [],
    })

    isRowDialogVisible.value = false
    await loadData(projectId.value)
  }

  // --- 行削除関連 ---
  const isRowDeleteDialogVisible = ref(false)

  const deleteRow = async (rowId: string) => {
    await deleteGanttRow(Number(rowId))
    isRowDeleteDialogVisible.value = false
    await loadData(projectId.value)
  }

  // --- プロジェクト追加/編集関連 ---
  const isProjectDialogVisible = ref(false)
  const editingProject = ref<Project | null>(null)

  const openProjectDialog = (isEditMode: boolean) => {
    if (isEditMode) {
      const project = projects.value.find((p) => p.id === projectId.value)
      if (!project) return
      editingProject.value = { ...project }
    } else {
      editingProject.value = null
    }
    isProjectDialogVisible.value = true
  }

  const saveProject = async (
    projectData: Omit<Project, 'attribute'> | Omit<Project, 'id' | 'attribute'>,
  ) => {
    const projectToSave = {
      ...projectData,
      attribute: {},
    }

    let targetProjectId = projectId.value
    if ('id' in projectToSave && projectToSave.id) {
      await upsertProject(projectToSave)
    } else {
      targetProjectId = await upsertProject({ ...projectToSave, id: '' })
    }

    projects.value = await selectProjects()
    projectId.value = targetProjectId

    const updatedProject = projects.value.find((p) => p.id === targetProjectId)
    if (updatedProject) {
      chartStartStr.value = updatedProject.start
      chartEndStr.value = updatedProject.end
    }

    isProjectDialogVisible.value = false
  }

  return {
    // state
    projects,
    projectId,
    rows,
    chartOption,
    isDialogVisible,
    editingTask,
    isRowDialogVisible,
    isRowDeleteDialogVisible,
    isProjectDialogVisible,
    editingProject,
    currentRole,

    // methods
    handleTaskUpdate,
    handleTaskDblClick,
    handleAddTask,
    saveTask,
    deleteTask,
    handleRowReordered,
    saveNewRow,
    deleteRow,
    saveProject,
    openProjectDialog,
  }
}
