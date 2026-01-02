<script setup lang="ts">
import { ref, computed } from "vue";
import "@mogura/moguchart";
import type {
  GanttRow,
  RenderBarContentEventDetail,
  GanttChartOption,
} from "@mogura/moguchart";

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

const rows = ref<GanttRow[]>([
  {
    id: "1",
    label: "要件定義",
    tasks: [
      {
        id: "1-1",
        name: "ヒアリング",
        start: new Date("2025-12-15T00:00:00"),
        end: new Date("2025-12-18T00:00:00"),
      },
      {
        id: "1-2",
        name: "要件定義書作成",
        start: new Date("2025-12-19T00:00:00"),
        end: new Date("2025-12-24T00:00:00"),
      },
    ],
  },
  {
    id: "2",
    label: "設計",
    tasks: [
      {
        id: "2-1",
        name: "基本設計",
        start: new Date("2025-12-25T00:00:00"),
        end: new Date("2025-12-30T00:00:00"),
      },
      {
        id: "2-2",
        name: "詳細設計",
        start: new Date("2026-01-05T00:00:00"),
        end: new Date("2026-01-10T00:00:00"),
      },
      {
        id: "2-3",
        name: "DB設計",
        start: new Date("2025-12-28T00:00:00"),
        end: new Date("2026-01-04T00:00:00"),
      },
      {
        id: "2-4",
        name: "UIデザイン",
        start: new Date("2026-01-05T00:00:00"),
        end: new Date("2026-01-15T00:00:00"),
      },
    ],
  },
  {
    id: "3",
    label: "開発",
    tasks: [
      {
        id: "3-1",
        name: "環境構築",
        start: new Date("2026-01-10T00:00:00"),
        end: new Date("2026-01-12T00:00:00"),
      },
      {
        id: "3-2",
        name: "バックエンド実装",
        start: new Date("2026-01-13T00:00:00"),
        end: new Date("2026-01-25T00:00:00"),
      },
      {
        id: "3-3",
        name: "フロントエンド実装",
        start: new Date("2026-01-16T00:00:00"),
        end: new Date("2026-01-28T00:00:00"),
      },
      {
        id: "3-4",
        name: "API連携",
        start: new Date("2026-01-26T00:00:00"),
        end: new Date("2026-01-30T00:00:00"),
      },
    ],
  },
  {
    id: "4",
    label: "テスト",
    tasks: [
      {
        id: "4-1",
        name: "単体テスト",
        start: new Date("2026-01-25T00:00:00"),
        end: new Date("2026-01-31T00:00:00"),
      },
      {
        id: "4-2",
        name: "結合テスト",
        start: new Date("2026-02-01T00:00:00"),
        end: new Date("2026-02-07T00:00:00"),
      },
      {
        id: "4-3",
        name: "QA対応",
        start: new Date("2026-02-08T00:00:00"),
        end: new Date("2026-02-12T00:00:00"),
      },
    ],
  },
  {
    id: "5",
    label: "リリース",
    tasks: [
      {
        id: "5-1",
        name: "リリース準備",
        start: new Date("2026-02-10T00:00:00"),
        end: new Date("2026-02-12T00:00:00"),
      },
      {
        id: "5-2",
        name: "本番リリース",
        start: new Date("2026-02-13T00:00:00"),
        end: new Date("2026-02-13T00:00:00"),
      },
    ],
  },
]);

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

// --- ロジック ---

function handleRowsChange(e: CustomEvent) {
  rows.value = e.detail;
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
