<script setup lang="ts">
import { useDiscardConfirm } from '@/composables/useConfirm'
import inputRules from '@/modules/inputRules'
import type { ColorPalette, EditingTaskData, Label, SimpleRowData } from '@functions/types/shared'
import { isEqual } from 'lodash'
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

const localTask = ref<EditingTaskData>({ ...props.task })
const { confirmAndClose } = useDiscardConfirm()

watch(
  () => props.task,
  (newVal) => {
    localTask.value = { ...newVal }
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
    </template>
  </TaskFormDialog>
</template>
