<script setup lang="ts">
import { provide, ref } from 'vue'
import ConfirmDialog from './ConfirmDialog.vue'
import { confirmKey } from '@/modules/useConfirm'

const confirmDialog = ref<InstanceType<typeof ConfirmDialog> | null>(null)

const confirm = (options?: import('@/components/ConfirmDialog.vue').ConfirmOptions) => {
  if (!confirmDialog.value) {
    return Promise.reject(new Error('ConfirmDialog is not ready.'))
  }
  return confirmDialog.value.open(options)
}

provide(confirmKey, confirm)
</script>

<template>
  <slot></slot>
  <ConfirmDialog ref="confirmDialog" />
</template>
