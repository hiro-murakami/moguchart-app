import {
  deleteProject as deleteProjectScript,
  duplicateProject as duplicateProjectScript,
  upsertProject,
  getGanttDataJson,
  restoreProject as restoreProjectScript,
} from '@/modules/scripts'
import { useConfirm } from '@/modules/useConfirm'
import { useSnackbar } from '@/modules/useSnackbar'
import { toDateString } from '@/modules/utils'
import type { Project } from '@functions/types/shared'
import { ref, watch, type Ref } from 'vue'

import { useProjectStore } from '@/stores/useProjectStore'
import { storeToRefs } from 'pinia'

export const useProjectListDialog = (
  props: { modelValue: boolean },
  emit: {
    (e: 'update:modelValue', value: boolean): void
    (e: 'select', projectId: string): void
    (e: 'update'): void
  },
) => {
  const projectStore = useProjectStore()
  const { projects } = storeToRefs(projectStore)
  const loading = ref(false)
  const saving = ref(false)
  const deleting = ref(false)
  const downloading = ref(false)
  const restoring = ref(false)
  const isProjectDetailDialogVisible = ref(false)
  const projectToEdit = ref<Project | null>(null)
  const originalId = ref<string>()
  const confirm = useConfirm()
  const snackbar = useSnackbar()

  const fetchProjects = async (isFirst: boolean = false) => {
    loading.value = true
    try {
      await projectStore.fetchProjects()
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
    { title: '開始日', key: 'start', value: (item: Project) => toDateString(item.start, 'YYYY/MM/DD') },
    { title: '終了日', key: 'end', value: (item: Project) => toDateString(item.end, 'YYYY/MM/DD') },
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

  const restoreProjectFromFile = async (file: File) => {
    restoring.value = true
    try {
      const text = await file.text()
      const data = JSON.parse(text)

      if (!data.project || !data.rows) {
        throw new Error('Invalid backup file format')
      }

      await restoreProjectScript(data)

      snackbar({
        message: 'プロジェクトを復元しました。',
        color: 'success',
      })
      await fetchProjects()
    } catch (e: any) {
      console.error(e)
      snackbar({
        message: `復元に失敗しました: ${e.message}`,
        color: 'error',
      })
    } finally {
      restoring.value = false
    }
  }

  const downloadProjectJson = async (project: Project) => {
    downloading.value = true

    try {
      const data = await getGanttDataJson(project.id)
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${project.name}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
      snackbar({
        message: 'ダウンロードに失敗しました。',
        color: 'error',
      })
    } finally {
      downloading.value = false
    }
  }

  return {
    projects,
    loading,
    saving,
    deleting,
    downloading,
    restoring,
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
    downloadProjectJson,
    restoreProjectFromFile,
    close,
  }
}
