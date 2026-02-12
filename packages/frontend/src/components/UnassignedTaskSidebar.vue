<script setup lang="ts">
import * as moguchart from '@mogura/moguchart'
import dayjs from 'dayjs'

interface DraggableTask extends moguchart.GanttTask {
  style?: string
  pattern?: moguchart.GanttTaskPattern
  labelStyle?: string
}

const props = defineProps<{
  tasks: DraggableTask[]
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'update:isOpen', value: boolean): void
  (e: 'drag-start', event: DragEvent, task: DraggableTask): void
  (e: 'drag-end'): void
}>()

const toggle = () => {
  emit('update:isOpen', !props.isOpen)
}
</script>

<template>
  <div
    class="unassigned-tasks-sidebar"
    :style="{
      width: isOpen ? '240px' : '50px',
      padding: isOpen ? '16px' : '0',
    }"
  >
    <h3 class="sidebar-header" :class="{ open: isOpen }" @click="toggle">
      <v-icon>
        {{ isOpen ? 'mdi-chevron-right' : 'mdi-chevron-left' }}
      </v-icon>
      <span>追加候補タスク</span>
    </h3>
    <div v-if="isOpen" class="sidebar-content">
      <div
        v-for="task in tasks"
        :key="task.id"
        class="draggable-task"
        draggable="true"
        @dragstart="(e) => emit('drag-start', e, task)"
        @dragend="emit('drag-end')"
      >
        <div class="task-bar-preview" :style="`${task.style || ''}; ${moguchart.getPatternStyle(task.pattern)}`"></div>
        <div class="task-name">{{ task.name }}</div>
        <div class="task-duration">期間: {{ dayjs(task.end).diff(dayjs(task.start), 'day') }} 日</div>
      </div>
      <div v-if="tasks.length === 0" class="empty-message">タスクはありません</div>
    </div>
  </div>
</template>

<style scoped>
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
