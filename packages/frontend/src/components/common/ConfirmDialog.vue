<script setup lang="ts">
import { ref } from 'vue'

export interface ConfirmButton {
  text: string
  color?: string
  value: string
}

export interface ConfirmOptions {
  title?: string
  message?: string
  confirmText?: string
  cancelText?: string
  confirmColor?: string
  /** 追加ボタン（confirmとcancelの間に表示） */
  buttons?: ConfirmButton[]
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
let resolvePromise: ((value: boolean | string) => void) | null = null
const state = ref({
  title: '',
  message: '',
  confirmText: '',
  cancelText: '',
  confirmColor: '',
  buttons: [] as ConfirmButton[],
})

const open = (options?: ConfirmOptions) => {
  state.value = {
    title: options?.title ?? props.title,
    message: options?.message ?? props.message,
    confirmText: options?.confirmText ?? props.confirmText,
    cancelText: options?.cancelText ?? props.cancelText,
    confirmColor: options?.confirmColor ?? props.confirmColor,
    buttons: options?.buttons ?? [],
  }

  isOpen.value = true
  return new Promise<boolean | string>((resolve) => {
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

const selectButton = (value: string) => {
  isOpen.value = false
  resolvePromise?.(value)
}

defineExpose({ open })
</script>

<template>
  <v-dialog v-model="isOpen" max-width="600">
    <v-card v-draggable-dialog>
      <v-card-title class="pt-6">{{ state.title }}</v-card-title>
      <v-card-text>
        <span v-if="state.message" v-html="state.message"></span>
        <slot></slot>
      </v-card-text>
      <v-card-actions class="pb-6">
        <v-spacer></v-spacer>
        <v-btn color="grey" variant="text" @click="close">
          {{ state.cancelText }}
        </v-btn>
        <v-btn
          v-for="btn in state.buttons"
          :key="btn.value"
          :color="btn.color ?? 'primary'"
          variant="text"
          @click="selectButton(btn.value)"
        >
          {{ btn.text }}
        </v-btn>
        <v-btn v-if="state.buttons.length === 0" :color="state.confirmColor" variant="text" @click="confirm">
          {{ state.confirmText }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
