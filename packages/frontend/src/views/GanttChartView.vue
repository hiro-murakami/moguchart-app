<script setup lang="ts">
import splashImage from '@/assets/splash2.png'
import { useGanttChartView } from './composables/useGanttChartView'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useTheme } from 'vuetify'
import ProjectCommentPanel from '@/components/ProjectCommentPanel.vue'
import { useUserStore } from '@/stores/useUserStore'

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
  hasLockedTaskInContextMenu,
  currentProject,
  showHiddenRows,
  showCurrentTimeLine,
  barShadowLevel,
  readonlyMode,
  currentRole,
  pxPerDay,
  pxPerMonth,
  pxPerHour,
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
  handleProjectCommentPanelUpdated,
  handleSelectTaskFromLog,
  handleClickLogFromActivity,
  handleDblClickTaskFromLog,
  handleCreateSnapshot,
  handleCopyTasksFromContextMenu,
  handlePasteTasksFromContextMenu,
  handleCopyTasksShortcut,
  handlePasteTasksShortcut,
  hasClipboardData,
  projectComments,
  exportAsCsv,
  exportAsExcel,
  exportAsPng,
  exportAsPdf,
  commentSidebarOpen,
  commentSidebarWidth,
  effectiveCommentSidebarWidth,
  handleDependencyCreate,
  dependencyContextMenu,
  handleDependencyClick,
  handleDeleteDependencyFromContextMenu,
} = useGanttChartView()

const projectCommentPanelRef = ref<InstanceType<typeof ProjectCommentPanel>>()
const userStore = useUserStore()
const vuetifyTheme = useTheme()

// ダーク/ライトテーマに対応した影のCSS変数値を計算
const barShadowCssVar = computed(() => {
  const dark = vuetifyTheme.global.current.value.dark
  const shadowMap = {
    none: 'none',
    // ダークモード: 白系の影でダーク背景との対比を出す
    small: dark ? '0 1px 6px rgba(255,255,255,0.30), 0 1px 3px rgba(0,0,0,0.5)' : '0 1px 2px rgba(0,0,0,0.07)',
    medium: dark ? '0 2px 8px rgba(255,255,255,0.40), 0 2px 4px rgba(0,0,0,0.6)' : '0 1px 4px rgba(0,0,0,0.13)',
    large: dark ? '0 2px 10px rgba(255,255,255,0.50), 0 2px 5px rgba(0,0,0,0.7)' : '0 2px 6px rgba(0,0,0,0.20)',
  }
  return shadowMap[barShadowLevel.value]
})

/**
 * プロジェクトの authority のいずれかに自分のメールアドレスが含まれる場合にコメント入力可
 * snapshotMode 中は常に false
 */
const canComment = computed(() => {
  if (isSnapshotMode.value) return false
  const email = userStore.currentUser?.email
  if (!email || !currentProject.value) return false
  const auth = currentProject.value.authority
  return (
    (auth.owners ?? []).includes(email) || (auth.editors ?? []).includes(email) || (auth.viewers ?? []).includes(email)
  )
})

// キーボードショートカット
const handleKeyDown = (e: KeyboardEvent) => {
  // テキスト入力系の要素にフォーカスがある場合はブラウザ標準の動作を優先する
  const target = e.target as HTMLElement | null
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
    return
  }

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

const handleExportCsv = () => {
  if (currentProject.value) {
    exportAsCsv(filteredRows.value, currentProject.value.name)
  }
}

const handleExportExcel = () => {
  if (currentProject.value) {
    exportAsExcel(filteredRows.value, currentProject.value.name)
  }
}

const handleExportPng = async () => {
  if (currentProject.value) {
    await exportAsPng(currentProject.value.name)
  }
}

const handleExportPdf = async () => {
  if (currentProject.value) {
    await exportAsPdf(currentProject.value.name)
  }
}
</script>

