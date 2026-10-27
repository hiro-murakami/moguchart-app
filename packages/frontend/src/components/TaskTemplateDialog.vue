<script setup lang="ts">
import { useDiscardConfirm } from '@/composables/useConfirm'
import type { ColorPalette, Label, NewTaskTemplate } from '@functions/types/shared'
import { isEqual } from 'lodash'
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  modelValue: boolean
  template: NewTaskTemplate
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', template: NewTaskTemplate): void
}>()

const localTemplate = ref<NewTaskTemplate>({ ...props.template })
const { confirmAndClose } = useDiscardConfirm()

watch(
  () => props.template,
  (newVal) => {
    // ディープコピーで初期化
    localTemplate.value = JSON.parse(JSON.stringify(newVal))
  },
  { deep: true },
)

const hasChanges = computed(() => {
  return !isEqual(props.template, localTemplate.value)
})

const closeDialog = () => emit('update:modelValue', false)

const close = () => confirmAndClose(hasChanges, closeDialog)

const save = () => {
  emit('save', localTemplate.value)
}

// v-modelバインディング用のcomputed properties
// ネストされたオブジェクトへのアクセスを安全に行うため

const isMilestone = computed(() => localTemplate.value.attribute?.type === 'milestone')

const templateType = computed<'task' | 'milestone'>({
  get: () => (isMilestone.value ? 'milestone' : 'task'),
  set: (val: 'task' | 'milestone') => {
    if (!localTemplate.value.attribute) localTemplate.value.attribute = {}
    if (val === 'milestone') {
      localTemplate.value.attribute.type = 'milestone'
      localTemplate.value.duration = 0
    } else {
      localTemplate.value.attribute.type = undefined
      if (!localTemplate.value.duration || localTemplate.value.duration < 1) {
        localTemplate.value.duration = 1
      }
    }
  },
})

const colorPalette = computed(() => localTemplate.value.attribute?.colorPalette)

const templateLabels = computed(() => localTemplate.value.attribute?.labels || [])

const description = computed(() => localTemplate.value.attribute?.description || '')

const onUpdateColorPalette = (val: ColorPalette | undefined) => {
  if (!localTemplate.value.attribute) localTemplate.value.attribute = {}
  localTemplate.value.attribute.colorPalette = val
}

const onUpdateLabels = (val: Label[]) => {
  if (!localTemplate.value.attribute) localTemplate.value.attribute = {}
  localTemplate.value.attribute.labels = val
}

const onUpdateDescription = (val: string) => {
  if (!localTemplate.value.attribute) localTemplate.value.attribute = {}
  localTemplate.value.attribute.description = val
}
</script>

<template>
  <TaskFormDialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    title="テンプレート編集"
    v-model:name="localTemplate.name"
    :color-palette="colorPalette"
    @update:color-palette="onUpdateColorPalette"
    :labels="templateLabels"
    @update:labels="onUpdateLabels"
    :description="description"
    @update:description="onUpdateDescription"
    :save-disabled="!isMilestone && (!localTemplate.duration || localTemplate.duration < 1)"
    @save="save"
    @close="close"
  >
    <template #extra-fields>
      <v-col cols="12" class="mb-2 d-flex align-center">
        <span class="text-caption text-medium-emphasis mr-3">種別</span>
        <v-btn-toggle
          v-model="templateType"
          mandatory
          density="compact"
          color="primary"
          variant="outlined"
          divided
        >
          <v-btn value="task" size="small" prepend-icon="mdi-chart-timeline">通常タスク</v-btn>
          <v-btn value="milestone" size="small" prepend-icon="mdi-rhombus">マイルストーン</v-btn>
        </v-btn-toggle>
      </v-col>
      <v-col v-if="!isMilestone" cols="3">
        <v-number-input
          v-model="localTemplate.duration"
          label="期間（日）"
          :min="1"
          :step="1"
          density="compact"
          variant="outlined"
          control-variant="stacked"
          hide-details
          suffix="日"
          class="mb-3"
        />
      </v-col>
    </template>
  </TaskFormDialog>
</template>
