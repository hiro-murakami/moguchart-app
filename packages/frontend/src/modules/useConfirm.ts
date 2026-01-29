import { inject, type InjectionKey } from 'vue'
import type { ConfirmOptions } from '@/components/ConfirmDialog.vue'

type ConfirmFunction = (options?: ConfirmOptions) => Promise<boolean>

export const confirmKey: InjectionKey<ConfirmFunction> = Symbol('confirm')

export const useConfirm = () => {
  const confirm = inject(confirmKey)
  if (!confirm) {
    throw new Error('confirm() is not provided.')
  }
  return confirm
}
