<script setup lang="ts">
import { provide, ref } from 'vue'
import ConfirmDialog from './ConfirmDialog.vue'
import AlertDialog from './AlertDialog.vue'
import PromptDialog from './PromptDialog.vue'
import Snackbar from './Snackbar.vue'
import { confirmKey } from '@/composables/useConfirm'
import { alertKey } from '@/composables/useAlert'
import { promptKey } from '@/composables/usePrompt'
import { snackbarKey } from '@/composables/useSnackbar'

// Confirm Dialog
const confirmDialog = ref<InstanceType<typeof ConfirmDialog> | null>(null)
const confirm = (options?: import('@/components/common/ConfirmDialog.vue').ConfirmOptions) => {
  if (!confirmDialog.value) {
    return Promise.reject(new Error('ConfirmDialog is not ready.'))
  }
  return confirmDialog.value.open(options)
}
provide(confirmKey, confirm)

// Alert Dialog
const alertDialog = ref<InstanceType<typeof AlertDialog> | null>(null)
const alert = (options?: import('@/components/common/AlertDialog.vue').AlertOptions) => {
  if (!alertDialog.value) {
    return Promise.reject(new Error('AlertDialog is not ready.'))
  }
  return alertDialog.value.open(options)
}
provide(alertKey, alert)

// Prompt Dialog
const promptDialog = ref<InstanceType<typeof PromptDialog> | null>(null)
const prompt = (options?: import('@/components/common/PromptDialog.vue').PromptOptions) => {
  if (!promptDialog.value) {
    return Promise.reject(new Error('PromptDialog is not ready.'))
  }
  return promptDialog.value.open(options)
}
provide(promptKey, prompt)

// Snackbar
const snackbar = ref<InstanceType<typeof Snackbar> | null>(null)
const showSnackbar = (options?: import('@/components/common/Snackbar.vue').SnackbarOptions) => {
  if (!snackbar.value) {
    throw new Error('Snackbar is not ready.')
  }
  snackbar.value.open(options)
}
provide(snackbarKey, showSnackbar)
</script>

<template>
  <slot></slot>
  <ConfirmDialog ref="confirmDialog" />
  <AlertDialog ref="alertDialog" />
  <PromptDialog ref="promptDialog" />
  <Snackbar ref="snackbar" />
</template>

