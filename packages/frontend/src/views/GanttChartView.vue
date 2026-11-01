<script setup lang="ts">
import splashImage from '@/assets/splash2.png'
import { GanttChart } from '@mogura/moguchart-vue'
import { useGanttChartView } from './composables/useGanttChartView'
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useTheme } from 'vuetify'
import ProjectCommentPanel from '@/components/ProjectCommentPanel.vue'
import SlideScheduleDialog from '@/components/SlideScheduleDialog.vue'
import ImageManageDialog from '@/components/ImageManageDialog.vue'
import SnapshotDiffBanner from '@/components/SnapshotDiffBanner.vue'
import SnapshotDiffDialog from '@/components/SnapshotDiffDialog.vue'
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
  hasSuccessorsInContextMenu,
  currentProject,
  showHiddenRows,
  showCurrentTimeLine,
  showCriticalPath,
  showSummaryTasks,
  showMinimap,
  minimapOpacity,
  barShadowLevel,
  isExporting,
  readonlyMode,
  gridEnabled,
  gridEditable,
  gridColumns,
  currentRole,
  pxPerDay,
  basePxPerDay,
  pxPerMonth,
  basePxPerMonth,
  pxPerHour,
  basePxPerHour,
  barHeight,
  zoomPercent,
  fontScale,
  baseBarHeight,
  addRowCount,
  manualAddRowCount,
  isUnassignedTasksOpen,
  ganttChartRef,
  chartContextMenu,
  availableLabels,
  selectedFilterLabelNames,
  filteredRows,
  displayRows,
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
  isSlideScheduleDialogVisible,
  slideScheduleSaving,
  isMarkerDialogVisible,
  editingMarker,
  editingMarkerDefaultDate,
  projectId,

  // スナップショット差分比較
  isDiffActive,
  comparingSnapshotInfo,
  diffSummary,
  isDiffSummaryDialogVisible,
  baselinePosition,
  diffHighlightOnly,
  handleCompareSnapshot,
  handleClearCompareSnapshot,
  handleSnapshotRenamed,
  handleJumpToTask,

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
  handleSelectProject,
  handleTaskContextMenu,
  handleEditTaskFromContextMenu,
  handleAutoScheduleFromContextMenu,
  handleDeleteTaskFromContextMenu,
  handleTaskDelete,
  handleBarSelectionChange,
  handleTaskDragStart,
  handleTaskDragEnd,
  handleTaskDrop,
  handleTaskProgressChange,
  authorityHistoryUsers,
  taskUsers,
  isProgressDialogVisible,
  editingProgressTask,
  saveTaskProgress,
  closeProgressDialog,
  isTaskContextMenuEditable,
  handleChartContextMenu,
  handleCreateNewTask,
  handleCreateNewMilestone,
  handleCreateNewMarker,
  handleMarkerDblClick,
  handleMarkerContextMenu,
  handleEditMarkerFromContextMenu,
  handleDeleteMarkerFromContextMenu,
  markerContextMenu,
  saveMarker,
  deleteMarker,
  selectAllLabels,
  clearAllLabels,
  handleEditRowFromContextMenu,
  saveRow,
  updateProject,
  handleRowHeaderResize,
  handleColumnResize,
  handleCellEdit,
  undo,
  redo,
  handleCommand,
  handleHistoryChange,
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
  exportAsZip,
  commentSidebarOpen,
  commentSidebarWidth,
  effectiveCommentSidebarWidth,
  handleDependencyCreate,
  handleDependencyDelete,
  dependencyContextMenu,
  isDependencyEditDialogVisible,
  editingDependency,
  handleDependencyClick,
  handleEditDependencyFromContextMenu,
  saveDependencyEdit,
  handleDeleteDependencyFromEditDialog,
  handleDeleteDependencyFromContextMenu,
  handleSlideSchedule,
  handleZoomChange,
  handleMinimapResize,
  handleMinimapCollapse,
  isImageDialogVisible,
  imageDialogTaskId,
  imageDialogImageUrls,
  handleImageFromContextMenu,
  handleSaveTaskImages,
  handleImageFromRowContextMenu,
  handleSaveImages,
  canIndent,
  canOutdent,
  handleIndentRows,
  handleOutdentRows,
  handleRowToggleCollapse,
  handleToggleCollapseFromContextMenu,
  handleCollapseAll,
  handleExpandAll,
} = useGanttChartView()

