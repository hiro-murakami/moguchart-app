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
  manualAddRowCount,
  unassignedTasks,
  isUnassignedTasksOpen,
  ganttChartRef,
  chartContextMenu,
  availableLabels,
  selectedFilterLabelNames,
  filteredRows,

  // methods
  handleTaskUpdate,
  handleTaskDblClick,
  saveTask,
  deleteTask,
  handleRowReordered,
  handleAddRow,
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
  handleTaskDragStart,
  handleTaskDragEnd,
  handleTaskDrop,
  handleChartContextMenu,
  handleCreateNewTask,
  selectAllLabels,
  clearAllLabels,
  isRowEditDialogVisible,
  editingRowData,
  handleEditRowFromContextMenu,
  saveRow,
  isProjectDetailDialogVisible,
  updateProject,
} = useGanttChartView()

const rowCountRules = [(v: number) => (v >= 1 && v <= 10) || '1〜10の範囲で入力してください']
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
            <v-btn
              v-if="!isReadOnly"
              icon="mdi-pencil"
              variant="text"
              density="compact"
              size="small"
              class="ml-2"
              @click="isProjectDetailDialogVisible = true"
            />
            <RoleChip :role="currentProject.role" class="ml-2" />
          </div>
          <div v-if="currentProject.attribute.description" class="text-caption text-medium-emphasis">
            {{ currentProject.attribute.description }}
          </div>
        </div>
        <v-spacer />
        <LabelFilter
          v-model="selectedFilterLabelNames"
          :available-labels="availableLabels"
          @select-all="selectAllLabels"
          @clear-all="clearAllLabels"
          class="mr-4"
        />
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
      </div>

      <div
        class="chart-container"
        :style="{
          position: 'relative',
          minWidth: 0,
          paddingRight: isReadOnly ? undefined : isUnassignedTasksOpen ? '248px' : '58px',
          transition: 'padding-right 0.3s ease',
        }"
      >
        <div>
          <gantt-chart
            ref="ganttChartRef"
            :rows="filteredRows"
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
            @task-drop="handleTaskDrop"
            @chart-contextmenu="handleChartContextMenu"
          />
        </div>

        <UnassignedTaskSidebar
          v-if="!isReadOnly"
          v-model:is-open="isUnassignedTasksOpen"
          :tasks="unassignedTasks"
          @drag-start="handleTaskDragStart"
          @drag-end="handleTaskDragEnd"
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

      <div v-if="!isReadOnly" class="mt-2 d-flex align-center">
        <v-text-field
          v-model.number="manualAddRowCount"
          type="number"
          label="行数"
          density="compact"
          hide-details="auto"
          variant="outlined"
          min="1"
          max="10"
          :rules="rowCountRules"
          style="max-width: 80px"
          class="mr-2 bg-surface"
          autocomplete="off"
        />
        <v-btn
          color="primary"
          variant="text"
          prepend-icon="mdi-plus"
          :disabled="!manualAddRowCount || manualAddRowCount < 1 || manualAddRowCount > 10"
          @click="handleAddRow(undefined, manualAddRowCount)"
        >
          行追加
        </v-btn>
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
      @edit-row="handleEditRowFromContextMenu"
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

    <!-- Chart Context Menu -->
    <ChartContextMenu
      v-model="chartContextMenu.visible"
      :x="chartContextMenu.x"
      :y="chartContextMenu.y"
      :date="chartContextMenu.date"
      :row-id="chartContextMenu.rowId"
      @new-task="handleCreateNewTask"
    />

    <TaskDetailDialog
      v-model="isDialogVisible"
      :task="editingTask"
      :rows="rows"
      @save="saveTask"
      @delete="deleteTask"
    />

    <RowEditDialog v-model="isRowEditDialogVisible" :row="editingRowData" @save="saveRow" />
    <ProjectDetailDialog
      v-if="currentProject"
      v-model="isProjectDetailDialogVisible"
      :project="currentProject"
      @save="updateProject"
    />
    <ProjectListDialog v-model="isProjectListDialogVisible" @select="setProjectId" @update="fetchProjects" />
  </div>
</template>

<style scoped>
@keyframes fade-out {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.9);
  }
}

@keyframes pop-in {
  0% {
    opacity: 0;
    transform: scale(0);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

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
  padding: 0 6px;
  z-index: 1000;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
}
.splash-image {
  border-radius: 24px;
}

.unassigned-tasks-sidebar {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  transition:
    width 0.3s ease,
    padding 0.3s ease;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .unassigned-tasks-sidebar {
    background: #1e293b;
    border-color: #334155;
  }
}

.sidebar-header {
  margin: 0;
  padding: 10px;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  font-size: 16px;
  cursor: pointer;
  user-select: none;
  writing-mode: vertical-rl;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
}

.sidebar-header.open {
  padding: 0;
  height: auto;
  writing-mode: horizontal-tb;
  gap: 4px;
}

.sidebar-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  flex-grow: 1;
  margin-top: 12px;
}

.draggable-task {
  padding: 12px;
  background: white;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  cursor: grab;
  user-select: none;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

@media (prefers-color-scheme: dark) {
  .draggable-task {
    background: #334155;
    border-color: #475569;
  }
}

.task-bar-preview {
  height: 16px;
  width: 100%;
  border-radius: 2px;
  margin-bottom: 8px;
}

.task-name {
  font-weight: bold;
  font-size: 14px;
  margin-bottom: 4px;
}

.task-duration {
  font-size: 12px;
  opacity: 0.7;
}

.empty-message {
  opacity: 0.5;
  font-size: 14px;
  text-align: center;
  padding: 20px;
}
</style>
