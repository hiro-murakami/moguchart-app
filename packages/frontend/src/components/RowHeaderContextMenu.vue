<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  modelValue: boolean
  x: number
  y: number
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'add-row-above'): void
  (e: 'add-row-below'): void
  (e: 'delete-row'): void
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
        <v-list-item
          prepend-icon="mdi-arrow-up"
          title="上に行を追加"
          @click="emit('add-row-above')"
        />
        <v-list-item
          prepend-icon="mdi-arrow-down"
          title="下に行を追加"
          @click="emit('add-row-below')"
        />
        <v-divider />
        <v-list-item
          prepend-icon="mdi-delete"
          title="行を削除"
          @click="emit('delete-row')"
        />
      </v-list>
    </v-menu>
  </div>
</template>