const projectCommentPanelRef = ref<InstanceType<typeof ProjectCommentPanel>>()
const userStore = useUserStore()
const vuetifyTheme = useTheme()

// ダーク/ライトテーマに対応した影のCSS変数値を計算
const barShadowCssVar = computed(() => {
  if (isExporting.value) return 'none'
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
  const userId = userStore.currentUser?.id
  const email = userStore.currentUser?.email
  if ((!userId && !email) || !currentProject.value) return false
  const auth = currentProject.value.authority
  const matches = (list?: string[]) => {
    if (!list) return false
    return (!!userId && list.includes(userId)) || (!!email && list.includes(email))
  }
  return matches(auth.owners) || matches(auth.editors) || matches(auth.viewers)
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
    } else if (key === '0') {
      e.preventDefault()
      zoomPercent.value = 100
    }
  }

  // 行選択時のインデント / アウトデント
  if (e.key === 'Tab') {
    if (selectedRowIds.value.length > 0) {
      e.preventDefault()
      if (e.shiftKey) {
        if (canOutdent.value) {
          handleOutdentRows()
        }
      } else {
        if (canIndent.value) {
          handleIndentRows()
        }
      }
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

const handleExportExcel = async () => {
  if (currentProject.value) {
    await exportAsExcel(currentProject.value.name)
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

const handleExportZip = async () => {
  if (currentProject.value) {
    await exportAsZip(currentProject.value.id, currentProject.value.name)
  }
}

const handleOpenSlideSchedule = async () => {
  isProjectDetailDialogVisible.value = false
  await nextTick()
  isSlideScheduleDialogVisible.value = true
}
</script>

<template>
  <div
    class="gantt-app"
    :style="{
      paddingRight: currentProject ? `${effectiveCommentSidebarWidth + 8}px` : undefined,
      '--task-box-shadow': barShadowCssVar,
      '--moguchart-font-scale': fontScale,
    }"
  >
    <template v-if="currentProject">
      <div class="project-header-wrapper">
        <div class="project-header">
          <div class="project-header__main">
            <TooltipBtn
              v-if="!isSnapshotMode"
              icon="mdi-format-list-bulleted"
              variant="text"
              density="comfortable"
              class="header-icon-btn flex-shrink-0"
              @click="isProjectListDialogVisible = true"
              tooltip="プロジェクト一覧"
            />
            <div class="project-header__info">
              <div class="project-header__title-bar">
                <div class="project-header__title-group">
                  <v-tooltip :text="currentProject.name" location="bottom" :open-delay="400">
                    <template #activator="{ props: titleTipProps }">
                      <span v-bind="titleTipProps" class="project-title text-truncate">
                        {{ currentProject.name }}
                      </span>
                    </template>
                  </v-tooltip>
                  <RoleChip :role="isSnapshotMode ? 'snapshot' : currentProject.role" />
                </div>

                <div class="project-header__actions">
                  <TooltipBtn
                    v-if="isOwner"
                    icon="mdi-pencil"
                    variant="text"
                    density="comfortable"
                    class="header-icon-btn"
                    @click="isProjectDetailDialogVisible = true"
                    tooltip="プロジェクト詳細"
                  />
                  <TooltipBtn
                    v-if="!isSnapshotMode"
                    icon="mdi-refresh"
                    variant="text"
                    density="comfortable"
                    class="header-icon-btn"
                    @click="refresh"
                    tooltip="最新化"
                  />
                  <TooltipBtn
                    v-if="!isSnapshotMode && !isReadOnly"
                    icon="mdi-camera"
                    variant="text"
                    density="comfortable"
                    class="header-icon-btn"
                    @click="handleCreateSnapshot"
                    tooltip="スナップショット作成"
                  />
                  <TooltipBtn
                    v-if="!isSnapshotMode"
                    icon="mdi-image-multiple"
                    :color="isDiffActive ? 'info' : undefined"
                    variant="text"
                    density="comfortable"
                    class="header-icon-btn"
                    @click="isSnapshotListDialogVisible = true"
                    :tooltip="isDiffActive ? 'スナップショット一覧（差分比較中）' : 'スナップショット一覧'"
                  />
                  <TooltipBtn
                    v-if="!isSnapshotMode && isDiffActive"
                    icon="mdi-file-document-outline"
                    color="info"
                    variant="text"
                    density="comfortable"
                    class="header-icon-btn"
                    @click="isDiffSummaryDialogVisible = true"
                    tooltip="差分詳細サマリー"
                  />
                  <ExportMenu
                    button-class="header-icon-btn"
                    @export-csv="handleExportCsv"
                    @export-excel="handleExportExcel"
                    @export-zip="handleExportZip"
                    @export-png="handleExportPng"
                    @export-pdf="handleExportPdf"
                  />
                  <template v-if="!isSnapshotMode">
                    <v-divider vertical class="mx-1 header-divider" />
                    <TooltipBtn
                      v-if="!isReadOnly"
                      icon="mdi-format-indent-increase"
                      variant="text"
                      density="comfortable"
                      class="header-icon-btn"
                      :disabled="!canIndent"
                      @click="handleIndentRows"
                      tooltip="インデント（子行にする） [Tab]"
                    />
                    <TooltipBtn
                      v-if="!isReadOnly"
                      icon="mdi-format-indent-decrease"
                      variant="text"
                      density="comfortable"
                      class="header-icon-btn"
                      :disabled="!canOutdent"
                      @click="handleOutdentRows"
                      tooltip="インデント解除 [Shift+Tab]"
                    />
                    <TooltipBtn
                      icon="mdi-folder"
                      variant="text"
                      density="comfortable"
                      class="header-icon-btn"
                      @click="handleCollapseAll"
                      tooltip="すべての親行を折りたたみ"
                    />
                    <TooltipBtn
                      icon="mdi-folder-open"
                      variant="text"
                      density="comfortable"
                      class="header-icon-btn"
                      @click="handleExpandAll"
                      tooltip="すべての行を展開"
                    />
                  </template>
                </div>
              </div>
              <v-tooltip
                v-if="currentProject.attribute.description"
                :text="currentProject.attribute.description"
                location="bottom"
                :open-delay="500"
              >
                <template #activator="{ props: descTipProps }">
                  <div v-bind="descTipProps" class="project-description text-caption text-medium-emphasis text-truncate">
                    {{ currentProject.attribute.description }}
                  </div>
                </template>
              </v-tooltip>
            </div>
          </div>

          <div class="project-header__controls">
            <div v-if="activeUsers.length > 0" class="d-flex align-center flex-shrink-0 mr-1">
              <v-tooltip v-for="user in activeUsers" :key="user.email" :text="user.displayName" location="bottom">
                <template v-slot:activator="{ props }">
                  <UserAvatar
                    v-bind="props"
                    :color="user.color"
                    size="30"
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
              class="search-text-field header-compact-field"
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
              class="label-filter-field header-compact-field"
              v-model="selectedFilterLabelNames"
              :available-labels="availableLabels"
              @select-all="selectAllLabels"
              @clear-all="clearAllLabels"
            />

            <DisplaySettingsMenu
              button-class="header-icon-btn flex-shrink-0"
              v-model:show-hidden-rows="showHiddenRows"
              v-model:show-current-time-line="showCurrentTimeLine"
              v-model:show-critical-path="showCriticalPath"
              v-model:show-summary-tasks="showSummaryTasks"
              v-model:show-minimap="showMinimap"
              v-model:minimap-opacity="minimapOpacity"
              v-model:bar-shadow-level="barShadowLevel"
              v-model:zoom-percent="zoomPercent"
              v-model:base-px-per-day="basePxPerDay"
              v-model:base-px-per-month="basePxPerMonth"
              v-model:base-px-per-hour="basePxPerHour"
              :px-per-day="pxPerDay"
              :px-per-month="pxPerMonth"
              :px-per-hour="pxPerHour"
              v-model:base-bar-height="baseBarHeight"
              :bar-height="barHeight"
              v-model:readonly-mode="readonlyMode"
              :can-edit="currentRole !== 'viewer'"
              :granularity="currentProject?.attribute?.granularity"
              v-model:grid-enabled="gridEnabled"
              v-model:grid-editable="gridEditable"
              v-model:grid-columns="gridColumns"
              :enable-progress="currentProject?.attribute?.enableProgress !== false"
              :enable-working-days="
                currentProject?.attribute?.granularity !== 'monthly' &&
                currentProject?.attribute?.granularity !== 'hourly' &&
                (currentProject?.attribute?.autoScheduleCalendarMode === 'weekends' ||
                  currentProject?.attribute?.autoScheduleCalendarMode === 'weekends-holidays')
              "
            />
          </div>
        </div>
      </div>

      <SnapshotDiffBanner
        v-if="isDiffActive"
        :diff-summary="diffSummary"
        v-model:baseline-position="baselinePosition"
        v-model:diff-highlight-only="diffHighlightOnly"
        @open-detail="isDiffSummaryDialogVisible = true"
        @close="handleClearCompareSnapshot"
      />

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
          <GanttChart
            ref="ganttChartRef"
            :rows="displayRows"
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
            @column-resize="handleColumnResize"
            @cell-edit="handleCellEdit"
            @task-delete="handleTaskDelete"
            @dependency-create="handleDependencyCreate"
            @dependency-click="handleDependencyClick"
            @dependency-delete="handleDependencyDelete"
            @task-progress-change="handleTaskProgressChange"
            @zoom-change="handleZoomChange"
            @minimap-resize="handleMinimapResize"
            @minimap-collapse="handleMinimapCollapse"
            @marker-dblclick="handleMarkerDblClick"
            @marker-contextmenu="handleMarkerContextMenu"
            @row-toggle-collapse="handleRowToggleCollapse"
            @command="handleCommand"
            @history-change="handleHistoryChange"
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

    <div v-else class="splash-container d-flex flex-column align-center justify-center flex-grow-1">
      <img :src="splashImage" class="splash-image" alt="MoguChart" />
      <p v-if="!isSnapshotMode" class="splash-subtitle text-subtitle-1 text-medium-emphasis">
        プロジェクトを選択してガントチャートを表示します
      </p>
      <v-btn
        v-if="!isSnapshotMode"
        color="primary"
        size="large"
        class="splash-action-btn flex-shrink-0"
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
      :can-indent="canIndent"
      :can-outdent="canOutdent"
      :is-parent="contextMenu.isParent"
      :collapsed="contextMenu.collapsed"
      @add-row-above="handleAddRowAbove"
      @add-row-below="handleAddRowBelow"
      @indent="handleIndentRows"
      @outdent="handleOutdentRows"
      @toggle-collapse="handleToggleCollapseFromContextMenu"
      @edit-row="handleEditRowFromContextMenu"
      @delete-row="handleDeleteRowFromContextMenu"
      @toggle-visibility="toggleRowVisibility"
      @add-comment="handleAddCommentToRow"
      @image="handleImageFromRowContextMenu"
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
      :can-edit="isTaskContextMenuEditable"
      :disabled-delete="hasLockedTaskInContextMenu"
      :has-successors="hasSuccessorsInContextMenu"
      @edit="handleEditTaskFromContextMenu"
      @comment="handleAddCommentFromContextMenu"
      @image="handleImageFromContextMenu"
      @auto-schedule="handleAutoScheduleFromContextMenu"
      @copy="handleCopyTasksFromContextMenu"
      @delete="handleDeleteTaskFromContextMenu"
    />

    <ImageManageDialog
      v-if="isImageDialogVisible"
      v-model="isImageDialogVisible"
      :current-image-urls="imageDialogImageUrls"
      :project-id="projectId"
      @save="handleSaveImages"
    />

    <!-- Dependency Context Menu -->
    <DependencyContextMenu
      v-if="dependencyContextMenu.visible"
      v-model="dependencyContextMenu.visible"
      :x="dependencyContextMenu.x"
      :y="dependencyContextMenu.y"
      :source-task-id="dependencyContextMenu.sourceTaskId"
      :target-task-id="dependencyContextMenu.targetTaskId"
      @edit="handleEditDependencyFromContextMenu"
      @delete="handleDeleteDependencyFromContextMenu"
    />

    <!-- Dependency Edit Dialog -->
    <DependencyEditDialog
      v-if="editingDependency"
      v-model="isDependencyEditDialogVisible"
      :source-task-name="editingDependency.sourceTaskName"
      :target-task-name="editingDependency.targetTaskName"
      :dependency-type="editingDependency.type"
      :lag-minutes="editingDependency.lag"
      :granularity="currentProject?.attribute?.granularity"
      @save="saveDependencyEdit"
      @delete="handleDeleteDependencyFromEditDialog"
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
      @new-milestone="handleCreateNewMilestone"
      @new-marker="handleCreateNewMarker"
      @paste="handlePasteTasksFromContextMenu"
      @undo="undo"
      @redo="redo"
    />

    <!-- Marker Context Menu -->
    <MarkerContextMenu
      v-if="markerContextMenu.visible"
      v-model="markerContextMenu.visible"
      :x="markerContextMenu.x"
      :y="markerContextMenu.y"
      :is-read-only="isReadOnly"
      @edit="handleEditMarkerFromContextMenu"
      @delete="handleDeleteMarkerFromContextMenu"
    />

    <TaskDetailDialog
      v-model="isDialogVisible"
      :task="editingTask"
      :rows="rows"
      :granularity="currentProject?.attribute?.granularity"
      :enable-progress="currentProject?.attribute?.enableProgress !== false"
      :users="taskUsers"
      @save="saveTask"
      @delete="deleteTask"
    />

    <TaskProgressDialog
      v-model="isProgressDialogVisible"
      :task="editingProgressTask"
      @save="saveTaskProgress"
      @close="closeProgressDialog"
    />

    <MarkerFormDialog
      v-if="isMarkerDialogVisible"
      v-model="isMarkerDialogVisible"
      :marker="editingMarker"
      :default-date="editingMarkerDefaultDate"
      :is-read-only="isReadOnly"
      @save="saveMarker"
      @delete="deleteMarker"
    />

    <RowEditDialog v-model="isRowEditDialogVisible" :row="editingRowData" @save="saveRow" />
    <ProjectDetailDialog
      v-if="currentProject"
      v-model="isProjectDetailDialogVisible"
      :project="currentProject"
      @save="updateProject"
      @open-slide-schedule="handleOpenSlideSchedule"
    />
    <SlideScheduleDialog
      v-if="currentProject"
      v-model="isSlideScheduleDialogVisible"
      :project="currentProject"
      :saving="slideScheduleSaving"
      @slide="handleSlideSchedule"
    />
    <ProjectListDialog v-model="isProjectListDialogVisible" @select="handleSelectProject" @update="refresh" />

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
      :comparing-snapshot-name="comparingSnapshotInfo?.name"
      @compare="handleCompareSnapshot"
      @clear-compare="handleClearCompareSnapshot"
      @renamed="handleSnapshotRenamed"
      @restored="refresh"
    />

    <!-- Snapshot Diff Dialog -->
    <SnapshotDiffDialog
      v-model="isDiffSummaryDialogVisible"
      :diff-summary="diffSummary"
      @select-task="handleJumpToTask"
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
  box-sizing: border-box;
  height: calc(100vh - var(--app-bar-height, 54px));
  height: calc(100dvh - var(--app-bar-height, 54px));
  display: flex;
  flex-direction: column;
  transition: padding-right 0.3s ease;
}

@media (max-height: 820px) {
  .gantt-app {
    padding-top: 6px;
    padding-bottom: 6px;
  }
}

:global(.v-theme--dark) .gantt-app {
  /* ダークモード: 白系グローと黒影の組み合わせで視認性を確保 */
  --task-box-shadow: 0 2px 10px rgba(255, 255, 255, 0.4), 0 2px 5px rgba(0, 0, 0, 0.6);
}

/* --- プロジェクトヘッダ（レスポンシブ・コンテナクエリ対応） --- */
.project-header-wrapper {
  container-type: inline-size;
  container-name: project-header;
  margin-bottom: 8px;
  flex-shrink: 0;
}

@media (max-height: 820px) {
  .project-header-wrapper {
    margin-bottom: 6px;
  }
}

.project-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  column-gap: 10px;
  row-gap: 6px;
}

.project-header__main {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 999 1 530px;
  min-width: min(100%, 530px);
}

.project-header__info {
  flex: 1 1 0;
  min-width: 0;
}

.project-header__title-bar {
  display: flex;
  align-items: center;
  column-gap: 6px;
  row-gap: 2px;
  min-width: 0;
}

.project-header__title-group {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 1 auto;
  min-width: min(100%, 100px);
  max-width: 100%;
}

.project-title {
  font-size: 1.15rem;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: 0.01em;
}

.project-header__actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.header-divider {
  height: 20px;
  align-self: center;
}

:deep(.header-icon-btn) {
  width: 36px !important;
  height: 36px !important;
  min-width: 36px !important;
}

.project-description {
  max-width: 100%;
  line-height: 1.3;
  margin-top: 1px;
}

.project-header__controls {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex: 1 0 auto;
  margin-left: auto;
  max-width: 100%;
}

.search-text-field {
  flex: 0 1 230px;
  width: 230px;
  max-width: 300px;
  min-width: 195px;
}

.label-filter-field {
  flex: 0 1 200px;
  width: 200px;
  max-width: 250px;
  min-width: 175px;
}

.search-include-rows {
  flex-shrink: 0;
  white-space: nowrap;
}

.search-include-rows :deep(.v-label) {
  font-size: 13px;
  white-space: nowrap;
}

.search-include-rows :deep(.v-selection-control) {
  min-height: 32px;
}

/* 大画面では検索欄・ラベル欄をゆったり表示 */
@container project-header (min-width: 1280px) {
  .search-text-field {
    flex-basis: 260px;
    width: 260px;
    min-width: 230px;
    max-width: 340px;
  }
  .label-filter-field {
    flex-basis: 220px;
    width: 220px;
    min-width: 195px;
    max-width: 270px;
  }
}

/* iPad横画面・中解像度以下ではボタンと入力欄を引き締める */
@container project-header (max-width: 1180px) {
  .project-title {
    font-size: 1.05rem;
  }
  .project-header__actions {
    gap: 0;
  }
  :deep(.header-icon-btn) {
    width: 34px !important;
    height: 34px !important;
    min-width: 34px !important;
  }
  .header-compact-field :deep(.v-field) {
    font-size: 13px;
  }
  .header-compact-field :deep(.v-field-label:not(.v-field-label--floating)) {
    font-size: 13px;
  }
  .search-text-field {
    flex-basis: 185px;
    width: 185px;
    min-width: 172px;
  }
  .label-filter-field {
    flex-basis: 168px;
    width: 168px;
    min-width: 158px;
  }
}

@media (max-height: 820px) {
  .project-title {
    font-size: 1.05rem;
  }
  .header-compact-field :deep(.v-field) {
    --v-input-control-height: 36px;
    --v-input-padding-top: 4px;
    font-size: 13px;
  }
  .header-compact-field :deep(.v-field__input) {
    min-height: 36px;
    padding-top: 4px;
    padding-bottom: 4px;
    align-items: center;
  }
  .header-compact-field :deep(.v-field-label:not(.v-field-label--floating)) {
    font-size: 13px;
  }
}

/* 2段折り返し発生する中狭幅以下では検索欄・ラベル欄を適度に伸縮可能にする */
@container project-header (max-width: 940px) {
  .project-header__controls {
    flex: 1 1 100%;
  }
  .search-text-field {
    flex: 1 1 180px;
    max-width: 280px;
    min-width: 140px;
  }
  .label-filter-field {
    flex: 1 1 160px;
    max-width: 240px;
    min-width: 135px;
  }
}

/* 極狭幅（タブレット縦＋サイドバー展開時など）ではタイトル行とアクション群、コントロール群も折り返し可能にする */
@container project-header (max-width: 640px) {
  .project-header__title-bar {
    flex-wrap: wrap;
  }
  .project-header__actions {
    flex-wrap: wrap;
  }
  .project-header__controls {
    flex-wrap: wrap;
    justify-content: flex-start;
  }
}

.row-edit-input {
  position: fixed;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  border: 1px solid #007bff;
  border-radius: 4px;
  padding: 0 6px;
  z-index: 1000;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
}

.splash-container {
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
}

.splash-image {
  height: min(500px, calc(100dvh - 240px));
  min-height: 160px;
  max-width: min(90vw, 100%);
  width: auto;
  object-fit: contain;
  border-radius: 24px;
  margin-bottom: 24px;
}

.splash-subtitle {
  margin-bottom: 32px;
  text-align: center;
}

@media (max-height: 800px) {
  .splash-image {
    height: min(380px, calc(100dvh - 200px));
    margin-bottom: 16px;
    border-radius: 18px;
  }
  .splash-subtitle {
    margin-bottom: 16px;
  }
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
