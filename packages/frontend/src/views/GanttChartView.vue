<script setup lang="ts">
import splashImage from '@/assets/splash.png'
import { useGanttChartView } from './composables/useGanttChartView'
import { onMounted, onUnmounted } from 'vue'

const {
  // state
  isSnapshotMode,
  rows,
  selectedRowIds,
  selectedTaskIds,
  chartOption,
  isDialogVisible,
  editingTask,
  isProjectListDialogVisible,
  isReadOnly,
  isOwner,
  editingRowId,
  editingRowName,
  editingInputStyle,
  contextMenu,
  taskContextMenu,
  currentProject,
  showHiddenRows,
  pxPerDay,
  barHeight,
  addRowCount,
  manualAddRowCount,
  isUnassignedTasksOpen,
  ganttChartRef,
  chartContextMenu,
  availableLabels,
  selectedFilterLabelNames,
  filteredRows,
  isRowEditDialogVisible,
  editingRowData,
  isProjectDetailDialogVisible,
  searchText,
  searchIncludeRows,
  canUndo,
  canRedo,
  activeUsers,
  editLogs,
  isCommentDialogVisible,
  commentDialogTaskId,
  commentDialogRowId,
  commentDialogProjectId,
  commentDialogTargetName,
  isSnapshotListDialogVisible,
  projectId,

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
  handleEditRowFromContextMenu,
  saveRow,
  updateProject,
  handleRowHeaderResize,
  undo,
  redo,
  refresh,
  handleAddCommentFromContextMenu,
  handleAddCommentToRow,
  handleAddCommentToProject,
  handleCommentUpdated,
  handleSelectTaskFromLog,
  handleDblClickTaskFromLog,
  handleCreateSnapshot,
  handleCopyTasksFromContextMenu,
  handlePasteTasksFromContextMenu,
  handleCopyTasksShortcut,
  handlePasteTasksShortcut,
  hasClipboardData,
  projectComments,
  isProjectCommentsLoading,
  fetchProjectComments,
} = useGanttChartView()

const rowCountRules = [(v: number) => (v >= 1 && v <= 10) || '1〜10の範囲で入力してください']

