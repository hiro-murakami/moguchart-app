<script setup lang="ts">
import { selectGanttChart, upsertGanttTask } from '@/modules/scripts'
import type { GanttRow, GanttTask } from '@functions/types/shared'
import '@mogura/moguchart'
import type { TaskUpdateEventDetail } from '@mogura/moguchart'
import * as moguchart from '@mogura/moguchart'
import { computed, onMounted, ref } from 'vue'
import { toDateString } from '@/modules/utils'

// --- 設定値 ---
const chartStartStr = ref('2025-12-15')
const pxPerDay = ref(28)
const totalDays = ref(90)
const barHeight = ref(28)
const barMargin = ref(4)
const barCornerRadius = ref(4)
const labelWidth = ref(150)

// --- 状態 ---
const isReadOnly = ref(false)

const rows = ref<moguchart.GanttRow[]>([])

const inputChartOption = computed<moguchart.GanttChartOption>(() => ({
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
  readOnly: isReadOnly.value,
}))

// --- 適用される設定 ---
const appliedChartOption = ref(inputChartOption.value)
const appliedTotalDays = ref(totalDays.value)

const isSettingsChanged = computed(() => {
  return (
    totalDays.value !== appliedTotalDays.value ||
    JSON.stringify(inputChartOption.value) !==
      JSON.stringify(appliedChartOption.value)
  )
})

function applySettings() {
  appliedChartOption.value = inputChartOption.value
  appliedTotalDays.value = totalDays.value
}

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
  console.log('handleTaskUpdate', e.detail)
  const data = {
    id: Number(e.detail.id),
    rowId: Number(e.detail.targetRowId),
    name: e.detail.name || '',
    start: toDateString(e.detail.start),
    end: toDateString(e.detail.end),
  }
  await upsertGanttTask(data)
}
</script>

<template>
  <v-app theme="dark">
    <div class="gantt-app">
      <h2 class="mb-6">Moguchart (Vue)</h2>

      <div class="controls">
        <v-row>
          <v-col cols="12" sm="6" md="4">
            <v-text-field
              label="開始日"
              type="date"
              v-model="chartStartStr"
              variant="outlined"
              density="compact"
              hide-details
            />
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-text-field
              label="日数"
              type="number"
              v-model.number="totalDays"
              variant="outlined"
              density="compact"
              suffix="日"
              hide-details
            />
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-text-field
              label="1日の幅"
              type="number"
              v-model.number="pxPerDay"
              variant="outlined"
              density="compact"
              suffix="px"
              hide-details
            />
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-text-field
              label="ラベル幅"
              type="number"
              v-model.number="labelWidth"
              variant="outlined"
              density="compact"
              suffix="px"
              hide-details
            />
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-text-field
              label="バー高さ"
              type="number"
              v-model.number="barHeight"
              variant="outlined"
              density="compact"
              suffix="px"
              hide-details
            />
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-text-field
              label="バー間隔"
              type="number"
              v-model.number="barMargin"
              variant="outlined"
              density="compact"
              suffix="px"
              hide-details
            />
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-checkbox
              label="Read Only"
              v-model="isReadOnly"
              density="compact"
              hide-details
            />
          </v-col>
        </v-row>
        <v-row class="mt-2">
          <v-col>
            <v-btn
              color="primary"
              @click="applySettings"
              :disabled="!isSettingsChanged"
            >
              設定を反映
            </v-btn>
          </v-col>
        </v-row>
      </div>

      <div class="chart-container">
        <gantt-chart
          :rows="rows"
          :option="appliedChartOption"
          :totalDays="appliedTotalDays"
          theme="dark"
          @task-update="handleTaskUpdate"
        />
      </div>
    </div>
  </v-app>
</template>

<style scoped>
.gantt-app {
  padding: 50px;
  font-family: sans-serif;
}

.controls {
  margin-bottom: 16px;
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
