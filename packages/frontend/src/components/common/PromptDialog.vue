<script setup lang="ts">
import { ref, nextTick } from 'vue'

export interface PromptOptions {
  title?: string
  message?: string
  label?: string
  defaultValue?: string
  confirmText?: string
  cancelText?: string
}

const props = withDefaults(
  defineProps<{
    title?: string
    message?: string
    label?: string
    defaultValue?: string
    confirmText?: string
    cancelText?: string
  }>(),
  {
    title: '入力',
    message: '',
    label: '',
    defaultValue: '',
    confirmText: 'OK',
    cancelText: 'キャンセル',
  },
)

const isOpen = ref(false)
let resolvePromise: ((value: string | null) => void) | null = null
const state = ref({
  title: '',
  message: '',
  label: '',
  confirmText: '',
  cancelText: '',
})
const inputValue = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

const open = (options?: PromptOptions) => {
  state.value = {
    title: options?.title ?? props.title,
    message: options?.message ?? props.message,
    label: options?.label ?? props.label,
    confirmText: options?.confirmText ?? props.confirmText,
    cancelText: options?.cancelText ?? props.cancelText,
  }
  inputValue.value = options?.defaultValue ?? props.defaultValue

  isOpen.value = true

  // 入力フィールドにフォーカス
  nextTick(() => {
    const input = document.querySelector('.prompt-dialog-input input') as HTMLInputElement | null
    if (input) {
      input.focus()
      input.select()
    }
  })

  return new Promise<string | null>((resolve) => {
    resolvePromise = resolve
  })
}

const close = () => {
  isOpen.value = false
  resolvePromise?.(null)
}

const confirm = () => {
  isOpen.value = false
  resolvePromise?.(inputValue.value)
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.isComposing) {
    confirm()
  }
}

defineExpose({ open })
</script>

<template>
  <v-dialog v-model="isOpen" max-width="500" @keydown.esc="close">
    <v-card>
      <v-card-title>{{ state.title }}</v-card-title>
      <v-card-text>
        <p v-if="state.message" class="mb-4">{{ state.message }}</p>
        <v-text-field
          v-model="inputValue"
          :label="state.label"
          variant="outlined"
          density="compact"
          hide-details
          autofocus
          class="prompt-dialog-input"
          @keydown="handleKeydown"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn color="grey" variant="text" @click="close">
          {{ state.cancelText }}
        </v-btn>
        <v-btn color="primary" variant="text" @click="confirm">
          {{ state.confirmText }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
