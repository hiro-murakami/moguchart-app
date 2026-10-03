<script setup lang="ts">
import { computed, ref, watch } from 'vue'

export interface ProgressTask {
  id: string | number
  name?: string
  progress?: number
}

const props = defineProps<{
  modelValue: boolean
  task?: ProgressTask | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', progress: number): void
  (e: 'close'): void
}>()

const localProgress = ref<number | null>(0)

// ダイアログが開くたびに対象タスクの進捗率で初期化
watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      localProgress.value = props.task?.progress ?? 0
    }
  },
  { immediate: true },
)

const progressRules = [
  (v: unknown) =>
    (v !== null && v !== undefined && v !== '' && !isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= 100) ||
    '0〜100の範囲で入力してください',
]

const isValid = computed(() => {
  const v = localProgress.value
  return v !== null && v !== undefined && !isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= 100
})

const handleSave = () => {
  if (!isValid.value || localProgress.value === null) return
  emit('save', Number(localProgress.value))
}

const handleCancel = () => {
  emit('update:modelValue', false)
  emit('close')
}

const handleKeyEnter = () => {
  if (isValid.value) handleSave()
}

const handleUpdateModelValue = (val: boolean) => {
  emit('update:modelValue', val)
  if (!val) {
    emit('close')
  }
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="280px"
    @update:model-value="handleUpdateModelValue"
  >
    <v-card v-draggable-dialog min-width="240">
      <v-card-title
        v-if="task?.name"
        class="pa-4 text-title-medium font-weight-bold text-truncate"
        :title="task.name"
      >
        {{ task.name }}
      </v-card-title>
      <v-card-text :class="['pa-4', { 'pt-2': !!task?.name }]">
        <v-number-input
          v-model="localProgress"
          label="進捗率"
          :min="0"
          :max="100"
          :step="5"
          density="compact"
          variant="outlined"
          control-variant="split"
          hide-details
          suffix="%"
          :rules="progressRules"
          autofocus
          autocomplete="off"
          @keydown.enter="handleKeyEnter"
        />
      </v-card-text>
      <v-card-actions class="pa-4 pt-0">
        <v-spacer />
        <v-btn color="grey-darken-1" variant="text" @click="handleCancel">キャンセル</v-btn>
        <v-btn color="primary" variant="flat" :disabled="!isValid" class="ml-2" @click="handleSave">
          更新
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
