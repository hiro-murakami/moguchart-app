<script setup lang="ts">
import { ref, reactive } from 'vue'

export interface SnackbarOptions {
  message?: string
  color?: string
  timeout?: number
}

const isOpen = ref(false)
const state = reactive<SnackbarOptions>({
  message: '',
  color: 'info',
  timeout: 3000,
})

const open = (options?: SnackbarOptions) => {
  state.message = options?.message ?? '通知'
  state.color = options?.color ?? 'info'
  state.timeout = options?.timeout ?? 3000
  isOpen.value = true
}

defineExpose({ open })
</script>

<template>
  <v-snackbar v-model="isOpen" :color="state.color" :timeout="state.timeout">
    {{ state.message }}
    <template #actions>
      <v-btn variant="text" @click="isOpen = false">閉じる</v-btn>
    </template>
  </v-snackbar>
</template>
