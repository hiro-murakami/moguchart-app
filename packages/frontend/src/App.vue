<script setup lang="ts">
import {
  selectGanttChart,
  upsertGanttTask,
  upsertGanttRow,
  deleteGanttRow,
  deleteGanttTask,
} from '@/modules/scripts'
import type { GanttRow, GanttTask } from '@functions/types/shared'
import '@mogura/moguchart'
import type {
  TaskClickEventDetail,
  TaskUpdateEventDetail,
} from '@mogura/moguchart'
import * as moguchart from '@mogura/moguchart'
import { computed, onMounted, ref } from 'vue'
import { toDateString } from '@/modules/utils'

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
  readOnly: isReadOnly.value,
}))

// --- データ永続化ロジック ---

async function loadData() {
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
  }
}

onMounted(() => {
  loadData()
})

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

const handleAddTask = () => {
  if (rows.value.length === 0 || !rows.value[0]?.id) {
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

// --- 行追加関連 ---
const isRowDialogVisible = ref(false)

const saveNewRow = async (name: string) => {
  // 行を追加するAPI呼び出し
  await upsertGanttRow({ id: 0, name, tasks: [] })

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
  <v-app theme="dark">
    <div class="gantt-app">
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
  </v-app>
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
