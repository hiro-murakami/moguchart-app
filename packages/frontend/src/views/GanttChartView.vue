<script setup lang="ts">
import ProjectDialog from '@/components/ProjectDialog.vue'
import { useGanttChartView } from '@/modules/useGanttChartView'

const {
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
} = useGanttChartView()
</script>

<template>
  <div class="gantt-app">
    <h2 class="mb-6">Moguchart (Vue)</h2>

    <div class="mb-4 d-flex align-center" style="gap: 1rem">
      <v-select
        v-model="projectId"
        :items="projects"
        item-title="name"
        item-value="id"
        label="プロジェクトを選択"
        :disabled="projects.length === 0"
        density="compact"
        style="max-width: 300px"
      />
      <v-btn color="primary" @click="openProjectDialog(false)">
        プロジェクト追加
      </v-btn>
      <v-btn
        color="primary"
        :disabled="!projectId"
        @click="openProjectDialog(true)"
      >
        プロジェクト編集
      </v-btn>
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

    <ProjectDialog
      v-model="isProjectDialogVisible"
      :project="editingProject"
      @save="saveProject"
    />
  </div>
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
