<script setup lang="ts">
import { ref } from 'vue'

export interface ConfirmOptions {
  title?: string
  message?: string
  confirmText?: string
  cancelText?: string
  confirmColor?: string
}

const props = withDefaults(
  defineProps<{
    title?: string
    message?: string
    confirmText?: string
    cancelText?: string
    confirmColor?: string
  }>(),
  {
    title: '確認',
    message: '本当に実行しますか？',
    confirmText: 'OK',
    cancelText: 'キャンセル',
    confirmColor: 'primary',
  },
)

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

const isOpen = ref(false)
let resolvePromise: ((value: boolean) => void) | null = null
const state = ref({
  title: '',
  message: '',
  confirmText: '',
  cancelText: '',
  confirmColor: '',
})

const open = (options?: ConfirmOptions) => {
  state.value = {
    title: options?.title ?? props.title,
    message: options?.message ?? props.message,
    confirmText: options?.confirmText ?? props.confirmText,
    cancelText: options?.cancelText ?? props.cancelText,
    confirmColor: options?.confirmColor ?? props.confirmColor,
  }

  isOpen.value = true
  return new Promise<boolean>((resolve) => {
    resolvePromise = resolve
  })
}

const close = () => {
  isOpen.value = false
  resolvePromise?.(false)
  emit('cancel')
}

const confirm = () => {
  isOpen.value = false
  resolvePromise?.(true)
  emit('confirm')
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
        <v-btn color="grey" variant="text" @click="close">
          {{ state.cancelText }}
        </v-btn>
        <v-btn :color="state.confirmColor" variant="text" @click="confirm">
          {{ state.confirmText }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
