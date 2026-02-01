<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Project } from '@functions/types/shared'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', project: Omit<Project, 'id' | 'attribute'>): void
}>()

const localName = ref('')
const localStart = ref('')
const localEnd = ref('')

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      localName.value = ''
      localStart.value = ''
      localEnd.value = ''
    }
  },
)

const close = () => {
  emit('update:modelValue', false)
}

const save = () => {
  if (localName.value && localStart.value && localEnd.value) {
    emit('save', {
      name: localName.value,
      start: localStart.value,
      end: localEnd.value,
    })
  }
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    max-width="400px"
  >
    <v-card>
      <v-card-title>プロジェクト追加</v-card-title>
      <v-card-text>
        <v-text-field
          v-model="localName"
          label="プロジェクト名"
          autofocus
        ></v-text-field>
        <v-text-field
          v-model="localStart"
          label="開始日"
          type="date"
        ></v-text-field>
        <v-text-field
          v-model="localEnd"
          label="終了日"
          type="date"
        ></v-text-field>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="blue-darken-1" variant="text" @click="close">
          キャンセル
        </v-btn>
        <v-btn color="blue-darken-1" variant="text" @click="save"> OK </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
