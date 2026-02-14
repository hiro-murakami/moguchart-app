<script setup lang="ts">
import { computed } from 'vue'
import * as moguchart from '@mogura/moguchart'
import type { ColorPalette } from '@functions/types/shared'
import ColorInput from './ColorInput.vue'

const props = defineProps<{
  modelValue: ColorPalette
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: ColorPalette): void
  (e: 'delete'): void
}>()

const color = computed({
  get: () => props.modelValue.color,
  set: (val) => emit('update:modelValue', { ...props.modelValue, color: val }),
})

const backgroundColor = computed({
  get: () => props.modelValue.backgroundColor,
  set: (val) => emit('update:modelValue', { ...props.modelValue, backgroundColor: val }),
})

const pattern = computed({
  get: () => props.modelValue.pattern,
  set: (val) => emit('update:modelValue', { ...props.modelValue, pattern: val }),
})

const patternType = computed({
  get: () => props.modelValue.pattern?.type ?? 'none',
  set: (val) => {
    if (!val || val === 'none') {
      const { pattern: _, ...rest } = props.modelValue
      emit('update:modelValue', rest)
    } else {
      emit('update:modelValue', {
        ...props.modelValue,
        pattern: {
          type: val as string,
          color: props.modelValue.pattern?.color ?? '#000000',
        },
      })
    }
  },
})

const patternColor = computed({
  get: () => props.modelValue.pattern?.color ?? '',
  set: (val) => {
    if (props.modelValue.pattern && val) {
      emit('update:modelValue', {
        ...props.modelValue,
        pattern: { ...props.modelValue.pattern, color: val },
      })
    }
  },
})

const patternOptions = computed(() => [
  { type: 'none', label: 'なし' },
  ...moguchart.ALL_BAR_PATTERNS.map((type) => ({ type, label: type })),
])
</script>

<template>
  <v-card variant="outlined" class="pa-2" style="border-color: rgba(var(--v-border-color), 0.38)">
    <div class="d-flex">
      <!-- プレビューエリア -->
      <div class="mr-4 d-flex align-center justify-center">
        <v-tooltip location="top" open-delay="500">
          <template #activator="{ props }">
            <v-btn v-bind="props" icon="mdi-delete" variant="text" color="error" size="small" @click="emit('delete')" />
          </template>
          <span>削除</span>
        </v-tooltip>
        <div
          :style="`
            width: 80px;
            height: 38px;
            border: 1px solid rgba(var(--v-border-color), 0.38);
            border-radius: 4px;
            background-repeat: repeat;
            background-color: ${backgroundColor || '#ffffff'};
            ${patternType && patternColor ? moguchart.getPatternStyle({ type: patternType, color: patternColor }) : ''}
            display: flex;
            align-items: center;
            justify-content: center;
            color: ${color || '#000000'};
            font-weight: bold;
          `"
        >
          Sample
        </div>
      </div>

      <!-- 設定エリア -->
      <div class="flex-grow-1">
        <v-row dense>
          <v-col cols="auto">
            <ColorInput v-model="color" label="文字色" min-width="120px" />
          </v-col>
          <v-col cols="auto">
            <ColorInput v-model="backgroundColor" label="背景色" min-width="120px" />
          </v-col>

          <v-col cols="auto">
            <v-select
              v-model="patternType"
              :items="patternOptions"
              item-title="type"
              item-value="type"
              label="パターンタイプ"
              hide-details
              density="compact"
              variant="outlined"
              min-width="131px"
            >
              <template #selection="{ item }">
                <div class="d-flex align-center" v-if="item.raw.type !== 'none'">
                  <div
                    :style="`width: 60px; height: 24px; border: 1px solid rgba(var(--v-border-color), 0.38); background-repeat: repeat; background-color: ${backgroundColor || '#ffffff'}; ${moguchart.getPatternStyle({ type: item.raw.type, color: patternColor || '#000000' })}`"
                  ></div>
                </div>
                <div v-else>なし</div>
              </template>
              <template #item="{ props, item }">
                <v-list-item v-bind="props" :title="item.raw.type === 'none' ? 'なし' : ''">
                  <template #prepend v-if="item.raw.type !== 'none'">
                    <div
                      class="mr-2"
                      :style="`width: 60px; height: 24px; border: 1px solid rgba(var(--v-border-color), 0.38); background-repeat: repeat; background-color: ${backgroundColor || '#ffffff'}; ${moguchart.getPatternStyle({ type: item.raw.type, color: patternColor || '#000000' })}`"
                    ></div>
                  </template>
                </v-list-item>
              </template>
            </v-select>
          </v-col>

          <v-col cols="auto" v-if="patternType !== 'none'">
            <ColorInput v-model="patternColor" label="パターン色" min-width="100px" />
          </v-col>
        </v-row>
      </div>
    </div>
  </v-card>
</template>
