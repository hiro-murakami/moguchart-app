<script setup lang="ts">
import { useSnapshotListDialog } from './composables/useSnapshotListDialog'

const props = defineProps<{
  modelValue: boolean
  projectId: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const {
  snapshots,
  loading,
  headers,
  copiedName,
  downloadingName,
  deletingName,
  copyUrl,
  downloadSnapshot,
  deleteSnapshotItem,
  openSnapshot,
  close,
} = useSnapshotListDialog(props, emit)
</script>

<template>
  <v-dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" max-width="800px">
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
              <v-icon
                :icon="item.displayName.startsWith('自動履歴') ? 'mdi-history' : 'mdi-camera'"
                size="small"
                class="mr-2 text-medium-emphasis"
              />
              <span class="font-weight-medium">{{ item.displayName }}</span>
            </div>
          </template>
          <template #item.displayCreatedAt="{ item }">
            <span class="text-caption text-medium-emphasis">{{ item.displayCreatedAt }}</span>
          </template>
          <template #item.actions="{ item }">
            <div class="d-flex">
              <v-btn
                :icon="copiedName === item.name ? 'mdi-check' : 'mdi-content-copy'"
                :color="copiedName === item.name ? 'success' : undefined"
                variant="text"
                size="small"
                density="comfortable"
                @click="(e: Event) => copyUrl(item, e)"
              />
              <v-btn
                :icon="downloadingName === item.name ? 'mdi-loading' : 'mdi-download'"
                :class="{ 'spin-animation': downloadingName === item.name }"
                :disabled="downloadingName !== null"
                variant="text"
                size="small"
                density="comfortable"
                @click="(e: Event) => downloadSnapshot(item, e)"
              />
              <v-btn
                :icon="deletingName === item.name ? 'mdi-loading' : 'mdi-delete'"
                :class="{ 'spin-animation': deletingName === item.name }"
                :disabled="deletingName !== null"
                color="error"
                variant="text"
                size="small"
                density="comfortable"
                @click="(e: Event) => deleteSnapshotItem(item, e)"
              />
            </div>
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

.spin-animation :deep(.v-icon) {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
