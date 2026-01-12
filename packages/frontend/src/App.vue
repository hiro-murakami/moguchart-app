<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import "@mogura/moguchart";
import type { GanttRow, GanttChartOption } from "@mogura/moguchart";

// --- 設定値 ---
const chartStartStr = ref("2025-12-15");
const pxPerDay = ref(28);
const totalDays = ref(90);
const barHeight = ref(28);
const barMargin = ref(4);
const barCornerRadius = ref(4);
const labelWidth = ref(150);

// --- 状態 ---
const isReadOnly = ref(false);

const rows = ref<GanttRow[]>([]);

const inputChartOption = computed<GanttChartOption>(() => ({
  bar: {
    height: barHeight.value,
    margin: barMargin.value,
    cornerRadius: barCornerRadius.value,
  },
  label: {
    width: labelWidth.value,
  },
  calendar: {
    start: new Date(chartStartStr.value + "T00:00:00"),
    pxPerDay: pxPerDay.value,
    totalDays: totalDays.value,
  },
  readOnly: isReadOnly.value,
}));

// --- 適用される設定 ---
const appliedChartOption = ref(inputChartOption.value);
const appliedTotalDays = ref(totalDays.value);

const isSettingsChanged = computed(() => {
  return (
    totalDays.value !== appliedTotalDays.value ||
    JSON.stringify(inputChartOption.value) !==
      JSON.stringify(appliedChartOption.value)
  );
});

function applySettings() {
  appliedChartOption.value = inputChartOption.value;
  appliedTotalDays.value = totalDays.value;
}

// --- データ永続化ロジック ---
const API_URL = "http://localhost:3001/api/gantt";

async function loadData() {
  try {
    const res = await fetch(API_URL);
    if (res.ok) {
      const data = await res.json();
      // JSONから取得した日付文字列をDateオブジェクトに変換
      rows.value = data.map((row: any) => ({
        ...row,
        tasks: row.tasks.map((task: any) => ({
          ...task,
          start: new Date(task.start),
          end: new Date(task.end),
        })),
      }));
    }
  } catch (err) {
    console.error("Failed to load data:", err);
  }
}

async function saveData(newRows: GanttRow[]) {
  try {
    await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newRows),
    });
  } catch (err) {
    console.error("Failed to save data:", err);
  }
}

onMounted(() => {
  loadData();
});

async function handleRowsChange(e: CustomEvent) {
  rows.value = e.detail;
  await saveData(rows.value);
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
          @rows-change="handleRowsChange"
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
