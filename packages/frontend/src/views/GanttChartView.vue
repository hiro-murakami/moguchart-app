<script setup lang="ts">
import { useGanttChartView } from '@/modules/useGanttChartView'

const {
  // state
  projects,
  projectId,
  rows,
  chartOption,
  isDialogVisible,
  editingTask,
  isRowDeleteDialogVisible,
  isProjectDialogVisible,
  editingProject,
  isReadOnly,
  editingRowId,
  editingRowName,
  editingInputStyle,
  contextMenu,

  // methods
  handleTaskUpdate,
  handleTaskDblClick,
  handleAddTask,
  saveTask,
  deleteTask,
  handleRowReordered,
  handleAddRow,
  deleteRow,
  saveProject,
  openProjectDialog,
  handleRowHeaderDblClick,
  handleRowNameUpdate,
  cancelRowNameUpdate,
  handleRowHeaderContextMenu,
  closeContextMenu,
  handleAddRowAbove,
  handleAddRowBelow,
  handleDeleteRowFromContextMenu,
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
        hide-details
        style="max-width: 300px"
        autocomplete="off"
      >
        <template #selection="{ item }">
          <span>{{ item.raw.name }}</span>
          <RoleChip :role="item.raw.role" class="ml-2" />
        </template>
        <template #item="{ props, item }">
          <v-list-item v-bind="props" :title="item.raw.name">
            <template #append>
              <RoleChip :role="item.raw.role" />
            </template>
          </v-list-item>
        </template>
      </v-select>
      <v-btn color="primary" @click="openProjectDialog(false)">
        プロジェクト追加
      </v-btn>
      <template v-if="!isReadOnly">
        <v-btn
          color="primary"
          :disabled="!projectId"
          @click="openProjectDialog(true)"
        >
          プロジェクト編集
        </v-btn>
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
      </template>
    </div>

    <div class="chart-container">
      <gantt-chart
        :rows="rows"
        :option="chartOption"
        theme="dark"
        @task-update="handleTaskUpdate"
        @task-dblclick="handleTaskDblClick"
        @row-header-dblclick="handleRowHeaderDblClick"
        @row-reordered="handleRowReordered"
        @row-header-contextmenu="handleRowHeaderContextMenu"
      />

      <input
        v-if="editingRowId !== null"
        id="row-edit-input"
        v-model="editingRowName"
        class="row-edit-input"
        :style="{
          top: editingInputStyle.top,
          left: editingInputStyle.left,
          width: editingInputStyle.width,
          height: editingInputStyle.height,
        }"
        autocomplete="off"
        @keydown.enter="handleRowNameUpdate"
        @keydown.esc="cancelRowNameUpdate"
        @blur="cancelRowNameUpdate()"
      />
    </div>

    <div v-if="!isReadOnly" class="mt-2">
      <v-btn
        color="primary"
        variant="text"
        prepend-icon="mdi-plus"
        @click="handleAddRow()"
      >
        行追加
      </v-btn>
    </div>

    <!-- Context Menu -->
    <RowHeaderContextMenu
      v-model="contextMenu.visible"
      :x="contextMenu.x"
      :y="contextMenu.y"
      @add-row-above="handleAddRowAbove"
      @add-row-below="handleAddRowBelow"
      @delete-row="handleDeleteRowFromContextMenu"
    />

    <TaskEditDialog
      v-model="isDialogVisible"
      :task="editingTask"
      :rows="rows"
      @save="saveTask"
      @delete="deleteTask"
    />

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
.row-edit-input {
  position: fixed;
  background: #333;
  color: white;
  border: 1px solid #007bff;
  padding: 0 4px;
  z-index: 1000;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
}
</style>
