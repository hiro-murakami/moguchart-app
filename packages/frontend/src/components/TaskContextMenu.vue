<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  modelValue: boolean
  x: number
  y: number
  taskId?: string | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'edit'): void
  (e: 'delete'): void
}>()

const isVisible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})
</script>

<template>
  <div
    v-if="isVisible"
    :style="{
      position: 'fixed',
      top: `${y}px`,
      left: `${x}px`,
      width: '0px',
      height: '0px',
    }"
  >
    <v-menu v-model="isVisible" activator="parent">
      <v-list density="compact">
        <v-list-item prepend-icon="mdi-pencil" title="編集" @click="emit('edit')" />
        <v-divider />
        <v-list-item prepend-icon="mdi-delete" title="削除" @click="emit('delete')" />
      </v-list>
    </v-menu>
  </div>
</template>
