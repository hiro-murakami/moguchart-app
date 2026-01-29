<script setup lang="ts">
import { ref } from 'vue'

export interface AlertOptions {
  title?: string
  message?: string
}

const props = withDefaults(
  defineProps<{
    title?: string
    message?: string
  }>(),
  {
    title: 'アラート',
    message: '',
  },
)

const isOpen = ref(false)
let resolvePromise: ((value: void) => void) | null = null
const state = ref({
  title: '',
  message: '',
})

const open = (options?: AlertOptions) => {
  state.value = {
    title: options?.title ?? props.title,
    message: options?.message ?? props.message,
  }

  isOpen.value = true
  return new Promise<void>((resolve) => {
    resolvePromise = resolve
  })
}

const close = () => {
  isOpen.value = false
  resolvePromise?.()
}

defineExpose({ open })
</script>

<template>
  <v-dialog v-model="isOpen" max-width="600">
    <v-card>
      <v-card-title>{{ state.title }}</v-card-title>
      <v-card-text>
        <div v-if="state.message">{{ state.message }}</div>
        <slot></slot>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="primary" variant="text" @click="close"> OK </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
