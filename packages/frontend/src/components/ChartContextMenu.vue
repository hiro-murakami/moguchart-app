<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  modelValue: boolean
  x: number
  y: number
  date?: Date
  rowId?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'new-task', date: Date, rowId: string): void
}>()

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const handleNewTask = () => {
  if (props.date && props.rowId) {
    emit('new-task', props.date, props.rowId)
  }
  isOpen.value = false
}
</script>

<template>
  <v-menu v-model="isOpen" :style="{ top: `${y}px`, left: `${x}px` }" absolute offset-y>
    <v-list density="compact" class="py-0">
      <v-list-item @click="handleNewTask" prepend-icon="mdi-plus">
        <v-list-item-title>新規タスク</v-list-item-title>
      </v-list-item>
    </v-list>
  </v-menu>
</template>
