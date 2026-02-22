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
    :save-disabled="!localTemplate.duration || localTemplate.duration < 1"
    @save="save"
    @close="close"
  >
    <template #extra-fields>
      <v-col cols="12">
        <v-text-field
          v-model.number="localTemplate.duration"
          label="期間（日）"
          type="number"
          min="1"
          density="compact"
          variant="outlined"
          hide-details
          class="mb-3"
        ></v-text-field>
      </v-col>
    </template>
  </TaskFormDialog>
</template>
