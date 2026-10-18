<script setup lang="ts">
import { useDiscardConfirm } from '@/composables/useConfirm'
import {
  DEPENDENCY_TYPE_OPTIONS,
  LAG_UNIT_OPTIONS,
  lagValueAndUnitToMinutes,
  minutesToLagValueAndUnit,
  type LagUnit,
} from '@/modules/utils'
import type { DependencyType, ProjectGranularity } from '@functions/types/shared'
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  modelValue: boolean
  sourceTaskName: string
  targetTaskName: string
  dependencyType: DependencyType
  lagMinutes: number
  granularity?: ProjectGranularity
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', payload: { type: DependencyType; lag: number }): void
  (e: 'delete'): void
}>()

const isOpen = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const localType = ref<DependencyType>('FS')
const localLagValue = ref<number>(0)
const localLagUnit = ref<LagUnit>('days')

const initialType = ref<DependencyType>('FS')
const initialLagMinutes = ref<number>(0)

const { confirmAndClose } = useDiscardConfirm()

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      localType.value = props.dependencyType || 'FS'
      const { value, unit } = minutesToLagValueAndUnit(props.lagMinutes, props.granularity)
      localLagValue.value = value
      localLagUnit.value = unit

      initialType.value = localType.value
      initialLagMinutes.value = props.lagMinutes || 0
    }
  },
  { immediate: true },
)

const currentLagMinutes = computed(() =>
  lagValueAndUnitToMinutes(localLagValue.value, localLagUnit.value),
)

const hasChanges = computed(() => {
  return localType.value !== initialType.value || currentLagMinutes.value !== initialLagMinutes.value
})

const closeDialog = () => emit('update:modelValue', false)

const handleCancel = () => confirmAndClose(hasChanges, closeDialog)

const handleSave = () => {
  emit('save', {
    type: localType.value,
    lag: currentLagMinutes.value,
  })
}

const handleDelete = () => {
  emit('delete')
}
</script>

<template>
  <v-dialog v-model="isOpen" max-width="520" :persistent="hasChanges" no-click-animation>
    <v-card class="pa-2" v-draggable-dialog>
      <v-card-title class="d-flex align-center">
        <v-icon class="mr-2" color="primary">mdi-vector-polyline-edit</v-icon>
        接続線の編集
      </v-card-title>

      <v-card-text>
        <!-- 先行タスク → 後続タスク の表示 -->
        <v-sheet
          rounded="lg"
          border
          class="pa-3 mb-4 d-flex align-center justify-space-between text-body-2 bg-surface-light"
        >
          <div class="text-truncate" style="max-width: 44%">
            <div class="text-caption text-medium-emphasis">先行タスク</div>
            <div class="font-weight-medium text-truncate" :title="sourceTaskName">
              {{ sourceTaskName || '（名称なし）' }}
            </div>
          </div>
          <v-icon color="medium-emphasis" class="mx-2">mdi-arrow-right</v-icon>
          <div class="text-truncate" style="max-width: 44%">
            <div class="text-caption text-medium-emphasis">後続タスク</div>
            <div class="font-weight-medium text-truncate" :title="targetTaskName">
              {{ targetTaskName || '（名称なし）' }}
            </div>
          </div>
        </v-sheet>

        <!-- 依存関係の種別 -->
        <v-select
          v-model="localType"
          :items="DEPENDENCY_TYPE_OPTIONS"
          item-title="title"
          item-value="value"
          label="接続種別"
          density="compact"
          variant="outlined"
          hide-details="auto"
          class="mb-4"
        >
          <template #item="{ props: itemProps, item }">
            <v-list-item v-bind="itemProps" :subtitle="(item as any).raw?.subtitle ?? item.subtitle" />
          </template>
        </v-select>

        <!-- ラグ / リード -->
        <div class="text-caption text-medium-emphasis mb-1">
          ラグ / リード（遅延・前倒し期間）
        </div>
        <v-row density="compact" align="center">
          <v-col cols="7">
            <v-number-input
              v-model="localLagValue"
              label="期間"
              :step="1"
              density="compact"
              variant="outlined"
              control-variant="stacked"
              hide-details
              autocomplete="off"
            />
          </v-col>
          <v-col cols="5">
            <v-select
              v-model="localLagUnit"
              :items="LAG_UNIT_OPTIONS"
              item-title="title"
              item-value="value"
              label="単位"
              density="compact"
              variant="outlined"
              hide-details
            />
          </v-col>
        </v-row>
        <div class="text-caption text-medium-emphasis mt-1">
          正の値で遅延（ラグ）、負の値で前倒し（リード）を設定できます。自動スケジューリング有効時に反映されます。
        </div>
      </v-card-text>

      <v-card-actions>
        <v-btn color="error" variant="text" prepend-icon="mdi-delete" @click="handleDelete">
          削除
        </v-btn>
        <v-spacer />
        <v-btn variant="text" @click="handleCancel">キャンセル</v-btn>
        <v-btn color="primary" variant="flat" @click="handleSave">保存</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
