<script setup lang="ts">
import { ref, computed } from 'vue'
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

const expanded = ref(false)

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
  <v-card variant="outlined" class="color-palette-input" style="border-color: rgba(var(--v-border-color), 0.38)">
    <!-- ヘッダー行: 削除ボタン + プレビュー + トグル -->
    <div class="d-flex align-center pa-2" style="cursor: pointer" @click="expanded = !expanded">
      <v-tooltip location="top" open-delay="500">
        <template #activator="{ props: tooltipProps }">
          <v-btn
            v-bind="tooltipProps"
            icon="mdi-delete"
            variant="text"
            color="error"
            size="x-small"
            @click.stop="emit('delete')"
          />
        </template>
        <span>削除</span>
      </v-tooltip>

      <div
        class="flex-grow-1 mx-2"
        :style="`
          height: 32px;
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
          font-size: 0.85rem;
        `"
      >
        Sample
      </div>

      <v-btn
        :icon="expanded ? 'mdi-chevron-up' : 'mdi-chevron-down'"
        variant="text"
        size="x-small"
        @click.stop="expanded = !expanded"
      />
    </div>

    <!-- 展開時: 設定エリア -->
    <v-expand-transition>
      <div v-show="expanded" class="px-2 pb-2">
        <v-divider class="mb-2" />
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
    </v-expand-transition>
  </v-card>
</template>
