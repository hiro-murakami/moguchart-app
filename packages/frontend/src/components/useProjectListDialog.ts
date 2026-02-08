import {
  deleteProject as deleteProjectScript,
  duplicateProject as duplicateProjectScript,
  selectProjects,
  upsertProject,
} from '@/modules/scripts'
import { useConfirm } from '@/modules/useConfirm'
import { useSnackbar } from '@/modules/useSnackbar'
import type { Project } from '@functions/types/shared'
import { ref, watch, type Ref } from 'vue'

export const useProjectListDialog = (
  props: { modelValue: boolean },
  emit: {
    (e: 'update:modelValue', value: boolean): void
    (e: 'select', projectId: string): void
    (e: 'update'): void
  },
) => {
  const projects = ref<Project[]>([])
  const loading = ref(false)
  const saving = ref(false)
  const deleting = ref(false)
  const isProjectDetailDialogVisible = ref(false)
  const projectToEdit = ref<Project | null>(null)
  const originalId = ref<string>()
  const confirm = useConfirm()
  const snackbar = useSnackbar()

  const fetchProjects = async (isFirst: boolean = false) => {
    loading.value = true
    try {
      projects.value = await selectProjects()
      if (!isFirst) {
        emit('update')
      }
    } catch (e) {
      console.error(e)
    } finally {
      loading.value = false
    }
  }

  watch(
    () => props.modelValue,
    (val) => {
      if (val) {
        fetchProjects(true)
      }
    },
  )

  const headers = [
    { title: 'プロジェクト名', key: 'name' },
    { title: '', key: 'role' },
    { title: '説明', key: 'attribute.description' },
    { title: '開始日', key: 'start' },
    { title: '終了日', key: 'end' },
    { title: '操作', key: 'actions', sortable: false },
  ]

  const close = () => {
    emit('update:modelValue', false)
  }

  const selectProject = (project: Project) => {
    emit('select', project.id)
    close()
  }

  const editProject = (project: Project) => {
    projectToEdit.value = project
    originalId.value = undefined
    isProjectDetailDialogVisible.value = true
  }

  const newProject = () => {
    projectToEdit.value = null
    originalId.value = undefined
    isProjectDetailDialogVisible.value = true
  }

  const saveProject = async (project: Partial<Project>) => {
    saving.value = true
    try {
      if (originalId.value) {
        await duplicateProjectScript({
          originalProjectId: originalId.value,
          newProjectData: project as Project,
        })
      } else {
        await upsertProject(project as Project)
      }
      isProjectDetailDialogVisible.value = false
      await fetchProjects() // Refresh the list
    } catch (e) {
      console.error(e)
      // TODO: Show error snackbar
    } finally {
      saving.value = false
    }
  }

  const deleteProject = async (project: Project) => {
    if (!project) return

    if (
      !(await confirm({
        title: '⚠️ プロジェクトの削除',
        message: `プロジェクト "<strong>${project.name}</strong>" を削除してもよろしいですか？<br><span class="text-error font-weight-bold">※この操作は取り消すことができません。</span>`,
        confirmText: '削除',
        confirmColor: 'error',
      }))
    )
      return

    deleting.value = true
    try {
      await deleteProjectScript(project.id)
      snackbar({
        message: 'プロジェクトを削除しました。',
        color: 'success',
      })

      await fetchProjects() // Refresh the list
    } catch (e) {
      console.error(e)
      snackbar({
        message: 'プロジェクトの削除に失敗しました。',
        color: 'error',
      })
    } finally {
      deleting.value = false
    }
  }

  const duplicateProject = (project: Project) => {
    projectToEdit.value = {
      ...project,
      id: '', // Remove id to create a new project
      name: `${project.name}のコピー`,
    }
    originalId.value = project.id
    isProjectDetailDialogVisible.value = true
  }

  return {
    projects,
    loading,
    saving,
    deleting,
    isProjectDetailDialogVisible,
    projectToEdit,
    originalId,
    headers,
    fetchProjects,
    selectProject,
    editProject,
    newProject,
    saveProject,
    deleteProject,
    duplicateProject,
    close,
  }
}
