import type { SnapshotInfo } from '@functions/types/shared'
import { listSnapshots, getSnapshotDownloadUrl, deleteSnapshot, loadSnapshot, restoreProject, updateSnapshot } from '@/modules/scripts'
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAlert } from '@/composables/useAlert'
import { useConfirm } from '@/composables/useConfirm'
import { useSnackbar } from '@/composables/useSnackbar'
import { usePrompt } from '@/composables/usePrompt'

export const useSnapshotListDialog = (
  props: { modelValue: boolean; projectId: string; comparingSnapshotName?: string | null },
  emit: {
    (e: 'update:modelValue', value: boolean): void
    (e: 'restored'): void
    (e: 'compare', item: SnapshotInfo & { displayName: string }): void
    (e: 'clearCompare'): void
    (e: 'renamed', payload: { name: string; displayName: string }): void
  },
) => {
  const router = useRouter()
  const alert = useAlert()
  const confirm = useConfirm()
  const snackbar = useSnackbar()
  const prompt = usePrompt()

  const snapshots = ref<(SnapshotInfo & { displayName: string; displayCreatedAt: string })[]>([])
  const loading = ref(false)

  const headers = [
    { title: 'スナップショット', key: 'displayName', sortable: false },
    { title: '作成日時', key: 'displayCreatedAt', sortable: false },
    { title: '操作', key: 'actions', sortable: false, width: '240px' },
  ]

  const copiedName = ref<string | null>(null)
  let copiedTimer: ReturnType<typeof setTimeout> | null = null

  const copyUrl = (item: SnapshotInfo, event: Event) => {
    event.stopPropagation()
    const routeUrl = router.resolve({
      path: `/${props.projectId}/snapshot/${item.name}`,
    })
    const fullUrl = `${window.location.origin}${routeUrl.href}`
    navigator.clipboard.writeText(fullUrl)
    copiedName.value = item.name
    if (copiedTimer) clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => {
      copiedName.value = null
    }, 2000)
  }

  const downloadingName = ref<string | null>(null)

  const downloadSnapshot = async (item: SnapshotInfo, event: Event) => {
    event.stopPropagation()
    if (downloadingName.value) return
    downloadingName.value = item.name
    try {
      const base64Data = await getSnapshotDownloadUrl({
        projectId: props.projectId,
        snapshotName: item.name,
      })
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
      a.download = `${item.displayName || item.name}.json.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to download snapshot:', err)
      await alert({
        title: 'エラー',
        message: 'スナップショットのダウンロードに失敗しました。',
      })
    } finally {
      downloadingName.value = null
    }
  }

  const renamingName = ref<string | null>(null)

  const renameSnapshotItem = async (item: SnapshotInfo & { displayName: string }, event: Event) => {
    event.stopPropagation()
    if (renamingName.value) return

    const newName = await prompt({
      title: 'スナップショット名の変更',
      message: 'スナップショットの新しい名前を入力してください',
      label: 'スナップショット名',
      defaultValue: item.displayName || item.name,
      confirmText: '変更',
    })

    if (newName === null) return
    const trimmed = newName.trim()
    if (trimmed === item.displayName) return

    renamingName.value = item.name
    try {
      const updated = await updateSnapshot({
        projectId: props.projectId,
        snapshotName: item.name,
        displayName: trimmed,
      })
      const finalDisplayName = updated.displayName || updated.name
      item.displayName = finalDisplayName
      const target = snapshots.value.find((s) => s.name === item.name)
      if (target) {
        target.displayName = finalDisplayName
      }
      emit('renamed', { name: item.name, displayName: finalDisplayName })
      snackbar({
        message: 'スナップショット名を変更しました。',
        color: 'success',
      })
    } catch (err) {
      console.error('Failed to rename snapshot:', err)
      await alert({
        title: 'エラー',
        message: 'スナップショット名の変更に失敗しました。',
      })
    } finally {
      renamingName.value = null
    }
  }

  const restoringName = ref<string | null>(null)
  const deletingName = ref<string | null>(null)

  const deleteSnapshotItem = async (item: SnapshotInfo & { displayName: string }, event: Event) => {
    event.stopPropagation()
    if (deletingName.value) return

    const confirmed = await confirm({
      title: 'スナップショットの削除',
      message: `「${item.displayName}」を削除しますか？この操作は取り消せません。`,
    })
    if (!confirmed) return

    deletingName.value = item.name
    try {
      await deleteSnapshot({
        projectId: props.projectId,
        snapshotName: item.name,
      })
      // 一覧から削除
      snapshots.value = snapshots.value.filter((s) => s.name !== item.name)
    } catch (err) {
      console.error('Failed to delete snapshot:', err)
      await alert({
        title: 'エラー',
        message: 'スナップショットの削除に失敗しました。',
      })
    } finally {
      deletingName.value = null
    }
  }

  const fetchSnapshots = async () => {
    if (!props.projectId) return
    loading.value = true
    try {
      const data = await listSnapshots(props.projectId)
      snapshots.value = data.map((s) => ({
        ...s,
        displayName: s.displayName || s.name,
        displayCreatedAt: s.createdAt ? new Date(s.createdAt).toLocaleString('ja-JP') : '',
      }))
    } catch (err) {
      console.error('Failed to fetch snapshots:', err)
      await alert({
        title: 'エラー',
        message: 'スナップショット一覧の取得に失敗しました。',
      })
    } finally {
      loading.value = false
    }
  }

  // ダイアログ表示時にデータを取得
  watch(
    () => props.modelValue,
    (visible) => {
      if (visible) {
        fetchSnapshots()
      }
    },
  )

  const openSnapshot = (item: SnapshotInfo & { displayName?: string }) => {
    const routeUrl = router.resolve({
      path: `/${props.projectId}/snapshot/${item.name}`,
    })
    window.open(routeUrl.href, '_blank', 'noopener,noreferrer')
  }

  const restoreFromSnapshot = async (item: SnapshotInfo & { displayName: string }, event: Event) => {
    event.stopPropagation()
    if (restoringName.value) return

    const confirmed = await confirm({
      title: 'スナップショットからの復元',
      message: `「${item.displayName}」の内容で現在のプロジェクトを上書き復元しますか？<br><span class="text-error font-weight-bold">※現在のプロジェクトデータは上書きされます。</span>`,
      confirmText: '復元',
      confirmColor: 'warning',
    })
    if (!confirmed) return

    restoringName.value = item.name
    try {
      // スナップショットデータを取得
      const snapshotData = await loadSnapshot({
        projectId: props.projectId,
        snapshotName: item.name,
      })

      // 現在のプロジェクトに上書き復元
      await restoreProject({ ...snapshotData, force: true })

      snackbar({
        message: 'スナップショットからプロジェクトを復元しました。',
        color: 'success',
      })
      emit('restored')
    } catch (err) {
      console.error('Failed to restore from snapshot:', err)
      await alert({
        title: 'エラー',
        message: 'スナップショットからの復元に失敗しました。',
      })
    } finally {
      restoringName.value = null
    }
  }

  const compareSnapshot = (item: SnapshotInfo & { displayName: string }, event: Event) => {
    event.stopPropagation()
    if (props.comparingSnapshotName === item.name) {
      emit('clearCompare')
      snackbar({
        message: '差分比較を解除しました。',
        color: 'info',
      })
    } else {
      emit('compare', item)
      close()
    }
  }

  const close = () => {
    emit('update:modelValue', false)
  }

  return {
    snapshots,
    loading,
    headers,
    copiedName,
    downloadingName,
    renamingName,
    restoringName,
    deletingName,
    copyUrl,
    downloadSnapshot,
    renameSnapshotItem,
    restoreFromSnapshot,
    deleteSnapshotItem,
    compareSnapshot,
    fetchSnapshots,
    openSnapshot,
    close,
  }
}
