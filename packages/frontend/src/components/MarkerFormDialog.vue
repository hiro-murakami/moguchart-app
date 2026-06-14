<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { MarkerTypeValue, AnchorTypeValue, MarkerFontSizeValue, MarkerAttribute } from '@functions/types/shared'

// スタイルプリセット: type + anchor の組み合わせ
type StylePresetValue = 'left-arrow' | 'right-arrow' | 'down-arrow'
interface StylePreset {
  value: StylePresetValue
  label: string
  type: MarkerTypeValue
  anchor: AnchorTypeValue
}

const props = defineProps<{
  modelValue: boolean
  marker?: MarkerAttribute | null
  defaultDate?: string
  isReadOnly?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', marker: MarkerAttribute): void
  (e: 'delete', markerId: string): void
}>()

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const isEditing = computed(() => !!props.marker?.id)

// フォーム値
const name = ref('')
const date = ref('')
const stylePreset = ref<StylePresetValue>('down-arrow')
const color = ref('#ef4444')
const fontSize = ref<MarkerFontSizeValue | undefined>(undefined)
const showColorPicker = ref(false)

// スタイルプリセットの選択肢
const stylePresetOptions: StylePreset[] = [
  { value: 'left-arrow', label: '◀ マーカー名', type: 'triangle-left', anchor: 'start' },
  { value: 'right-arrow', label: 'マーカー名 ▶', type: 'triangle-right', anchor: 'end' },
  { value: 'down-arrow', label: '▼（改行）マーカー名', type: 'triangle-down', anchor: 'center' },
]

// type + anchor からスタイルプリセットを逆引き
const resolveStylePreset = (type: MarkerTypeValue, anchor?: AnchorTypeValue): StylePresetValue => {
  if (type === 'triangle-left' && anchor === 'start') return 'left-arrow'
  if (type === 'triangle-right' && anchor === 'end') return 'right-arrow'
  return 'down-arrow'
}

// フォントサイズの選択肢
const fontSizeOptions: { value: MarkerFontSizeValue; label: string; px: number }[] = [
  { value: 'xs', label: '極小', px: 8 },
  { value: 'sm', label: '小', px: 10 },
  { value: 'md', label: '中', px: 12 },
  { value: 'lg', label: '大', px: 14 },
  { value: 'xl', label: '特大', px: 18 },
]

// プリセットカラー
const presetColors = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
]

// ダイアログが開いた時にフォーム値を初期化
watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      if (props.marker) {
        name.value = props.marker.name || ''
        // datetime-local用フォーマット（YYYY-MM-DDTHH:mm）に変換
        const d = props.marker.date
        date.value = d.length <= 10 ? `${d}T00:00` : d.replace(' ', 'T').slice(0, 16)
        stylePreset.value = resolveStylePreset(props.marker.type, props.marker.anchor)
        color.value = props.marker.color || '#ef4444'
        fontSize.value = props.marker.fontSize
      } else {
        name.value = ''
        const defaultD = props.defaultDate || new Date().toISOString().slice(0, 10)
        date.value = defaultD.length <= 10 ? `${defaultD}T00:00` : defaultD.replace(' ', 'T').slice(0, 16)
        stylePreset.value = 'left-arrow'
        color.value = '#ef4444'
        fontSize.value = 'md'
      }
    }
  },
  { immediate: true },
)

const handleSave = () => {
  const defaultPreset: StylePreset = { value: 'down-arrow', label: '▼（改行）マーカー名', type: 'triangle-down', anchor: 'center' }
  const preset = stylePresetOptions.find((o) => o.value === stylePreset.value) ?? defaultPreset
  const marker: MarkerAttribute = {
    id: props.marker?.id || '',
    name: name.value || undefined,
    date: date.value,
    type: preset.type,
    anchor: preset.anchor,
    color: color.value,
    fontSize: fontSize.value || undefined,
  }
  emit('save', marker)
}

