<script setup lang="ts">
import { ref, computed } from 'vue'
import dayjs from 'dayjs'
import inputRules from '@/modules/inputRules'
import { getContrastColor } from '@/modules/utils'
import type { Milestone } from '@functions/types/shared'

const props = withDefaults(
  defineProps<{
    modelValue: Milestone
    expanded?: boolean
  }>(),
  {
    expanded: undefined,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: Milestone): void
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

const name = computed({
  get: () => props.modelValue.name,
  set: (val) => emit('update:modelValue', { ...props.modelValue, name: val }),
})

const datetime = computed({
  get: () => props.modelValue.datetime,
  set: (val) => emit('update:modelValue', { ...props.modelValue, datetime: val }),
})

const color = computed({
  get: () => props.modelValue.color,
  set: (val) => emit('update:modelValue', { ...props.modelValue, color: val }),
})

const formattedDatetime = computed(() => {
  if (!datetime.value) return ''
  const d = dayjs(datetime.value)
  return d.isValid() ? d.format('YYYY/MM/DD HH:mm') : datetime.value
})
</script>

<template>
  <v-card variant="outlined" class="milestone-input" style="border-color: rgba(var(--v-border-color), 0.38)">
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
          background-color: ${color || '#FF0000'};
          display: flex;
          align-items: center;
          justify-content: center;
          color: ${getContrastColor(color || '#FF0000')};
          font-weight: bold;
          font-size: 0.85rem;
        `"
      >
        <span class="text-truncate px-2">
          {{ name || 'マイルストーン名' }}
          <template v-if="formattedDatetime"> ({{ formattedDatetime }})</template>
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
        <v-row density="compact">
          <v-col cols="12" sm="5">
            <v-text-field
              v-model="name"
              label="マイルストーン名"
              density="compact"
              variant="outlined"
              hide-details="auto"
              :rules="[inputRules.required, inputRules.within(48)]"
              autocomplete="off"
            />
          </v-col>
          <v-col cols="12" sm="5">
            <DateInput
              v-model="datetime"
              type="datetime-local"
              label-datetime="日時"
              hide-details="auto"
            />
          </v-col>
          <v-col cols="12" sm="2">
            <ColorInput v-model="color" label="色" min-width="100px" />
          </v-col>
        </v-row>
      </div>
    </v-expand-transition>
  </v-card>
</template>
