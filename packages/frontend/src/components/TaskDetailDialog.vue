<script setup lang="ts">
import { useDiscardConfirm } from '@/composables/useConfirm'
import { granularityToInputType } from '@/modules/utils'
import type { ColorPalette, EditingTaskData, Label, SimpleRowData, ProjectGranularity } from '@functions/types/shared'
import { isEqual, cloneDeep } from 'lodash'
import { computed, ref, watch } from 'vue'
import dayjs from 'dayjs'

const props = defineProps<{
  modelValue: boolean
  task: EditingTaskData
  rows: SimpleRowData[]
  granularity?: ProjectGranularity
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', task: EditingTaskData): void
}>()

const localTask = ref<EditingTaskData>(cloneDeep(props.task))
const { confirmAndClose } = useDiscardConfirm()

watch(
  () => props.task,
  (newVal) => {
    localTask.value = cloneDeep(newVal)
  },
  { deep: true },
)

const hasChanges = computed(() => {
  return !isEqual(props.task, localTask.value)
})

const closeDialog = () => emit('update:modelValue', false)

const close = () => confirmAndClose(hasChanges, closeDialog)

const save = () => {
  emit('save', localTask.value)
}

const onUpdateColorPalette = (val: ColorPalette | undefined) => {
  localTask.value.colorPalette = val
}

const onUpdateLabels = (val: Label[]) => {
  localTask.value.labels = val
}

// ロック状態の管理
const isLocked = computed({
  get: () => !!localTask.value.lock,
  set: (val: boolean) => {
    localTask.value.lock = val || undefined
  },
})

const isMonthly = computed(() => props.granularity === 'monthly')

const displayEnd = computed({
  get: () => {
    if (isMonthly.value && localTask.value.end) {
      return dayjs(localTask.value.end).subtract(1, 'day').startOf('month').format('YYYY-MM-DD')
    }
    return localTask.value.end
  },
  set: (val: string) => {
    if (isMonthly.value && val) {
      localTask.value.end = dayjs(val).add(1, 'month').startOf('month').format('YYYY-MM-DD')
    } else {
      localTask.value.end = val
    }
  },
})

const inputType = computed(() => granularityToInputType(props.granularity))
</script>

<template>
  <TaskFormDialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    title="タスク編集"
    v-model:name="localTask.name"
    :color-palette="localTask.colorPalette"
    @update:color-palette="onUpdateColorPalette"
    :labels="localTask.labels"
    @update:labels="onUpdateLabels"
    v-model:description="localTask.description"
    @save="save"
    @close="close"
  >
    <template #extra-fields>
      <v-col cols="12">
        <v-select
          v-model="localTask.rowId"
          :items="rows"
          item-title="name"
          item-value="id"
          label="行"
          density="compact"
          variant="outlined"
          hide-details
          autocomplete="off"
          class="mb-3"
        ></v-select>
      </v-col>
      <v-col cols="4">
        <DateInput
          v-model="localTask.start"
          :type="inputType"
          label-daily="開始日"
          label-monthly="開始月"
          label-datetime="開始日時"
          :compare-target="displayEnd"
          compare-rule="before"
          hide-details="auto"
          class="mb-3"
        />
      </v-col>
      <v-col cols="4">
        <DateInput
          v-model="displayEnd"
          :type="inputType"
          label-daily="終了日"
          label-monthly="終了月"
          label-datetime="終了日時"
          :compare-target="localTask.start"
          compare-rule="after"
          hide-details="auto"
          class="mb-3"
        />
      </v-col>
      <v-col cols="4">
        <v-number-input
          v-model="localTask.progress"
          label="進捗率"
          :min="0"
          :max="100"
          :step="5"
          density="compact"
          variant="outlined"
          control-variant="stacked"
          hide-details
          suffix="%"
          class="mb-3"
          clearable
          autocomplete="off"
        />
      </v-col>
      <v-col cols="12">
        <v-switch
          v-model="isLocked"
          label="ロック（移動・リサイズ・削除を禁止）"
          density="compact"
          hide-details
          color="primary"
        ></v-switch>
      </v-col>
    </template>
  </TaskFormDialog>
</template>
