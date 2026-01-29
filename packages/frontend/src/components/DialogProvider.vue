<script setup lang="ts">
import { provide, ref } from 'vue'
import ConfirmDialog from './ConfirmDialog.vue'
import AlertDialog from './AlertDialog.vue'
import { confirmKey } from '@/modules/useConfirm'
import { alertKey } from '@/modules/useAlert'

// Confirm Dialog
const confirmDialog = ref<InstanceType<typeof ConfirmDialog> | null>(null)
const confirm = (options?: import('@/components/ConfirmDialog.vue').ConfirmOptions) => {
  if (!confirmDialog.value) {
    return Promise.reject(new Error('ConfirmDialog is not ready.'))
  }
  return confirmDialog.value.open(options)
}
provide(confirmKey, confirm)

// Alert Dialog
const alertDialog = ref<InstanceType<typeof AlertDialog> | null>(null)
const alert = (options?: import('@/components/AlertDialog.vue').AlertOptions) => {
  if (!alertDialog.value) {
    return Promise.reject(new Error('AlertDialog is not ready.'))
  }
  return alertDialog.value.open(options)
}
provide(alertKey, alert)
</script>

<template>
  <slot></slot>
  <ConfirmDialog ref="confirmDialog" />
  <AlertDialog ref="alertDialog" />
</template>
