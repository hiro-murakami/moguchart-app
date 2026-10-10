<script setup lang="ts">
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import type { SnapshotDiffSummary, TaskDiffItem, TaskDiffStatus } from '@/views/composables/useSnapshotDiff'
import TooltipBtn from './common/TooltipBtn.vue'

const props = defineProps<{
  modelValue: boolean
  diffSummary: SnapshotDiffSummary | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'selectTask', taskId: string): void
}>()

const selectedTab = ref<'all' | 'changed' | 'delayed' | 'ahead' | 'added' | 'deleted'>('all')
const searchQuery = ref('')

const formatDate = (date?: Date) => {
  if (!date) return '-'
  return dayjs(date).format('YYYY/MM/DD')
}

const formatDateWithTime = (dateStr?: string) => {
  if (!dateStr) return ''
  return dayjs(dateStr).format('YYYY/MM/DD HH:mm')
}

const filteredItems = computed<TaskDiffItem[]>(() => {
  if (!props.diffSummary) return []
  let items = props.diffSummary.items

  // タブによる絞り込み
  if (selectedTab.value === 'changed') {
    items = items.filter(
      (item) =>
        item.status === 'delayed' ||
        item.status === 'ahead' ||
        item.status === 'shifted' ||
        item.status === 'progress_only' ||
        item.status === 'name_changed',
    )
  } else if (selectedTab.value === 'delayed') {
    items = items.filter((item) => item.status === 'delayed')
  } else if (selectedTab.value === 'ahead') {
    items = items.filter((item) => item.status === 'ahead')
  } else if (selectedTab.value === 'added') {
    items = items.filter((item) => item.status === 'added')
  } else if (selectedTab.value === 'deleted') {
    items = items.filter((item) => item.status === 'deleted')
  }

  // 検索クエリによる絞り込み
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    items = items.filter(
      (item) => item.name.toLowerCase().includes(q) || item.rowName.toLowerCase().includes(q),
    )
  }

  return items
})

const getStatusColor = (status: TaskDiffStatus) => {
  switch (status) {
    case 'delayed':
      return 'error'
    case 'ahead':
      return 'success'
    case 'shifted':
      return 'secondary'
    case 'progress_only':
      return 'info'
    case 'name_changed':
      return 'indigo'
    case 'added':
      return 'teal'
    case 'deleted':
      return 'warning'
    case 'unchanged':
    default:
      return 'medium-emphasis'
  }
}

const getStatusLabel = (status: TaskDiffStatus) => {
  switch (status) {
    case 'delayed':
      return '遅延'
    case 'ahead':
      return '前倒し'
    case 'shifted':
      return '日程スライド'
    case 'progress_only':
      return '進捗変更'
    case 'name_changed':
      return '名前変更'
    case 'added':
      return '新規追加'
    case 'deleted':
      return '削除済'
    case 'unchanged':
    default:
      return '一致'
  }
}

const changedCount = computed(() => {
  if (!props.diffSummary) return 0
  const s = props.diffSummary
  return s.delayedCount + s.aheadCount + s.shiftedCount + s.progressOnlyCount + s.nameChangedCount
})

const close = () => {
  emit('update:modelValue', false)
}

const handleJumpToTask = (taskId: string) => {
  emit('selectTask', taskId)
  close()
}
</script>

