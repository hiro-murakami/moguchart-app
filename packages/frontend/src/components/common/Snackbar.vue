<script setup lang="ts">
import { ref, reactive } from 'vue'

export interface SnackbarOptions {
  message?: string
  color?: string
  timeout?: number
  /** アクションボタンのテキスト（例: "元に戻す"） */
  actionText?: string
  /** アクションボタン押下時のコールバック */
  onAction?: () => void
}

const isOpen = ref(false)
const state = reactive<SnackbarOptions>({
  message: '',
  color: 'info',
  timeout: 3000,
  actionText: undefined,
  onAction: undefined,
})

const open = (options?: SnackbarOptions) => {
  state.message = options?.message ?? '通知'
  state.color = options?.color ?? 'info'
  state.timeout = options?.timeout ?? 3000
  state.actionText = options?.actionText
  state.onAction = options?.onAction
  isOpen.value = true
}

const handleAction = () => {
  if (state.onAction) {
    state.onAction()
  }
  isOpen.value = false
}

defineExpose({ open })
</script>

<template>
  <v-snackbar v-model="isOpen" :color="state.color" :timeout="state.timeout">
    {{ state.message }}
    <template #actions>
      <v-btn v-if="state.actionText" variant="text" @click="handleAction">{{ state.actionText }}</v-btn>
      <v-btn variant="text" @click="isOpen = false">閉じる</v-btn>
    </template>
  </v-snackbar>
</template>