// キーボードショートカット
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.metaKey || e.ctrlKey) {
    const key = e.key.toLowerCase()
    if (key === 'z') {
      if (e.shiftKey) {
        // Cmd+Shift+Z (Mac) は redo、Ctrl+Shift+Z (Windows) は無視する
        if (e.metaKey) {
          e.preventDefault()
          redo()
        }
      } else {
        e.preventDefault()
        undo()
      }
    } else if (key === 'y') {
      e.preventDefault()
      redo()
    } else if (key === 'c') {
      e.preventDefault()
      handleCopyTasksShortcut()
    } else if (key === 'v') {
      e.preventDefault()
      handlePasteTasksShortcut(e)
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <div class="gantt-app">
    <template v-if="currentProject">
      <div class="mb-4 d-flex align-center" style="gap: 1rem">
        <TooltipBtn
          v-if="!isSnapshotMode"
          icon="mdi-format-list-bulleted"
          variant="text"
          @click="isProjectListDialogVisible = true"
          tooltip="プロジェクト一覧"
        />
        <div>
          <div class="d-flex align-center">
            <span class="text-h6">{{ currentProject.name }}</span>
            <TooltipBtn
              v-if="isOwner"
              icon="mdi-pencil"
              variant="text"
              class="ml-2"
              @click="isProjectDetailDialogVisible = true"
              tooltip="プロジェクト詳細"
            />
            <TooltipBtn v-if="!isSnapshotMode" icon="mdi-refresh" variant="text" @click="refresh" tooltip="最新化" />
            <TooltipBtn
              v-if="!isSnapshotMode && !isReadOnly"
              icon="mdi-camera"
              variant="text"
              @click="handleCreateSnapshot"
              tooltip="スナップショット作成"
            />
            <TooltipBtn
              v-if="!isSnapshotMode"
              icon="mdi-image-multiple"
              variant="text"
              @click="isSnapshotListDialogVisible = true"
              tooltip="スナップショット一覧"
            />
            <ProjectCommentButton
              :comment-count="currentProject.commentCount ?? 0"
              :comments="projectComments"
              :loading="isProjectCommentsLoading"
              :snapshot-mode="isSnapshotMode"
              @click="handleAddCommentToProject"
              @fetch="fetchProjectComments"
            />
            <RoleChip :role="isSnapshotMode ? 'snapshot' : currentProject.role" class="ml-2" />
          </div>
          <div v-if="currentProject.attribute.description" class="text-caption text-medium-emphasis">
            {{ currentProject.attribute.description }}
          </div>
        </div>
        <v-spacer />
        <div v-if="activeUsers.length > 0" class="d-flex align-center mr-4" style="gap: -4px">
          <v-tooltip v-for="user in activeUsers" :key="user.email" :text="user.displayName" location="bottom">
            <template v-slot:activator="{ props }">
              <UserAvatar
                v-bind="props"
                :color="user.color"
                size="32"
                class="presence-avatar"
                :url="user.avatarUrl"
                :name="user.displayName"
              />
            </template>
          </v-tooltip>
        </div>
        <v-text-field
          v-model="searchText"
          prepend-inner-icon="mdi-magnify"
          label="フリーワード検索"
          density="compact"
          hide-details
          variant="outlined"
          clearable
          class="search-text-field"
          autocomplete="off"
        />
        <v-checkbox
          v-if="searchText"
          v-model="searchIncludeRows"
          label="行も検索"
          density="compact"
          hide-details
          class="search-include-rows"
        />
        <LabelFilter
          v-model="selectedFilterLabelNames"
          :available-labels="availableLabels"
          @select-all="selectAllLabels"
          @clear-all="clearAllLabels"
        />
        <v-menu :close-on-content-click="false" location="bottom end">
          <template #activator="{ props: menuProps }">
            <TooltipBtn v-bind="menuProps" icon="mdi-cog" variant="text" tooltip="表示設定" />
          </template>
          <v-card min-width="280" class="pa-4">
            <div class="text-subtitle-2 mb-3">表示設定</div>
            <v-switch
              v-model="showHiddenRows"
              label="非表示行を表示"
              color="primary"
              hide-details
              density="compact"
              class="mb-4"
            />
            <div class="text-caption text-medium-emphasis mb-1">表示倍率</div>
            <ZoomControls v-model="pxPerDay" />
            <div class="text-caption text-medium-emphasis mb-1 mt-3">バーの高さ</div>
            <v-btn-toggle
              :model-value="barHeight"
              @update:model-value="
                (v: number) => {
                  if (v != null) barHeight = v
                }
              "
              mandatory
              density="compact"
              color="primary"
              class="w-100"
            >
              <v-btn :value="32" size="medium" class="flex-grow-1">小</v-btn>
              <v-btn :value="38" size="medium" class="flex-grow-1">中</v-btn>
              <v-btn :value="48" size="medium" class="flex-grow-1">大</v-btn>
              <v-btn :value="56" size="medium" class="flex-grow-1">特大</v-btn>
            </v-btn-toggle>
          </v-card>
        </v-menu>
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
            @row-header-resize="handleRowHeaderResize"
          />
        </div>

        <UnassignedTaskSidebar
          v-if="!isReadOnly"
          v-model:is-open="isUnassignedTasksOpen"
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
        <v-icon icon="mdi-plus" size="small" class="mr-2" />
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
          class="bg-surface"
          autocomplete="off"
        />
        <v-btn
          color="primary"
          variant="text"
          :disabled="!manualAddRowCount || manualAddRowCount < 1 || manualAddRowCount > 10"
          @click="handleAddRow(undefined, manualAddRowCount)"
        >
          行追加
        </v-btn>
      </div>
    </template>

    <div v-else class="d-flex flex-column align-center justify-center flex-grow-1">
      <img :src="splashImage" height="500" class="splash-image mb-6" alt="MoguChart" />
      <p v-if="!isSnapshotMode" class="text-subtitle-1 text-medium-emphasis mb-8">
        プロジェクトを選択してガントチャートを表示します
      </p>
      <v-btn
        v-if="!isSnapshotMode"
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
      @add-comment="handleAddCommentToRow"
    />

    <!-- Task Context Menu -->
    <TaskContextMenu
      v-model="taskContextMenu.visible"
      :x="taskContextMenu.x"
      :y="taskContextMenu.y"
      :task-id="taskContextMenu.taskId"
      :selected-task-ids="selectedTaskIds"
      :is-read-only="isReadOnly"
      @edit="handleEditTaskFromContextMenu"
      @comment="handleAddCommentFromContextMenu"
      @copy="handleCopyTasksFromContextMenu"
      @delete="handleDeleteTaskFromContextMenu"
    />

    <!-- Comment Dialog -->
    <CommentDialog
      v-model="isCommentDialogVisible"
      :task-id="commentDialogTaskId"
      :row-id="commentDialogRowId"
      :project-id="commentDialogProjectId"
      :target-name="commentDialogTargetName"
      :is-read-only="isReadOnly"
      :user-role="currentProject?.role"
      @updated="handleCommentUpdated"
    />

    <!-- Chart Context Menu -->
    <ChartContextMenu
      v-model="chartContextMenu.visible"
      :x="chartContextMenu.x"
      :y="chartContextMenu.y"
      :date="chartContextMenu.date"
      :row-id="chartContextMenu.rowId"
      :can-undo="canUndo"
      :can-redo="canRedo"
      :has-clipboard="hasClipboardData"
      @new-task="handleCreateNewTask"
      @paste="handlePasteTasksFromContextMenu"
      @undo="undo"
      @redo="redo"
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

    <!-- Collaboration Activity Log -->
    <CollaborationActivityLog
      :logs="editLogs"
      @click-task="handleSelectTaskFromLog"
      @dblclick-task="handleDblClickTaskFromLog"
    />

    <!-- Snapshot List Dialog -->
    <SnapshotListDialog
      v-if="projectId"
      v-model="isSnapshotListDialogVisible"
      :project-id="projectId"
      @restored="refresh"
    />
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
  --task-box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  padding: 30px;
  font-family: sans-serif;
  min-height: calc(100vh - 64px);
  display: flex;
  flex-direction: column;
}

:global(.v-theme--dark) .gantt-app {
  --task-box-shadow: 0 3px 6px rgba(0, 0, 0, 0.8);
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
.search-text-field {
  max-width: 500px;
  min-width: 250px;
}
.presence-avatar {
  border: 2px solid rgb(var(--v-theme-surface));
  margin-left: -6px;
  cursor: default;
  transition: transform 0.15s ease;
}
.presence-avatar:first-child {
  margin-left: 0;
}
.presence-avatar:hover {
  transform: translateY(-2px);
  z-index: 1;
}
</style>
