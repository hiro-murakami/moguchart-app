<script setup lang="ts">
import * as moguchart from '@mogura/moguchart-core'
import dayjs from 'dayjs'

import { getContrastColor } from '@/modules/utils'
import { useUnassignedTaskSidebar } from './composables/useUnassignedTaskSidebar'
import type { DraggableTask } from './composables/useUnassignedTaskSidebar'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'update:isOpen', value: boolean): void
  (e: 'drag-start', event: DragEvent, task: DraggableTask): void
  (e: 'drag-end'): void
}>()

const {
  sidebarBaseStyle,
  tasks,
  toggle,
  isTemplateDialogVisible,
  editingTemplate,
  contextMenu,
  handleTaskContextMenu,
  handleEditTemplateFromContextMenu,
  handleDeleteTemplate,
  handleTaskDblClick,
  handleAddTemplate,
  saveTemplate,
} = useUnassignedTaskSidebar(props, emit)
</script>

<template>
  <div
    class="unassigned-tasks-sidebar"
    :style="{
      width: isOpen ? '240px' : '50px',
      padding: isOpen ? '16px' : '0',
      ...sidebarBaseStyle,
    }"
  >
    <h3 class="sidebar-header" :class="{ open: isOpen }" @click="toggle">
      <v-icon>
        {{ isOpen ? 'mdi-chevron-right' : 'mdi-chevron-left' }}
      </v-icon>
      <span>タスクテンプレート</span>
      <TooltipBtn
        v-if="isOpen"
        icon="mdi-plus"
        variant="text"
        density="compact"
        size="small"
        class="ml-auto"
        @click.stop="handleAddTemplate"
        tooltip="テンプレート追加"
      />
    </h3>
    <div v-if="isOpen" class="sidebar-content">
      <div
        v-for="task in tasks"
        :key="task.id"
        class="draggable-task"
        draggable="true"
        @dragstart="(e) => emit('drag-start', e, task)"
        @dragend="emit('drag-end')"
        @dblclick="handleTaskDblClick(task)"
        @contextmenu.prevent="handleTaskContextMenu($event, task)"
      >
        <div class="task-header">
          <div
            class="task-bar-preview"
            :style="`${task.style || ''}; ${moguchart.getPatternStyle(task.pattern)}`"
          ></div>
          <div class="task-name">{{ task.name }}</div>
        </div>
        <div class="task-meta">
          <div class="task-duration">期間: {{ dayjs(task.end).diff(dayjs(task.start), 'day') }} 日</div>
          <div v-if="task.attribute?.labels?.length" class="task-labels">
            <span
              v-for="label in task.attribute.labels"
              :key="label.name"
              class="task-label-chip"
              :style="{ backgroundColor: label.color, color: getContrastColor(label.color) }"
            >
              {{ label.name }}
            </span>
          </div>
        </div>
        <div v-if="task.attribute?.description" class="task-description">
          {{ task.attribute.description }}
        </div>
      </div>
      <div v-if="tasks.length === 0" class="empty-message">タスクはありません</div>
    </div>

    <TaskTemplateDialog
      v-if="editingTemplate"
      v-model="isTemplateDialogVisible"
      :template="editingTemplate"
      @save="saveTemplate"
    />

    <TemplateContextMenu
      v-model="contextMenu.visible"
      :x="contextMenu.x"
      :y="contextMenu.y"
      @edit="handleEditTemplateFromContextMenu"
      @delete="handleDeleteTemplate"
    />
  </div>
</template>

<style scoped>
.unassigned-tasks-sidebar {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  border: 1px solid transparent; /* Placeholder to be overridden */
  border-radius: 8px;
  transition:
    width 0.3s ease,
    padding 0.3s ease;
  overflow: hidden;
  display: flex;
  flex-direction: column;
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
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 4px;
  cursor: grab;
  user-select: none;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
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

.task-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 4px;
}

.task-duration {
  font-size: 12px;
  opacity: 0.7;
}

.task-labels {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.task-label-chip {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: bold;
  white-space: nowrap;
  line-height: normal;
}

.task-description {
  font-size: 11px;
  opacity: 0.6;
  margin-top: 4px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2; /* Limit to 2 lines */
  line-clamp: 2;
  white-space: pre-wrap;
}

.empty-message {
  opacity: 0.5;
  font-size: 14px;
  text-align: center;
  padding: 20px;
}
</style>
