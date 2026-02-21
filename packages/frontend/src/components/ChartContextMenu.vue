<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  modelValue: boolean
  x: number
  y: number
  date?: Date
  rowId?: string
  canUndo?: boolean
  canRedo?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'new-task', date: Date, rowId: string): void
  (e: 'undo'): void
  (e: 'redo'): void
}>()

const isMac = computed(() => /Mac|iPhone|iPad|iPod/.test(navigator.userAgent))
const undoShortcut = computed(() => (isMac.value ? '⌘Z' : 'Ctrl+Z'))
const redoShortcut = computed(() => (isMac.value ? '⌘⇧Z' : 'Ctrl+Y / Ctrl+Shift+Z'))

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

const handleUndo = () => {
  emit('undo')
  isOpen.value = false
}

const handleRedo = () => {
  emit('redo')
  isOpen.value = false
}
</script>

<template>
  <v-menu v-model="isOpen" :style="{ top: `${y}px`, left: `${x}px` }" absolute offset-y>
    <v-list density="compact" class="py-0">
      <v-list-item @click="handleNewTask" prepend-icon="mdi-plus">
        <v-list-item-title>新規タスク</v-list-item-title>
      </v-list-item>
      <v-divider />
      <v-list-item @click="handleUndo" prepend-icon="mdi-undo" :disabled="!canUndo">
        <v-list-item-title>
          元に戻す
          <span class="text-caption text-medium-emphasis ml-2">{{ undoShortcut }}</span>
        </v-list-item-title>
      </v-list-item>
      <v-list-item @click="handleRedo" prepend-icon="mdi-redo" :disabled="!canRedo">
        <v-list-item-title>
          やり直し
          <span class="text-caption text-medium-emphasis ml-2">{{ redoShortcut }}</span>
        </v-list-item-title>
      </v-list-item>
    </v-list>
  </v-menu>
</template>
