import {
  deleteProject as deleteProjectScript,
  duplicateProject as duplicateProjectScript,
  downloadProjectZip,
  restoreProject as restoreProjectScript,
} from '@/modules/scripts'
import { useConfirm } from '@/composables/useConfirm'
import { useSnackbar } from '@/composables/useSnackbar'
import type { Project } from '@functions/types/shared'
import { ref, watch } from 'vue'

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
    { title: 'プロジェクト名', key: 'project' },
    { title: '説明', key: 'attribute.description' },
    { title: '期間', key: 'period', sortable: false, width: '150px' },
    { title: '操作', key: 'actions', sortable: false, width: '180px' },
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
      let projectId = project.id
      if (originalId.value) {
        projectId = await duplicateProjectScript({
          originalProjectId: originalId.value,
          newProjectData: project as Project,
        })
      } else {
        projectId = await projectStore.updateProject(project as Project)
      }
      isProjectDetailDialogVisible.value = false
      await fetchProjects() // Storeを最新の状態にする

      if (projectId) {
        emit('select', projectId)
        close()
      }
    } catch (e) {
      console.error(e)
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
      public: false,
    }
    originalId.value = project.id
    isProjectDetailDialogVisible.value = true
  }

  const readRestoreData = async (file: File) => {
    const isZip = file.name.endsWith('.zip')
    if (isZip) {
      // zipファイルの場合はBase64に変換してバックエンドで展開
      const arrayBuffer = await file.arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]!)
      }
      return { zipBase64: btoa(binary) }
    } else {
      // JSONファイルの場合は従来通りパース
      const text = await file.text()
      const data = JSON.parse(text)
      if (!data.project || !data.rows) {
        throw new Error('Invalid backup file format')
      }
      return data
    }
  }

  const restoreProjectFromFile = async (file: File) => {
    restoring.value = true
    try {
      const data = await readRestoreData(file)

      await restoreProjectScript(data)

      snackbar({
        message: 'プロジェクトを復元しました。',
        color: 'success',
      })
      await fetchProjects()
    } catch (e: any) {
      console.error(e)
      if (e.message.includes('PROJECT_EXISTS')) {
        const result = await confirm({
          title: 'プロジェクトの復元',
          message: '同じIDを持つプロジェクトが既に存在します。<br>どのように復元しますか？',
          buttons: [
            { text: '別のプロジェクトとして復元', color: 'primary', value: 'newId' },
            { text: '上書きして復元', color: 'warning', value: 'overwrite' },
          ],
        })

        if (result === 'overwrite' || result === 'newId') {
          try {
            const data = await readRestoreData(file)
            const options = result === 'overwrite' ? { force: true } : { newId: true }
            await restoreProjectScript({ ...data, ...options })
            snackbar({
              message: 'プロジェクトを復元しました。',
              color: 'success',
            })
            await fetchProjects()
            return
          } catch (retryError: any) {
            console.error(retryError)
            snackbar({
              message: `復元に失敗しました: ${retryError.message}`,
              color: 'error',
            })
            return
          }
        }
        return // キャンセル時
      }
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
      const base64Data = await downloadProjectZip(project.id)
      // Base64をBlobに変換してダウンロード
      const binaryString = atob(base64Data)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      const blob = new Blob([bytes], { type: 'application/zip' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${project.name}.json.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
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