<template>
  <v-dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" max-width="960px" scrollable>
    <v-card v-draggable-dialog class="diff-dialog-card">
      <v-card-title class="d-flex justify-space-between align-center pt-5 px-6 pb-3">
        <div class="d-flex align-center gap-2">
          <v-icon icon="mdi-compare" color="primary" class="mr-1" />
          <span class="text-h6 font-weight-bold">スナップショット差分サマリー</span>
        </div>
        <v-btn icon="mdi-close" variant="text" size="small" @click="close" />
      </v-card-title>

      <v-divider />

      <v-card-text class="pa-6" v-if="diffSummary">
        <!-- 比較対象ヘッダー -->
        <div class="comparison-header mb-4 pa-3 rounded-lg">
          <div class="d-flex align-center justify-space-between flex-wrap gap-2">
            <div>
              <span class="text-caption text-medium-emphasis">比較対象スナップショット:</span>
              <div class="d-flex align-center gap-2 mt-1">
                <v-icon
                  :icon="diffSummary.snapshotDisplayName.startsWith('自動履歴') ? 'mdi-history' : 'mdi-camera'"
                  size="small"
                  class="text-medium-emphasis"
                />
                <span class="font-weight-bold">{{ diffSummary.snapshotDisplayName }}</span>
                <span v-if="diffSummary.snapshotCreatedAt" class="text-caption text-medium-emphasis">
                  ({{ formatDateWithTime(diffSummary.snapshotCreatedAt) }})
                </span>
              </div>
            </div>
            <div class="text-caption text-medium-emphasis">
              現在: <strong>{{ diffSummary.totalCurrentTasks }}</strong> 件 / スナップショット: <strong>{{ diffSummary.totalSnapshotTasks }}</strong> 件
            </div>
          </div>
        </div>

        <!-- 統計カード -->
        <v-row class="mb-4" density="compact">
          <v-col cols="6" sm="4" md="2">
            <v-card variant="tonal" color="error" class="pa-2 text-center stat-card" @click="selectedTab = 'delayed'">
              <div class="text-h5 font-weight-bold">{{ diffSummary.delayedCount }}</div>
              <div class="text-caption font-weight-medium">遅延タスク</div>
            </v-card>
          </v-col>
          <v-col cols="6" sm="4" md="2">
            <v-card variant="tonal" color="success" class="pa-2 text-center stat-card" @click="selectedTab = 'ahead'">
              <div class="text-h5 font-weight-bold">{{ diffSummary.aheadCount }}</div>
              <div class="text-caption font-weight-medium">前倒しタスク</div>
            </v-card>
          </v-col>
          <v-col cols="6" sm="4" md="2">
            <v-card variant="tonal" color="secondary" class="pa-2 text-center stat-card" @click="selectedTab = 'changed'">
              <div class="text-h5 font-weight-bold">{{ diffSummary.shiftedCount }}</div>
              <div class="text-caption font-weight-medium">日程スライド</div>
            </v-card>
          </v-col>
          <v-col cols="6" sm="4" md="2">
            <v-card variant="tonal" color="teal" class="pa-2 text-center stat-card" @click="selectedTab = 'added'">
              <div class="text-h5 font-weight-bold">{{ diffSummary.addedCount }}</div>
              <div class="text-caption font-weight-medium">新規追加</div>
            </v-card>
          </v-col>
          <v-col cols="6" sm="4" md="2">
            <v-card variant="tonal" color="warning" class="pa-2 text-center stat-card" @click="selectedTab = 'deleted'">
              <div class="text-h5 font-weight-bold">{{ diffSummary.deletedCount }}</div>
              <div class="text-caption font-weight-medium">削除タスク</div>
            </v-card>
          </v-col>
          <v-col cols="6" sm="4" md="2">
            <v-card variant="tonal" class="pa-2 text-center stat-card" @click="selectedTab = 'all'">
              <div class="text-h5 font-weight-bold">{{ diffSummary.unchangedCount }}</div>
              <div class="text-caption font-weight-medium">一致タスク</div>
            </v-card>
          </v-col>
        </v-row>

        <!-- タブ & 検索バー -->
        <div class="d-flex align-center justify-space-between flex-wrap gap-2 mb-3">
          <v-tabs v-model="selectedTab" density="compact" color="primary">
            <v-tab value="all">すべて ({{ diffSummary.items.length }})</v-tab>
            <v-tab value="changed">変更あり ({{ changedCount }})</v-tab>
            <v-tab value="delayed">遅延 ({{ diffSummary.delayedCount }})</v-tab>
            <v-tab value="ahead">前倒し ({{ diffSummary.aheadCount }})</v-tab>
            <v-tab value="added">新規追加 ({{ diffSummary.addedCount }})</v-tab>
            <v-tab value="deleted">削除 ({{ diffSummary.deletedCount }})</v-tab>
          </v-tabs>

          <v-text-field
            v-model="searchQuery"
            density="compact"
            variant="outlined"
            placeholder="タスク名や行名で検索..."
            prepend-inner-icon="mdi-magnify"
            hide-details
            clearable
            style="max-width: 250px"
          />
        </div>

        <!-- 差分テーブル -->
        <div class="table-responsive border rounded-lg overflow-hidden">
          <v-table density="compact" hover class="diff-table">
            <thead>
              <tr>
                <th style="width: 100px">状態</th>
                <th style="min-width: 160px">タスク名 / 行</th>
                <th style="min-width: 140px">スナップショット計画</th>
                <th style="min-width: 140px">現在の実績</th>
                <th style="width: 110px">日程差分</th>
                <th style="width: 120px">進捗差分</th>
                <th style="width: 60px" class="text-center">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="filteredItems.length === 0">
                <td colspan="7" class="text-center py-6 text-medium-emphasis">
                  該当するタスクはありません
                </td>
              </tr>
              <tr v-for="item in filteredItems" :key="item.id">
                <td>
                  <v-chip :color="getStatusColor(item.status)" size="x-small" variant="flat" class="font-weight-bold">
                    {{ getStatusLabel(item.status) }}
                  </v-chip>
                </td>
                <td>
                  <div class="font-weight-medium text-body-2">{{ item.name || '(無題)' }}</div>
                  <div class="text-caption text-medium-emphasis">{{ item.rowName }}</div>
                </td>
                <td>
                  <template v-if="item.snapshot">
                    <div class="text-caption font-mono">
                      {{ formatDate(item.snapshot.start) }} - {{ formatDate(item.snapshot.end) }}
                    </div>
                    <div class="text-caption text-medium-emphasis">進捗: {{ item.snapshot.progress }}%</div>
                  </template>
                  <span v-else class="text-caption text-medium-emphasis">-</span>
                </td>
                <td>
                  <template v-if="item.current">
                    <div class="text-caption font-mono">
                      {{ formatDate(item.current.start) }} - {{ formatDate(item.current.end) }}
                    </div>
                    <div class="text-caption text-medium-emphasis">進捗: {{ item.current.progress }}%</div>
                  </template>
                  <span v-else class="text-caption text-medium-emphasis text-decoration-line-through">削除済</span>
                </td>
                <td>
                  <template v-if="item.status === 'delayed'">
                    <span class="text-error font-weight-bold text-caption">+{{ item.delayDays }}日 遅延</span>
                  </template>
                  <template v-else-if="item.status === 'ahead'">
                    <span class="text-success font-weight-bold text-caption">{{ item.delayDays }}日 前倒し</span>
                  </template>
                  <template v-else-if="item.status === 'shifted'">
                    <span class="text-secondary text-caption font-weight-medium">
                      {{ item.startDiffDays > 0 ? `+${item.startDiffDays}日` : `${item.startDiffDays}日` }} シフト
                    </span>
                  </template>
                  <span v-else class="text-caption text-medium-emphasis">-</span>
                </td>
                <td>
                  <template v-if="item.snapshot && item.current">
                    <span
                      class="text-caption font-weight-medium"
                      :class="{
                        'text-success': item.progressDiff > 0,
                        'text-error': item.progressDiff < 0,
                        'text-medium-emphasis': item.progressDiff === 0,
                      }"
                    >
                      {{ item.snapshot.progress }}% → {{ item.current.progress }}%
                      <template v-if="item.progressDiff !== 0">
                        ({{ item.progressDiff > 0 ? `+${item.progressDiff}` : item.progressDiff }}%)
                      </template>
                    </span>
                  </template>
                  <span v-else class="text-caption text-medium-emphasis">-</span>
                </td>
                <td class="text-center">
                  <TooltipBtn
                    v-if="item.status !== 'deleted'"
                    icon="mdi-crosshairs-gps"
                    size="x-small"
                    variant="text"
                    tooltip="チャート上でこのタスクを表示"
                    @click="handleJumpToTask(item.id)"
                  />
                </td>
              </tr>
            </tbody>
          </v-table>
        </div>
      </v-card-text>

      <v-divider />

      <v-card-actions class="px-6 py-3 justify-end">
        <v-btn variant="text" @click="close">閉じる</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.comparison-header {
  background-color: rgba(var(--v-theme-surface-variant), 0.35);
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.stat-card {
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
}

.font-mono {
  font-family: monospace;
}

.diff-table th {
  white-space: nowrap;
  font-weight: 600;
  background-color: rgba(var(--v-theme-surface-variant), 0.2);
}

.diff-table td {
  vertical-align: middle;
}
</style>
