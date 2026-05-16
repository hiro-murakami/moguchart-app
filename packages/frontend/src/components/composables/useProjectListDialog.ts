import {
  deleteProject as deleteProjectScript,
  duplicateProject as duplicateProjectScript,
  downloadProjectZip,
  restoreProject as restoreProjectScript,
  upsertProject as upsertProjectScript,
  upsertGanttRow,
  upsertGanttTasks,
  selectGanttChart,
} from '@/modules/scripts'
import { useConfirm } from '@/composables/useConfirm'
import { useSnackbar } from '@/composables/useSnackbar'
import type { Project, ProjectGranularity, GanttTask, TaskAttribute } from '@functions/types/shared'
import { ref, watch, computed, nextTick } from 'vue'
import dayjs from 'dayjs'
import { toDateTimeString } from '@/modules/utils'

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
  const duplicateSaving = ref(false)
  const deleting = ref(false)
  const downloading = ref(false)
  const restoring = ref(false)
  const archiving = ref(false)
  const showArchived = ref(false)
  const searchQuery = ref('')
  const isProjectDetailDialogVisible = ref(false)
  const projectToEdit = ref<Project | null>(null)
  const isDuplicateDialogVisible = ref(false)
  const projectToDuplicate = ref<Project | null>(null)
  const initialGranularity = ref<ProjectGranularity>('daily')
  const isSlideScheduleDialogVisible = ref(false)
  const slideScheduleSaving = ref(false)
  const confirm = useConfirm()
  const snackbar = useSnackbar()

  /** アーカイブ状態 + フリーワードでフィルタリングされたプロジェクト一覧 */
  const filteredProjects = computed(() => {
    let list = showArchived.value
      ? projects.value.filter((p) => p.attribute?.archived)
      : projects.value.filter((p) => !p.attribute?.archived)

    const q = (searchQuery.value ?? '').trim().toLowerCase()
    if (q) {
      list = list.filter((p) => {
        const name = (p.name ?? '').toLowerCase()
        const desc = (p.attribute?.description ?? '').toLowerCase()
        return name.includes(q) || desc.includes(q)
      })
    }
    return list
  })

  /** 検索キーワードにマッチする部分を <mark> タグでハイライトする */
  const highlightText = (text: string | undefined): string => {
    if (!text) return ''
    const q = (searchQuery.value ?? '').trim()
    if (!q) return escapeHtml(text)
    const escaped = escapeHtml(text)
    const escapedQuery = escapeHtml(q)
    const regex = new RegExp(`(${escapedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    return escaped.replace(regex, '<mark class="search-highlight">$1</mark>')
  }

  const escapeHtml = (str: string): string => {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

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
    { title: 'モード', key: 'granularity', sortable: false, width: '80px' },
    { title: '操作', key: 'actions', sortable: false, width: '220px' },
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
    isProjectDetailDialogVisible.value = true
  }

  const handleOpenSlideSchedule = async () => {
    isProjectDetailDialogVisible.value = false
    await nextTick()
    isSlideScheduleDialogVisible.value = true
  }

  const handleSlideSchedule = async (options: { newStart: string; clearProgress: boolean }) => {
    if (!projectToEdit.value) return

    slideScheduleSaving.value = true
    try {
      const project = projectToEdit.value
      const granularity = project.attribute?.granularity || 'daily'
      const originalStart = dayjs(project.start)
      const newStart = dayjs(options.newStart)
      const diffMs = newStart.diff(originalStart, 'millisecond')

      if (diffMs === 0) {
        isSlideScheduleDialogVisible.value = false
        return
      }

      // 1. 全タスクをスライド
      const rows = await selectGanttChart(project.id)
      const allTasks: GanttTask[] = []
      for (const row of rows) {
        for (const task of row.tasks) {
          const taskStart = dayjs((task as any).start)
          const taskEnd = dayjs((task as any).end)
          const newTaskStart = taskStart.add(diffMs, 'millisecond')
          const newTaskEnd = taskEnd.add(diffMs, 'millisecond')

          const attr = { ...((task as any).attribute || {}) } as TaskAttribute
          if (options.clearProgress) {
            attr.progress = undefined
          }

          allTasks.push({
            id: Number(task.id),
            rowId: Number((task as any).rowId ?? row.id),
            name: task.name || '',
            start: toDateTimeString(newTaskStart.toDate()),
            end: toDateTimeString(newTaskEnd.toDate()),
            attribute: attr,
          })
        }
      }

      if (allTasks.length > 0) {
        await upsertGanttTasks(allTasks)
      }

      // 2. プロジェクト期間とマイルストーンをスライド
      const isHourly = granularity === 'hourly'
      const originalEnd = dayjs(project.end)
      const newEnd = originalEnd.add(diffMs, 'millisecond')

      const newStartStr = newStart.format('YYYY-MM-DD HH:mm:ss')
      const newEndStr = newEnd.format('YYYY-MM-DD HH:mm:ss')

      const originalMilestones = project.attribute?.milestones || []
      const slidMilestones = originalMilestones.map((m: any) => {
        const mDate = dayjs(m.datetime)
        const newMDate = mDate.add(diffMs, 'millisecond')
        return {
          ...m,
          datetime: isHourly ? newMDate.format('YYYY-MM-DDTHH:mm') : newMDate.format('YYYY-MM-DD'),
        }
      })

      const updatedProject = {
        ...project,
        start: newStartStr,
        end: newEndStr,
        attribute: {
          ...project.attribute,
          milestones: slidMilestones.length > 0 ? slidMilestones : undefined,
        },
      }

      await projectStore.updateProject(updatedProject)
      projectToEdit.value = { ...updatedProject }
      await fetchProjects()

      isSlideScheduleDialogVisible.value = false
      emit('update') // GanttChartViewにガントデータ再読み込みを通知
    } catch (e) {
      console.error(e)
      snackbar({ message: '期間スライドに失敗しました。', color: 'error' })
    } finally {
      slideScheduleSaving.value = false
    }
  }

  const newProject = (granularity: ProjectGranularity = 'daily') => {
    projectToEdit.value = null
    initialGranularity.value = granularity
    isProjectDetailDialogVisible.value = true
  }

  const saveProject = async (project: Partial<Project>) => {
    saving.value = true
    const isNew = projectToEdit.value === null
    try {
      const projectId = await projectStore.updateProject(project as Project)
      isProjectDetailDialogVisible.value = false
      await fetchProjects() // Storeを最新の状態にする

      if (projectId) {
        // 新規作成時は初期行を3行作成する
        if (isNew) {
          const initialRows = [1, 2, 3].map((order) => ({
            id: 0, // 新規作成なので0
            projectId,
            name: `新規行${order}`,
            order,
            visible: true,
            attribute: {},
            tasks: [],
          }))
          await Promise.all(initialRows.map((row) => upsertGanttRow(row)))
        }

        emit('select', projectId)
        close()
      }
    } catch (e) {
      console.error(e)
    } finally {
      saving.value = false
    }
  }

  const saveDuplicateProject = async (project: Partial<Project>, options: { clearProgress: boolean }) => {
    duplicateSaving.value = true
    try {
      const originalProject = projectToDuplicate.value
      if (!originalProject) return

      // 開始日が元と異なる場合、newStartDate を渡してタスク・マイルストーンをスライドさせる
      const newStartDate =
        originalProject.start && project.start && project.start !== originalProject.start.slice(0, project.start.length)
          ? project.start
          : undefined
      const projectId = await duplicateProjectScript({
        originalProjectId: originalProject.id,
        newProjectData: project as Project,
        newStartDate,
        clearProgress: options.clearProgress,
      })

      isDuplicateDialogVisible.value = false
      await fetchProjects() // Storeを最新の状態にする

      if (projectId) {
        emit('select', projectId)
        close()
      }
    } catch (e) {
      console.error(e)
    } finally {
      duplicateSaving.value = false
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
    projectToDuplicate.value = project
    isDuplicateDialogVisible.value = true
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

  /** プロジェクトをアーカイブする */
  const archiveProject = async (project: Project) => {
    if (!project) return

    archiving.value = true
    try {
      const updatedProject = {
        ...project,
        attribute: {
          ...project.attribute,
          archived: true,
          archivedAt: new Date().toISOString(),
        },
      }
      await upsertProjectScript(updatedProject as any)
      await fetchProjects()
      snackbar({
        message: `「${project.name}」をアーカイブしました。`,
        color: 'success',
        timeout: 5000,
        actionText: '元に戻す',
        onAction: () => unarchiveProject(project),
      })
    } catch (e) {
      console.error(e)
      snackbar({
        message: 'アーカイブに失敗しました。',
        color: 'error',
      })
    } finally {
      archiving.value = false
    }
  }

  /** アーカイブしたプロジェクトを復元する */
  const unarchiveProject = async (project: Project) => {
    if (!project) return

    archiving.value = true
    try {
      const updatedProject = {
        ...project,
        attribute: {
          ...project.attribute,
          archived: false,
          archivedAt: undefined,
        },
      }
      await upsertProjectScript(updatedProject as any)
      snackbar({
        message: 'プロジェクトをアーカイブから復元しました。',
        color: 'success',
      })
      await fetchProjects()
    } catch (e) {
      console.error(e)
      snackbar({
        message: 'アーカイブからの復元に失敗しました。',
        color: 'error',
      })
    } finally {
      archiving.value = false
    }
  }

  return {
    projects,
    filteredProjects,
    loading,
    saving,
    duplicateSaving,
    deleting,
    downloading,
    restoring,
    archiving,
    showArchived,
    searchQuery,
    highlightText,
    isProjectDetailDialogVisible,
    projectToEdit,
    isDuplicateDialogVisible,
    projectToDuplicate,
    initialGranularity,
    isSlideScheduleDialogVisible,
    slideScheduleSaving,
    headers,
    fetchProjects,
    selectProject,
    editProject,
    newProject,
    saveProject,
    saveDuplicateProject,
    deleteProject,
    duplicateProject,
    downloadProjectJson,
    restoreProjectFromFile,
    archiveProject,
    unarchiveProject,
    handleOpenSlideSchedule,
    handleSlideSchedule,
    close,
  }
}
