import { inject, type InjectionKey } from 'vue'
import type { AlertOptions } from '@/components/common/AlertDialog.vue'

type AlertFunction = (options?: AlertOptions) => Promise<void>

export const alertKey: InjectionKey<AlertFunction> = Symbol('alert')

export const useAlert = () => {
  const alert = inject(alertKey)
  if (!alert) {
    throw new Error('alert() is not provided.')
  }
  return alert
}
