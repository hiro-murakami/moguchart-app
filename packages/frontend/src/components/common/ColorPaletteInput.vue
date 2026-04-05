<script setup lang="ts">
import { ref, computed } from 'vue'
import * as moguchart from '@mogura/moguchart'
import type { ColorPalette, BorderType } from '@functions/types/shared'

const props = withDefaults(
  defineProps<{
    modelValue: ColorPalette
    textSample?: string
    expanded?: boolean
  }>(),
  {
    expanded: undefined,
    textSample: undefined,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: ColorPalette): void
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

const borderType = computed({
  get: () => props.modelValue.borderType ?? ('none' as any),
  set: (val) => {
    if (!val || val === ('none' as any)) {
      const { borderType: _, borderColor: __, ...rest } = props.modelValue
      emit('update:modelValue', rest)
    } else {
      emit('update:modelValue', {
        ...props.modelValue,
        borderType: val as BorderType,
        borderColor: props.modelValue.borderColor ?? '#ffffff',
      })
    }
  },
})

const borderColor = computed({
  get: () => props.modelValue.borderColor ?? '',
  set: (val) => {
    if (props.modelValue.borderType && val) {
      emit('update:modelValue', {
        ...props.modelValue,
        borderColor: val,
      })
    }
  },
})

const borderOptions = computed(() => [
  { type: 'none', label: 'なし' },
  { type: 'solid_thin', label: '実線 (細)' },
  { type: 'solid_thick', label: '実線 (太)' },
  { type: 'dashed_thin', label: '破線 (細)' },
  { type: 'dashed_thick', label: '破線 (太)' },
  { type: 'dotted_thin', label: '点線 (細)' },
  { type: 'dotted_thick', label: '点線 (太)' },
])

const getBorderStyle = (type?: string, color?: string) => {
  if (!type || type === 'none') return 'border: 1px solid rgba(var(--v-border-color), 0.38);'
  const isThick = type.endsWith('_thick')
  const width = isThick ? '2px' : '1px'
  const style = type.startsWith('dashed') ? 'dashed' : type.startsWith('dotted') ? 'dotted' : 'solid'
  return `border: ${width} ${style} ${color || '#ffffff'};`
}
</script>

<template>
  <v-card variant="outlined" class="color-palette-input" style="border-color: rgba(var(--v-border-color), 0.38)">
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
          ${getBorderStyle(borderType, borderColor)}
          border-radius: 4px;
          background-repeat: repeat;
          background-color: ${backgroundColor || '#ffffff'};
          ${patternType && patternColor ? moguchart.getPatternStyle({ type: patternType as moguchart.BarPattern, color: patternColor }) : ''}
          display: flex;
          align-items: center;
          justify-content: center;
          color: ${color || '#000000'};
          font-weight: bold;
          font-size: 0.85rem;
        `"
      >
        {{ textSample || 'テキストサンプル' }}
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
                <div class="d-flex align-center" v-if="item.type !== 'none'">
                  <div
                    :style="`width: 60px; height: 24px; border: 1px solid rgba(var(--v-border-color), 0.38); background-repeat: repeat; background-color: ${backgroundColor || '#ffffff'}; ${moguchart.getPatternStyle({ type: item.type as moguchart.BarPattern, color: patternColor || '#000000' })}`"
                  ></div>
                </div>
                <div v-else>なし</div>
              </template>
              <template #item="{ props, item }">
                <v-list-item v-bind="props" :title="item.type === 'none' ? 'なし' : ''">
                  <template #prepend v-if="item.type !== 'none'">
                    <div
                      class="mr-2"
                      :style="`width: 60px; height: 24px; border: 1px solid rgba(var(--v-border-color), 0.38); background-repeat: repeat; background-color: ${backgroundColor || '#ffffff'}; ${moguchart.getPatternStyle({ type: item.type as moguchart.BarPattern, color: patternColor || '#000000' })}`"
                    ></div>
                  </template>
                </v-list-item>
              </template>
            </v-select>
          </v-col>

          <v-col cols="auto" v-if="patternType !== 'none'">
            <ColorInput v-model="patternColor" label="パターン色" min-width="100px" />
          </v-col>

          <v-col cols="auto">
            <v-select
              v-model="borderType"
              :items="borderOptions"
              item-title="label"
              item-value="type"
              label="枠線タイプ"
              hide-details
              density="compact"
              variant="outlined"
              min-width="131px"
            >
              <template #selection="{ item }">
                <div class="d-flex align-center" v-if="item.type !== 'none'">
                  <div
                    :style="`width: 60px; height: 24px; ${getBorderStyle(item.type, borderColor || '#ffffff')} background-repeat: repeat; background-color: ${backgroundColor || '#ffffff'}; ${moguchart.getPatternStyle({ type: patternType as moguchart.BarPattern, color: patternColor || '#000000' })}`"
                  ></div>
                </div>
                <div v-else>なし</div>
              </template>
              <template #item="{ props, item }">
                <v-list-item v-bind="props" :title="item.type === 'none' ? 'なし' : ''">
                  <template #prepend v-if="item.type !== 'none'">
                    <div
                      class="mr-2"
                      :style="`width: 60px; height: 24px; ${getBorderStyle(item.type, borderColor || '#ffffff')} background-repeat: repeat; background-color: ${backgroundColor || '#ffffff'}; ${moguchart.getPatternStyle({ type: patternType as moguchart.BarPattern, color: patternColor || '#000000' })}`"
                    ></div>
                  </template>
                </v-list-item>
              </template>
            </v-select>
          </v-col>

          <v-col cols="auto" v-if="borderType !== 'none'">
            <ColorInput v-model="borderColor" label="枠線色" min-width="100px" />
          </v-col>
        </v-row>
      </div>
    </v-expand-transition>
  </v-card>
</template>
