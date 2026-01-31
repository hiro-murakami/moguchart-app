<script setup lang="ts">
import {
  selectGanttChart,
  upsertGanttTask,
  upsertGanttRow,
  deleteGanttRow,
  deleteGanttTask,
  updateGanttRowOrder,
} from '@/modules/scripts'
import type { GanttRow, GanttTask } from '@functions/types/shared'
import '@mogura/moguchart'
import type {
  TaskClickEventDetail,
  TaskUpdateEventDetail,
  RowReorderEventDetail,
} from '@mogura/moguchart'
import * as moguchart from '@mogura/moguchart'
import { computed, ref, watch } from 'vue'
import { toDateString } from '@/modules/utils'
import { useAlert } from '@/modules/useAlert'
import { useSnackbar } from '@/modules/useSnackbar'
import { useLoading } from '@/modules/useLoading'
import { useAuth } from '@/modules/useAuth'

const { user, signIn } = useAuth()

// --- 設定値 ---
const chartStartStr = ref('2025-12-15')
const pxPerDay = ref(28)
const totalDays = ref(90)
const barHeight = ref(32)
const barMargin = ref(4)
const barCornerRadius = ref(4)
const labelWidth = ref(150)

// --- 状態 ---
const isReadOnly = ref(false)

const rows = ref<moguchart.GanttRow[]>([])

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
    start: new Date(chartStartStr.value + 'T00:00:00'),
    pxPerDay: pxPerDay.value,
    totalDays: totalDays.value,
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

async function loadData() {
  setIsLoading(true)
  try {
    const data = await selectGanttChart()
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

watch(
  user,
  (newUser) => {
    if (newUser) {
      loadData()
    } else {
      // ユーザーがログアウトした場合、データをクリアする
      rows.value = []
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
  await loadData()
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
  await loadData()
}

const deleteTask = async (taskId: string) => {
  await deleteGanttTask(Number(taskId))
  isDialogVisible.value = false
  await loadData()
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
    // snackbar({ message: '行の並び順を更新しました。', color: 'success' })
  } catch (err) {
    console.error('Failed to reorder rows:', err)
    alert({
      title: 'エラー',
      message: '行の並び順の更新に失敗しました。',
    })
    // エラーが発生した場合はサーバーの状態に戻す
    await loadData()
  } finally {
    setIsLoading(false)
  }
}

// --- 行追加関連 ---
const isRowDialogVisible = ref(false)

const saveNewRow = async (name: string) => {
  // 行を追加するAPI呼び出し
  await upsertGanttRow({ id: 0, name, order: 0, tasks: [] })

  isRowDialogVisible.value = false
  await loadData()
}

// --- 行削除関連 ---
const isRowDeleteDialogVisible = ref(false)

const deleteRow = async (rowId: string) => {
  await deleteGanttRow(Number(rowId))
  isRowDeleteDialogVisible.value = false
  await loadData()
}
</script>

<template>
  <div v-if="user" class="gantt-app">
    <h2 class="mb-6">Moguchart (Vue)</h2>

    <div class="mb-4">
      <v-btn color="primary" @click="isRowDialogVisible = true">行追加</v-btn>
      <v-btn color="secondary" class="ml-2" @click="handleAddTask">
        タスク追加
      </v-btn>
      <v-btn
        color="error"
        class="ml-2"
        @click="isRowDeleteDialogVisible = true"
      >
        行削除
      </v-btn>
    </div>

    <div class="chart-container">
      <gantt-chart
        :rows="rows"
        :option="chartOption"
        :totalDays="totalDays"
        theme="dark"
        @task-update="handleTaskUpdate"
        @task-dblclick="handleTaskDblClick"
        @row-reordered="handleRowReordered"
      />
    </div>

    <TaskEditDialog
      v-model="isDialogVisible"
      :task="editingTask"
      :rows="rows"
      @save="saveTask"
      @delete="deleteTask"
    />

    <RowAddDialog v-model="isRowDialogVisible" @save="saveNewRow" />

    <RowDeleteDialog
      v-model="isRowDeleteDialogVisible"
      :rows="rows"
      @delete="deleteRow"
    />
  </div>
  <v-container v-else class="fill-height">
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="4">
        <v-card class="elevation-12">
          <v-toolbar color="primary" dark>
            <v-toolbar-title>Login Required</v-toolbar-title>
          </v-toolbar>
          <v-card-text>
            <p class="text-center">
              この機能を利用するにはログインが必要です。
            </p>
          </v-card-text>
          <v-card-actions class="justify-center">
            <v-btn color="primary" @click="signIn">Login with Google</v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.gantt-app {
  padding: 50px;
  font-family: sans-serif;
}

.chart-container {
  display: block;
  width: 100%;
  overflow-x: auto;
  border: 1px solid #444;
  background: #1e1e1e;
  box-sizing: border-box;
}
</style>
