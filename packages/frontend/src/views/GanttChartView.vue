<script setup lang="ts">
import { useGanttChartView } from '@/modules/useGanttChartView'
import { computed } from 'vue'

const {
  // state
  projects,
  projectId,
  rows,
  chartOption,
  isDialogVisible,
  editingTask,
  isRowDeleteDialogVisible,
  isProjectListDialogVisible,
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
  handleRowHeaderDblClick,
  handleRowNameUpdate,
  cancelRowNameUpdate,
  handleRowHeaderContextMenu,
  handleAddRowAbove,
  handleAddRowBelow,
  handleDeleteRowFromContextMenu,
} = useGanttChartView()

const currentProject = computed(() =>
  projects.value.find((p) => p.id === projectId.value),
)
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
          <div
            v-if="currentProject.attribute.description"
            class="text-caption text-medium-emphasis"
          >
            {{ currentProject.attribute.description }}
          </div>
        </div>
        <v-spacer />
        <template v-if="!isReadOnly">
          <v-btn color="secondary" @click="handleAddTask"> タスク追加 </v-btn>
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
    </template>

    <div
      v-else
      class="d-flex flex-column align-center justify-center flex-grow-1"
    >
      <v-icon icon="mdi-chart-gantt" size="128" color="primary" class="mb-6" />
      <h1 class="text-h3 font-weight-bold mb-2">MoguChart</h1>
      <p class="text-subtitle-1 text-medium-emphasis mb-8">
        プロジェクトを選択してガントチャートを表示します
      </p>
      <v-btn
        color="primary"
        size="large"
        prepend-icon="mdi-format-list-bulleted"
        @click="isProjectListDialogVisible = true"
      >
        プロジェクト一覧を開く
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

    <ProjectListDialog
      v-model="isProjectListDialogVisible"
      @select="(id: string) => (projectId = id)"
    />
  </div>
</template>

<style scoped>
.gantt-app {
  padding: 50px;
  font-family: sans-serif;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
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
