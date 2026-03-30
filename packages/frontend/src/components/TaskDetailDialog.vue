<script setup lang="ts">
import { useDiscardConfirm } from '@/composables/useConfirm'
import inputRules from '@/modules/inputRules'
import type { ColorPalette, EditingTaskData, Label, SimpleRowData } from '@functions/types/shared'
import { isEqual, cloneDeep } from 'lodash'
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  modelValue: boolean
  task: EditingTaskData
  rows: SimpleRowData[]
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

// 操作制限の選択肢
const restrictionOptions = [
  { title: 'リサイズ不可', value: 'notResizable' },
  { title: '横移動不可', value: 'notMoveDate' },
  { title: '行移動不可', value: 'notMoveRow' },
]

// 選択中の制限をstring[]で管理するcomputed
const selectedRestrictions = computed({
  get: () => {
    const result: string[] = []
    if (localTask.value.restrictions?.resizable === false) result.push('notResizable')
    if (localTask.value.restrictions?.moveDate === false) result.push('notMoveDate')
    if (localTask.value.restrictions?.moveRow === false) result.push('notMoveRow')
    return result
  },
  set: (val: string[]) => {
    if (!localTask.value.restrictions) {
      localTask.value.restrictions = {}
    }
    localTask.value.restrictions.resizable = !val.includes('notResizable')
    localTask.value.restrictions.moveDate = !val.includes('notMoveDate')
    localTask.value.restrictions.moveRow = !val.includes('notMoveRow')
  },
})
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
      <v-col cols="6">
        <v-text-field
          v-model="localTask.start"
          label="開始日"
          type="date"
          density="compact"
          variant="outlined"
          hide-details="auto"
          :rules="[inputRules.required, inputRules.dateBefore(localTask.end)]"
          class="mb-3"
        ></v-text-field>
      </v-col>
      <v-col cols="6">
        <v-text-field
          v-model="localTask.end"
          label="終了日"
          type="date"
          density="compact"
          variant="outlined"
          hide-details="auto"
          :rules="[inputRules.required, inputRules.dateAfter(localTask.start)]"
          class="mb-3"
        ></v-text-field>
      </v-col>
      <v-col cols="12">
        <v-select
          v-model="selectedRestrictions"
          :items="restrictionOptions"
          label="操作制限"
          multiple
          chips
          closable-chips
          density="compact"
          variant="outlined"
          hide-details
          placeholder="制限なし"
        ></v-select>
      </v-col>
    </template>
  </TaskFormDialog>
</template>

