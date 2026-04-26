<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  modelValue: boolean
  x: number
  y: number
  sourceTaskId: string | null
  targetTaskId: string | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'delete'): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const handleDelete = () => {
  emit('delete')
}
</script>

<template>
  <div
    v-if="visible"
    :style="{
      position: 'fixed',
      top: `${y}px`,
      left: `${x}px`,
      width: '0px',
      height: '0px',
    }"
  >
    <v-menu v-model="visible" activator="parent">
      <v-list density="compact" class="py-1">
        <v-list-item @click="handleDelete" base-color="red" prepend-icon="mdi-delete">
          <v-list-item-title>接続線を削除</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
  </div>
</template>
