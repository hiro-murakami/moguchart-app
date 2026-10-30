<script setup lang="ts">
import { ref, computed } from 'vue'
import dayjs from 'dayjs'
import inputRules from '@/modules/inputRules'
import { getContrastColor } from '@/modules/utils'
import type { CustomNonWorkingDate } from '@functions/types/shared'

const props = withDefaults(
  defineProps<{
    modelValue: CustomNonWorkingDate
    expanded?: boolean
  }>(),
  {
    expanded: undefined,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: CustomNonWorkingDate): void
  (e: 'delete'): void
  (e: 'update:expanded', value: boolean): void
}>()

const internalExpanded = ref(false)

const isExpanded = computed({
  get: () => props.expanded ?? internalExpanded.value,
  set: (val) => {
    internalExpanded.value = val
    emit('update:expanded', val)
  },
})

const start = computed({
  get: () => props.modelValue.start,
  set: (val) => {
    const nextEnd = !props.modelValue.end && val ? val : props.modelValue.end
    emit('update:modelValue', { ...props.modelValue, start: val, end: nextEnd })
  },
})

const end = computed({
  get: () => props.modelValue.end || '',
  set: (val) => emit('update:modelValue', { ...props.modelValue, end: val }),
})

const name = computed({
  get: () => props.modelValue.name || '',
  set: (val) => emit('update:modelValue', { ...props.modelValue, name: val || undefined }),
})

const color = computed({
  get: () => props.modelValue.color || '',
  set: (val) => emit('update:modelValue', { ...props.modelValue, color: val || undefined }),
})

const formattedPeriod = computed(() => {
  const s = start.value ? dayjs(start.value) : null
  const e = end.value ? dayjs(end.value) : null
  const sStr = s && s.isValid() ? s.format('YYYY/MM/DD') : start.value
  const eStr = e && e.isValid() ? e.format('YYYY/MM/DD') : end.value
  if (sStr && eStr) {
    return sStr === eStr ? sStr : `${sStr} 〜 ${eStr}`
  }
  return sStr || eStr || ''
})

const previewBgColor = computed(() => color.value || '#fee2e2')
const previewTextColor = computed(() => getContrastColor(previewBgColor.value))
</script>

<template>
  <v-card variant="outlined" class="non-working-date-input" style="border-color: rgba(var(--v-border-color), 0.38)">
    <!-- ヘッダー行: 削除ボタン + プレビュー + トグル -->
    <div class="d-flex align-center pa-2" style="cursor: pointer" @click="isExpanded = !isExpanded">
      <TooltipBtn
        icon="mdi-delete"
        variant="text"
        color="error"
        size="small"
        tooltip="削除"
        location="top"
        @click.stop="emit('delete')"
      />

      <div
        class="flex-grow-1 mx-2"
        :style="`
          height: 32px;
          border-radius: 4px;
          background-color: ${previewBgColor};
          display: flex;
          align-items: center;
          justify-content: center;
          color: ${previewTextColor};
          font-weight: bold;
          font-size: 0.85rem;
        `"
      >
        <span class="text-truncate px-2">
          <template v-if="name && formattedPeriod">{{ name }} ({{ formattedPeriod }})</template>
          <template v-else-if="formattedPeriod">{{ formattedPeriod }}</template>
          <template v-else-if="name">{{ name }}</template>
          <template v-else>カスタム定休日（日付未設定）</template>
        </span>
      </div>

      <v-btn
        :icon="isExpanded ? 'mdi-chevron-up' : 'mdi-chevron-down'"
        variant="text"
        size="x-small"
        @click.stop="isExpanded = !isExpanded"
      />
    </div>

    <!-- 展開時: 設定エリア -->
    <v-expand-transition>
      <div v-show="isExpanded" class="px-2 pb-2">
        <v-divider class="mb-2" />
        <v-row density="comfortable">
          <v-col cols="6">
            <DateInput
              v-model="start"
              type="date"
              label-daily="開始日"
              :compare-target="end"
              compare-rule="before"
              hide-details="auto"
            />
          </v-col>
          <v-col cols="6">
            <DateInput
              v-model="end"
              type="date"
              label-daily="終了日"
              :compare-target="start"
              compare-rule="after"
              hide-details="auto"
            />
          </v-col>
          <v-col cols="7">
            <v-text-field
              v-model="name"
              label="休日名（任意）"
              density="compact"
              variant="outlined"
              hide-details="auto"
              :rules="[inputRules.within(48)]"
              autocomplete="off"
              clearable
            />
          </v-col>
          <v-col cols="5">
            <v-color-input
              v-model="color"
              color-pip
              label="背景色（任意）"
              variant="outlined"
              pip-variant="flat"
              density="compact"
              hide-details="auto"
              pip-location="prepend-inner"
              show-swatches
              clearable
            />
          </v-col>
        </v-row>
      </div>
    </v-expand-transition>
  </v-card>
</template>

