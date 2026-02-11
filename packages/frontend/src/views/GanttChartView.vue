<script setup lang="ts">
import splashImage from '@/assets/splash.png'
import { useGanttChartView } from '@/modules/useGanttChartView'

const {
  // state
  rows,
  selectedRowIds,
  selectedTaskIds,
  chartOption,
  isDialogVisible,
  editingTask,
  isProjectListDialogVisible,
  isReadOnly,
  editingRowId,
  editingRowName,
  editingInputStyle,
  contextMenu,
  taskContextMenu,
  currentProject,
  showHiddenRows,
  pxPerDay,
  addRowCount,

  // methods
  handleTaskUpdate,
  handleTaskDblClick,
  handleAddTask,
  saveTask,
  deleteTask,
  handleRowReordered,
  handleAddRow,
  deleteRow,
  handleRowHeaderDblClick,
  handleRowNameUpdate,
  cancelRowNameUpdate,
  handleRowHeaderContextMenu,
  handleAddRowAbove,
  handleAddRowBelow,
  handleDeleteRowFromContextMenu,
  fetchProjects,
  handleRowSelectionChange,
  toggleRowVisibility,
  setProjectId,
  handleTaskContextMenu,
  handleEditTaskFromContextMenu,
  handleDeleteTaskFromContextMenu,
  handleBarSelectionChange,
} = useGanttChartView()
</script>

<template>
  <div class="gantt-app">
    <template v-if="currentProject">
      <div class="mb-4 d-flex align-center" style="gap: 1rem">
        <v-btn
          icon="mdi-format-list-bulleted"
          variant="text"
          @click="isProjectListDialogVisible = true"
          title="プロジェクト一覧"
        />
        <div>
          <div class="d-flex align-center">
            <span class="text-h6">{{ currentProject.name }}</span>
            <RoleChip :role="currentProject.role" class="ml-2" />
          </div>
          <div v-if="currentProject.attribute.description" class="text-caption text-medium-emphasis">
            {{ currentProject.attribute.description }}
          </div>
        </div>
        <v-spacer />
        <v-switch
          v-model="showHiddenRows"
          label="非表示行を表示"
          color="primary"
          hide-details
          density="compact"
          class="mr-4"
        />
        <v-btn
          icon="mdi-magnify-minus"
          variant="text"
          density="compact"
          size="small"
          @click="pxPerDay = Math.max(10, pxPerDay - 5)"
        />
        <v-slider
          v-model="pxPerDay"
          :min="10"
          :max="80"
          :step="5"
          hide-details
          density="compact"
          style="max-width: 120px"
          class="mx-0"
        />
        <v-btn
          icon="mdi-magnify-plus"
          variant="text"
          density="compact"
          size="small"
          @click="pxPerDay = Math.min(80, pxPerDay + 5)"
        />
        <template v-if="!isReadOnly">
          <v-btn color="secondary" @click="handleAddTask"> タスク追加 </v-btn>
        </template>
      </div>

      <div class="chart-container">
        <gantt-chart
          :rows="rows"
          :selected-row-ids="selectedRowIds"
          :option="chartOption"
          @task-update="handleTaskUpdate"
          @task-dblclick="handleTaskDblClick"
          @task-contextmenu="handleTaskContextMenu"
          @row-header-dblclick="handleRowHeaderDblClick"
          @row-reordered="handleRowReordered"
          @row-header-contextmenu="handleRowHeaderContextMenu"
          @row-selection-change="handleRowSelectionChange"
          @bar-selection-change="handleBarSelectionChange"
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
        <v-btn color="primary" variant="text" prepend-icon="mdi-plus" @click="handleAddRow()"> 行追加 </v-btn>
      </div>
    </template>

    <div v-else class="d-flex flex-column align-center justify-center flex-grow-1">
      <img :src="splashImage" height="500" class="splash-image mb-6" alt="MoguChart" />
      <p class="text-subtitle-1 text-medium-emphasis mb-8">プロジェクトを選択してガントチャートを表示します</p>
      <v-btn
        color="primary"
        size="large"
        prepend-icon="mdi-format-list-bulleted"
        @click="isProjectListDialogVisible = true"
      >
        プロジェクト一覧を開く
      </v-btn>
    </div>

    <!-- Row Context Menu -->
    <RowHeaderContextMenu
      v-model="contextMenu.visible"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :selected-row-ids="selectedRowIds"
      :row-id="contextMenu.rowId"
      :is-hidden="contextMenu.isHidden"
      :add-row-count="addRowCount"
      @add-row-above="handleAddRowAbove"
      @add-row-below="handleAddRowBelow"
      @delete-row="handleDeleteRowFromContextMenu"
      @toggle-visibility="toggleRowVisibility"
    />

    <!-- Task Context Menu -->
    <TaskContextMenu
      v-model="taskContextMenu.visible"
      :x="taskContextMenu.x"
      :y="taskContextMenu.y"
      :task-id="taskContextMenu.taskId"
      :selected-task-ids="selectedTaskIds"
      @edit="handleEditTaskFromContextMenu"
      @delete="handleDeleteTaskFromContextMenu"
    />

    <TaskDetailDialog
      v-model="isDialogVisible"
      :task="editingTask"
      :rows="rows"
      @save="saveTask"
      @delete="deleteTask"
    />

    <ProjectListDialog v-model="isProjectListDialogVisible" @select="setProjectId" @update="fetchProjects" />
  </div>
</template>

<style scoped>
.gantt-app {
  padding: 30px;
  font-family: sans-serif;
  min-height: calc(100vh - 64px);
  display: flex;
  flex-direction: column;
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
.splash-image {
  border-radius: 24px;
}
</style>
