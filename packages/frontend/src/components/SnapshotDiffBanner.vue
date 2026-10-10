<script setup lang="ts">
import type { SnapshotDiffSummary } from '@/views/composables/useSnapshotDiff'
import TooltipBtn from './common/TooltipBtn.vue'

const props = withDefaults(
  defineProps<{
    diffSummary: SnapshotDiffSummary | null
    baselinePosition: 'bottom' | 'top' | 'overlay'
    diffHighlightOnly?: boolean
  }>(),
  {
    diffHighlightOnly: true,
  },
)

const emit = defineEmits<{
  (e: 'update:baselinePosition', value: 'bottom' | 'top' | 'overlay'): void
  (e: 'update:diffHighlightOnly', value: boolean): void
  (e: 'openDetail'): void
  (e: 'close'): void
}>()

const getPositionLabel = (pos: 'bottom' | 'top' | 'overlay') => {
  switch (pos) {
    case 'top':
      return '上部'
    case 'overlay':
      return '重ねて表示'
    case 'bottom':
    default:
      return '下部（標準）'
  }
}
</script>

<template>
  <div v-if="diffSummary" class="snapshot-diff-banner rounded-lg px-3 py-2 mb-3">
    <div class="d-flex align-center justify-space-between flex-wrap gap-2">
      <!-- 左側: タイトルとサマリーチップ -->
      <div class="d-flex align-center flex-wrap gap-2">
        <div class="d-flex align-center font-weight-medium">
          <v-icon icon="mdi-compare" color="info" size="small" class="mr-1" />
          <span class="text-caption font-weight-bold text-medium-emphasis mr-1">差分比較中:</span>
          <span class="text-body-2 font-weight-bold text-truncate" style="max-width: 220px">
            {{ diffSummary.snapshotDisplayName }}
          </span>
        </div>

        <div class="d-flex align-center gap-1 ml-1">
          <v-chip
            v-if="diffSummary.delayedCount > 0"
            size="x-small"
            color="error"
            variant="flat"
            class="font-weight-bold cursor-pointer"
            @click="emit('openDetail')"
          >
            {{ diffSummary.delayedCount }}件遅延
          </v-chip>
          <v-chip
            v-if="diffSummary.aheadCount > 0"
            size="x-small"
            color="success"
            variant="flat"
            class="font-weight-bold cursor-pointer"
            @click="emit('openDetail')"
          >
            {{ diffSummary.aheadCount }}件前倒し
          </v-chip>
          <v-chip
            v-if="diffSummary.shiftedCount > 0"
            size="x-small"
            color="secondary"
            variant="flat"
            class="font-weight-bold cursor-pointer"
            @click="emit('openDetail')"
          >
            {{ diffSummary.shiftedCount }}件スライド
          </v-chip>
          <v-chip
            v-if="diffSummary.addedCount > 0"
            size="x-small"
            color="teal"
            variant="flat"
            class="font-weight-bold cursor-pointer"
            @click="emit('openDetail')"
          >
            {{ diffSummary.addedCount }}件追加
          </v-chip>
          <v-chip
            v-if="diffSummary.deletedCount > 0"
            size="x-small"
            color="warning"
            variant="flat"
            class="font-weight-bold cursor-pointer"
            @click="emit('openDetail')"
          >
            {{ diffSummary.deletedCount }}件削除
          </v-chip>
        </div>
      </div>

      <!-- 右側: コントロールボタン -->
      <div class="d-flex align-center gap-1">
        <!-- 差分のみ強調トグルボタン -->
        <v-tooltip location="bottom" text="差分のないタスクを半透明化して差分タスクを目立たせます">
          <template #activator="{ props: tipProps }">
            <v-btn
              v-bind="tipProps"
              size="small"
              :variant="diffHighlightOnly ? 'tonal' : 'text'"
              :color="diffHighlightOnly ? 'primary' : undefined"
              density="comfortable"
              :prepend-icon="diffHighlightOnly ? 'mdi-filter-check' : 'mdi-filter-outline'"
              @click="emit('update:diffHighlightOnly', !diffHighlightOnly)"
            >
              {{ diffHighlightOnly ? '差分のみ強調' : '全タスク表示' }}
            </v-btn>
          </template>
        </v-tooltip>

        <!-- 配置位置メニュー -->
        <v-menu>
          <template #activator="{ props: menuProps }">
            <v-btn
              v-bind="menuProps"
              size="small"
              variant="text"
              density="comfortable"
              prepend-icon="mdi-layers-outline"
            >
              配置: {{ getPositionLabel(baselinePosition) }}
            </v-btn>
          </template>
          <v-list density="compact">
            <v-list-item
              title="下部に配置（標準）"
              subtitle="タスクバーの下にスナップショット計画を表示"
              :active="baselinePosition === 'bottom'"
              @click="emit('update:baselinePosition', 'bottom')"
            />
            <v-list-item
              title="上部に配置"
              subtitle="タスクバーの上にスナップショット計画を表示"
              :active="baselinePosition === 'top'"
              @click="emit('update:baselinePosition', 'top')"
            />
            <v-list-item
              title="重ねて表示（背景）"
              subtitle="タスクバーの背面にスナップショット計画を表示"
              :active="baselinePosition === 'overlay'"
              @click="emit('update:baselinePosition', 'overlay')"
            />
          </v-list>
        </v-menu>

        <!-- 差分詳細ボタン -->
        <v-btn
          size="small"
          variant="tonal"
          color="info"
          density="comfortable"
          prepend-icon="mdi-file-document-outline"
          @click="emit('openDetail')"
        >
          差分詳細
        </v-btn>

        <!-- 解除ボタン -->
        <TooltipBtn
          icon="mdi-close"
          size="small"
          density="comfortable"
          variant="text"
          tooltip="差分比較を解除"
          @click="emit('close')"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.snapshot-diff-banner {
  background-color: rgba(var(--v-theme-info), 0.1);
  border: 1px solid rgba(var(--v-theme-info), 0.3);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.cursor-pointer {
  cursor: pointer;
}
</style>