const handleDelete = () => {
  if (props.marker?.id) {
    emit('delete', props.marker.id)
  }
}
</script>

<template>
  <v-dialog v-model="isOpen" max-width="500">
    <v-card class="pa-2">
      <v-card-title class="d-flex align-center">
        <v-icon class="mr-2" :color="color">mdi-map-marker</v-icon>
        {{ isEditing ? 'マーカーの編集' : '新規マーカー' }}
      </v-card-title>

      <v-card-text>
        <v-text-field
          v-model="name"
          label="名前（任意）"
          density="compact"
          variant="outlined"
          hide-details="auto"
          class="mb-3"
          placeholder="例: リリース予定日"
          autocomplete="off"
        />

        <v-text-field
          v-model="date"
          label="日時"
          type="datetime-local"
          density="compact"
          variant="outlined"
          hide-details="auto"
          class="mb-3"
        />

        <div class="mb-3">
          <label class="text-body-2 text-medium-emphasis d-block mb-1">スタイル</label>
          <v-btn-toggle v-model="stylePreset" variant="outlined" mandatory divided class="style-toggle">
            <v-btn value="left-arrow">
              <span class="style-preview-inline">◀ マーカー名</span>
            </v-btn>
            <v-btn value="right-arrow">
              <span class="style-preview-inline">マーカー名 ▶</span>
            </v-btn>
            <v-btn value="down-arrow">
              <span class="style-preview-down">
                <span>▼</span>
                <span>マーカー名</span>
              </span>
            </v-btn>
          </v-btn-toggle>
        </div>

        <div class="mb-3">
          <label class="text-body-2 text-medium-emphasis d-block mb-1">フォントサイズ</label>
          <v-btn-toggle v-model="fontSize" density="compact" variant="outlined" divided>
            <v-btn v-for="opt in fontSizeOptions" :key="opt.value" :value="opt.value" size="small">
              <span :style="{ fontSize: opt.px + 'px' }">{{ opt.label }}</span>
            </v-btn>
          </v-btn-toggle>
        </div>

        <div class="mb-1">
          <label class="text-body-2 text-medium-emphasis">色</label>
        </div>
        <div class="d-flex flex-wrap" style="gap: 6px">
          <div
            v-for="c in presetColors"
            :key="c"
            class="color-swatch"
            :class="{ selected: color === c }"
            :style="{ backgroundColor: c }"
            @click="color = c"
          />
        </div>
        <v-text-field
          v-model="color"
          label="カスタム色"
          density="compact"
          variant="outlined"
          hide-details="auto"
          class="mt-2"
          prepend-inner-icon="mdi-palette"
        >
          <template #prepend-inner>
            <div
              :style="{
                width: '20px',
                height: '20px',
                borderRadius: '4px',
                backgroundColor: color,
                border: '1px solid rgba(128,128,128,0.3)',
              }"
            />
          </template>
        </v-text-field>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="isOpen = false">キャンセル</v-btn>
        <v-btn
          v-if="!isReadOnly"
          color="primary"
          variant="flat"
          @click="handleSave"
          :disabled="!date"
        >
          {{ isEditing ? '更新' : '作成' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.color-swatch {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.15s ease;
}

.color-swatch:hover {
  transform: scale(1.15);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.color-swatch.selected {
  border-color: rgb(var(--v-theme-on-surface));
  box-shadow: 0 0 0 2px rgb(var(--v-theme-surface)), 0 0 0 4px rgb(var(--v-theme-on-surface));
}

/* スタイル選択ボタン */
.style-toggle {
  height: 42px !important;
}

.style-toggle :deep(.v-btn) {
  text-transform: none !important;
  letter-spacing: normal !important;
  font-size: 13px !important;
  width: 120px;
  height: 42px !important;
  padding: 0px 12px !important;
}

.style-preview-inline {
  white-space: nowrap;
}

.style-preview-down {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.2;
}
</style>
