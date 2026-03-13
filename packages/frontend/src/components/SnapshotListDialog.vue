<script setup lang="ts">
import type { SnapshotInfo } from '@functions/types/shared'
import { listSnapshots } from '@/modules/scripts'
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useLoading } from '@/composables/useLoading'
import { useAlert } from '@/composables/useAlert'

const props = defineProps<{
  modelValue: boolean
  projectId: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const router = useRouter()
const { setIsLoading } = useLoading()
const alert = useAlert()

const snapshots = ref<(SnapshotInfo & { displayName: string; displayCreatedAt: string })[]>([])
const loading = ref(false)

const headers = [
  { title: 'スナップショット', key: 'displayName', sortable: false },
  { title: '作成日時', key: 'displayCreatedAt', sortable: false },
  { title: '', key: 'actions', sortable: false, width: '48px' },
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

/**
 * タイムスタンプ文字列（YYYYMMDD_HHmmss）を見やすい形式に変換
 */
const formatSnapshotName = (name: string): string => {
  // 例: 20260313_180000 → 2026/03/13 18:00:00
  const match = name.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/)
  if (match) {
    const [, year, month, day, hour, minute, second] = match
    return `${year}/${month}/${day} ${hour}:${minute}:${second}`
  }
  return name
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
</script>

<template>
  <v-dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" max-width="700px">
    <v-card>
      <v-card-title class="d-flex justify-space-between align-center pt-6 px-6 pb-4">
        <span>スナップショット一覧</span>
        <v-btn icon="mdi-close" variant="text" @click="close"></v-btn>
      </v-card-title>
      <v-card-text class="px-6 pb-6 pt-0">
        <v-data-table
          :headers="headers"
          :items="snapshots"
          :loading="loading"
          hover
          density="compact"
          class="row-pointer"
          no-data-text="スナップショットはまだありません"
          @click:row="(_: unknown, { item }: { item: any }) => openSnapshot(item)"
        >
          <template #item.displayName="{ item }">
            <div class="d-flex align-center py-2">
              <v-icon icon="mdi-camera" size="small" class="mr-2 text-medium-emphasis" />
              <span class="font-weight-medium">{{ item.displayName }}</span>
            </div>
          </template>
          <template #item.displayCreatedAt="{ item }">
            <span class="text-caption text-medium-emphasis">{{ item.displayCreatedAt }}</span>
          </template>
          <template #item.actions="{ item }">
            <v-btn
              :icon="copiedName === item.name ? 'mdi-check' : 'mdi-content-copy'"
              :color="copiedName === item.name ? 'success' : undefined"
              variant="text"
              size="small"
              density="comfortable"
              @click="(e: Event) => copyUrl(item, e)"
            />
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.row-pointer :deep(tbody tr) {
  cursor: pointer;
}
</style>