<template>
  <div
    class="gantt-app"
    :style="{
      paddingRight: currentProject ? `${effectiveCommentSidebarWidth + 8}px` : undefined,
      '--task-box-shadow': barShadowCssVar,
    }"
  >
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
            <RoleChip :role="isSnapshotMode ? 'snapshot' : currentProject.role" class="mr-2" />
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
            <ExportMenu
              @export-csv="handleExportCsv"
              @export-excel="handleExportExcel"
              @export-png="handleExportPng"
              @export-pdf="handleExportPdf"
            />
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
                :is-anonymous="!user.avatarUrl"
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
          class="mr-n2"
          v-model="selectedFilterLabelNames"
          :available-labels="availableLabels"
          @select-all="selectAllLabels"
          @clear-all="clearAllLabels"
        />

        <DisplaySettingsMenu
          v-model:show-hidden-rows="showHiddenRows"
          v-model:show-current-time-line="showCurrentTimeLine"
          v-model:bar-shadow-level="barShadowLevel"
          v-model:px-per-day="pxPerDay"
          v-model:px-per-month="pxPerMonth"
          v-model:px-per-hour="pxPerHour"
          v-model:bar-height="barHeight"
          v-model:readonly-mode="readonlyMode"
          :can-edit="currentRole !== 'viewer'"
          :granularity="currentProject?.attribute?.granularity"
        />
      </div>

      <div
        class="chart-container"
        :style="{
          position: 'relative',
          minWidth: 0,
          minHeight: 0,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          paddingRight: isReadOnly ? undefined : isUnassignedTasksOpen ? '248px' : '58px',
          transition: 'padding-right 0.3s ease',
        }"
      >
        <div style="flex: 1; min-height: 0">
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
            @dependency-create="handleDependencyCreate"
            @dependency-click="handleDependencyClick"
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

        <!-- 行追加 FAB + ダイアログ -->
        <AddRowDialog v-if="!isReadOnly" @add="(count: number) => handleAddRow(undefined, count)">
          <template #activator="{ props: menuProps }">
            <div class="add-row-fab">
              <TooltipBtn
                v-bind="menuProps"
                icon="mdi-plus"
                color="primary"
                size="small"
                elevation="3"
                tooltip="行追加"
                location="top"
              />
            </div>
          </template>
        </AddRowDialog>
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
      v-if="contextMenu.visible"
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
      v-if="taskContextMenu.visible"
      v-model="taskContextMenu.visible"
      :x="taskContextMenu.x"
      :y="taskContextMenu.y"
      :task-id="taskContextMenu.taskId"
      :selected-task-ids="selectedTaskIds"
      :is-read-only="isReadOnly"
      :disabled-delete="hasLockedTaskInContextMenu"
      @edit="handleEditTaskFromContextMenu"
      @comment="handleAddCommentFromContextMenu"
      @copy="handleCopyTasksFromContextMenu"
      @delete="handleDeleteTaskFromContextMenu"
    />

    <!-- Dependency Context Menu -->
    <DependencyContextMenu
      v-if="dependencyContextMenu.visible"
      v-model="dependencyContextMenu.visible"
      :x="dependencyContextMenu.x"
      :y="dependencyContextMenu.y"
      :source-task-id="dependencyContextMenu.sourceTaskId"
      :target-task-id="dependencyContextMenu.targetTaskId"
      @delete="handleDeleteDependencyFromContextMenu"
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
      v-if="chartContextMenu.visible"
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
      :granularity="currentProject?.attribute?.granularity"
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
      @click-log="handleClickLogFromActivity"
      @dblclick-task="handleDblClickTaskFromLog"
    />

    <!-- Snapshot List Dialog -->
    <SnapshotListDialog
      v-if="projectId"
      v-model="isSnapshotListDialogVisible"
      :project-id="projectId"
      @restored="refresh"
    />

    <!-- Project Comment Sidebar -->
    <ProjectCommentPanel
      v-if="currentProject"
      :key="projectId"
      ref="projectCommentPanelRef"
      :project-id="projectId"
      :comment-count="currentProject.commentCount ?? 0"
      :can-comment="canComment"
      :is-owner="isOwner"
      :cached-comments="projectComments"
      :initial-open="commentSidebarOpen"
      :initial-width="commentSidebarWidth"
      @updated="handleProjectCommentPanelUpdated"
      @update:is-open="
        (v: boolean) => {
          commentSidebarOpen = v
        }
      "
      @update:width="
        (w: number) => {
          if (w >= 220) commentSidebarWidth = w
        }
      "
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
  padding: 8px;
  font-family: sans-serif;
  height: calc(100vh - 54px);
  display: flex;
  flex-direction: column;
  transition: padding-right 0.3s ease;
}

:global(.v-theme--dark) .gantt-app {
  /* ダークモード: 白系グローと黒影の組み合わせで視認性を確保 */
  --task-box-shadow: 0 2px 10px rgba(255, 255, 255, 0.4), 0 2px 5px rgba(0, 0, 0, 0.6);
}

.row-edit-input {
  position: fixed;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
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
.add-row-fab {
  position: absolute;
  bottom: 8px;
  left: 8px;
  z-index: 100;
}
</style>
