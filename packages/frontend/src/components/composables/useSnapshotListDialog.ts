import type { SnapshotInfo } from '@functions/types/shared'
import { listSnapshots, getSnapshotDownloadUrl, deleteSnapshot } from '@/modules/scripts'
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAlert } from '@/composables/useAlert'
import { useConfirm } from '@/composables/useConfirm'

export const useSnapshotListDialog = (
  props: { modelValue: boolean; projectId: string },
  emit: {
    (e: 'update:modelValue', value: boolean): void
  },
) => {
  const router = useRouter()
  const alert = useAlert()
  const confirm = useConfirm()

  const snapshots = ref<(SnapshotInfo & { displayName: string; displayCreatedAt: string })[]>([])
  const loading = ref(false)

  const headers = [
    { title: 'スナップショット', key: 'displayName', sortable: false },
    { title: '作成日時', key: 'displayCreatedAt', sortable: false },
    { title: '操作', key: 'actions', sortable: false, width: '130px' },
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

  const close = () => {
    emit('update:modelValue', false)
  }

  return {
    snapshots,
    loading,
    headers,
    copiedName,
    downloadingName,
    deletingName,
    copyUrl,
    downloadSnapshot,
    deleteSnapshotItem,
    fetchSnapshots,
    openSnapshot,
    close,
  }
}
