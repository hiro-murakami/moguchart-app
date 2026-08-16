<script setup lang="ts">
import { ref, computed } from 'vue'
import inputRules from '@/modules/inputRules'
import type { Label } from '@functions/types/shared'
import { getContrastColor } from '@/modules/utils'

const props = withDefaults(
  defineProps<{
    modelValue: Label
    expanded?: boolean
  }>(),
  {
    expanded: undefined,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: Label): void
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

const color = computed({
  get: () => props.modelValue.color,
  set: (val) => emit('update:modelValue', { ...props.modelValue, color: val }),
})
</script>

<template>
  <v-card variant="outlined" class="label-input" style="border-color: rgba(var(--v-border-color), 0.38)">
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
          background-color: ${color || '#cccccc'};
          display: flex;
          align-items: center;
          justify-content: center;
          color: ${getContrastColor(color || '#cccccc')};
          font-weight: bold;
          font-size: 0.85rem;
        `"
      >
        <span class="text-truncate px-2">
          {{ name || 'ラベル名' }}
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
          <v-col>
            <v-text-field
              v-model="name"
              label="ラベル名"
              density="compact"
              variant="outlined"
              hide-details="auto"
              :rules="[inputRules.required, inputRules.within(48)]"
              autocomplete="off"
            />
          </v-col>
          <v-col cols="3">
            <v-color-input
              v-model="color"
              color-pip
              label="色"
              variant="outlined"
              pip-variant="flat"
              density="compact"
              hide-details="auto"
              pip-location="prepend-inner"
              show-swatches
            />
          </v-col>
        </v-row>
      </div>
    </v-expand-transition>
  </v-card>
</template>
