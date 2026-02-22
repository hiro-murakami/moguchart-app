import { inject, type InjectionKey } from 'vue'
import type { SnackbarOptions } from '@/components/common/Snackbar.vue'

type SnackbarFunction = (options?: SnackbarOptions) => void

export const snackbarKey: InjectionKey<SnackbarFunction> = Symbol('snackbar')

export const useSnackbar = () => {
  const snackbar = inject(snackbarKey)
  if (!snackbar) {
    throw new Error('snackbar() is not provided.')
  }
  return snackbar
}
