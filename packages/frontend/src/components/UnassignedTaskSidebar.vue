<script setup lang="ts">
import * as moguchart from '@mogura/moguchart'
import dayjs from 'dayjs'
import { computed, ref } from 'vue'
import { useTheme } from 'vuetify'

import { useProjectStore } from '@/stores/useProjectStore'
import type { TaskAttribute, NewTaskTemplate } from '@functions/types/shared'
import { useConfirm } from '@/modules/useConfirm'
import { getContrastColor } from '@/modules/utils'

interface DraggableTask extends moguchart.GanttTask {
  style?: string
  pattern?: moguchart.GanttTaskPattern
  labelStyle?: string
  attribute?: TaskAttribute
  originalIndex: number
}

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'update:isOpen', value: boolean): void
  (e: 'drag-start', event: DragEvent, task: DraggableTask): void
  (e: 'drag-end'): void
}>()

const projectStore = useProjectStore()
const confirm = useConfirm()
const theme = useTheme()

const isDark = computed(() => theme.current.value.dark)

const sidebarBaseStyle = computed(() => {
  return isDark.value
    ? {
        backgroundColor: '#0f172a',
        borderColor: '#263040',
      }
    : {
        backgroundColor: '#f1f5f9',
        borderColor: '#cbd5e1',
      }
})

const tasks = computed<DraggableTask[]>(() => {
  const templates = projectStore.currentProject?.attribute.newTaskTemplates || []

  return templates.map((template, index) => {
    let style = ''
    let labelStyle = ''
    let pattern: moguchart.GanttTaskPattern | undefined = undefined

    const colorPalette = template.attribute.colorPalette

    if (colorPalette) {
      if (colorPalette.backgroundColor) {
        style = `background-color: ${colorPalette.backgroundColor}; border-color: ${colorPalette.backgroundColor}; ${style || ''}`
      }
      if (colorPalette.color) {
        labelStyle = `color: ${colorPalette.color}; ${labelStyle || ''}`
      }
      if (colorPalette.pattern) {
        pattern = {
          type: colorPalette.pattern.type as moguchart.BarPattern,
          color: colorPalette.pattern.color,
        }
      }
    }

    // Default duration to 1 day if not specified.
    // Although the type says number, safety check.
    const duration = template.duration || 1
    const start = new Date()
    const end = new Date(start.getTime() + duration * 24 * 60 * 60 * 1000)

    return {
      id: `template-${index}`, // Temporary ID
      name: template.name,
      start,
      end,
      style,
      labelStyle,
      pattern,
      attribute: template.attribute,
      originalIndex: index,
    }
  })
})

const toggle = () => {
  emit('update:isOpen', !props.isOpen)
}

// --- Template Editing ---
const isTemplateDialogVisible = ref(false)
const editingTemplate = ref<NewTaskTemplate | null>(null)
const editingIndex = ref<number | null>(null)

// --- Context Menu ---
const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  index: null as number | null,
})

const handleTaskContextMenu = (event: MouseEvent, task: DraggableTask) => {
  contextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    index: task.originalIndex,
  }
}

const handleEditTemplateFromContextMenu = () => {
  const index = contextMenu.value.index
  if (index === null || !projectStore.currentProject) return

  const template = projectStore.currentProject.attribute.newTaskTemplates?.[index]
  if (template) {
    editingTemplate.value = { ...template }
    editingIndex.value = index
    isTemplateDialogVisible.value = true
  }
  contextMenu.value.visible = false
}

const handleDeleteTemplate = async () => {
  const index = contextMenu.value.index
  if (index === null || !projectStore.currentProject) return

  const result = await confirm({
    title: 'テンプレート削除',
    message: 'このテンプレートを削除してもよろしいですか？',
    confirmText: '削除',
    confirmColor: 'red',
  })

  if (!result) {
    return
  }

  const currentTemplates = [...(projectStore.currentProject.attribute.newTaskTemplates || [])]
  currentTemplates.splice(index, 1)

  const updatedProject = {
    ...projectStore.currentProject,
    attribute: {
      ...projectStore.currentProject.attribute,
      newTaskTemplates: currentTemplates,
    },
  }

  try {
    await projectStore.updateProject(updatedProject)
    contextMenu.value.visible = false
  } catch (err) {
    console.error('Failed to delete template:', err)
  }
}

const handleTaskDblClick = (task: DraggableTask) => {
  const template = projectStore.currentProject?.attribute.newTaskTemplates?.[task.originalIndex]
  if (template) {
    editingTemplate.value = { ...template }
    editingIndex.value = task.originalIndex
    isTemplateDialogVisible.value = true
  }
}

const handleAddTemplate = () => {
  editingTemplate.value = {
    name: '新規テンプレート',
    duration: 1,
    attribute: {},
  }
  editingIndex.value = null // null means new creation
  isTemplateDialogVisible.value = true
}

const saveTemplate = async (template: NewTaskTemplate) => {
  if (!projectStore.currentProject) return

  const currentTemplates = [...(projectStore.currentProject.attribute.newTaskTemplates || [])]

  if (editingIndex.value !== null) {
    // Update existing
    currentTemplates[editingIndex.value] = template
  } else {
    // Create new
    currentTemplates.push(template)
  }

  const updatedProject = {
    ...projectStore.currentProject,
    attribute: {
      ...projectStore.currentProject.attribute,
      newTaskTemplates: currentTemplates,
    },
  }

  try {
    await projectStore.updateProject(updatedProject)
    isTemplateDialogVisible.value = false
  } catch (err) {
    console.error('Failed to update template:', err)
    // Error handling (e.g. useAlert)
  }
}
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
