<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  modelValue: boolean
  row?: {
    id: number
    name: string
    description?: string
  }
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', data: { id: number; name: string; description?: string }): void
}>()

const isVisible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const form = ref({
  name: '',
  description: '',
})

watch(
  () => props.row,
  (newRow) => {
    if (newRow) {
      form.value = {
        name: newRow.name,
        description: newRow.description || '',
      }
    }
  },
  { immediate: true },
)

const save = () => {
  if (!props.row) return
  emit('save', {
    id: props.row.id,
    name: form.value.name,
    description: form.value.description,
  })
}
</script>

<template>
  <v-dialog v-model="isVisible" max-width="500px">
    <v-card>
      <v-card-title>行の編集</v-card-title>
      <v-card-text>
        <v-text-field v-model="form.name" label="行名" required autofocus />
        <v-textarea v-model="form.description" label="説明" rows="3" />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn color="grey" variant="text" @click="isVisible = false">キャンセル</v-btn>
        <v-btn color="primary" variant="text" @click="save" :disabled="!form.name">保存</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
