import { computed, ref } from 'vue'
import { useTheme } from 'vuetify'
import { useProjectStore } from '@/stores/useProjectStore'
import { useConfirm } from '@/composables/useConfirm'
import type { TaskAttribute, NewTaskTemplate } from '@functions/types/shared'
import * as moguchart from '@mogura/moguchart'

export interface DraggableTask extends moguchart.GanttTask {
  style?: string
  pattern?: moguchart.GanttTaskPattern
  labelStyle?: string
  attribute?: TaskAttribute
  originalIndex: number
}

export function useUnassignedTaskSidebar(props: { isOpen: boolean }, emit: any) {
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

  return {
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
  }
}
