import { inject, type InjectionKey, type Ref } from 'vue'
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

/**
 * 破棄確認ダイアログを表示してダイアログを閉じるユーティリティ
 */
export const useDiscardConfirm = () => {
  const confirm = useConfirm()

  /**
   * 変更がある場合に確認ダイアログを表示し、確認後にダイアログを閉じる
   * @param hasChanges 変更があるかどうか (Ref or 値)
   * @param closeDialog ダイアログを閉じる関数
   * @returns 閉じた場合true、キャンセルした場合false
   */
  const confirmAndClose = async (hasChanges: Ref<boolean> | boolean, closeDialog: () => void): Promise<boolean> => {
    const hasChangesValue = typeof hasChanges === 'boolean' ? hasChanges : hasChanges.value
    if (hasChangesValue) {
      const result = await confirm({
        title: '確認',
        message: '入力内容が変更されています。破棄してダイアログを閉じますか？',
        confirmText: '破棄して閉じる',
        confirmColor: 'warning',
      })
      if (!result) {
        return false
      }
    }
    closeDialog()
    return true
  }

  /**
   * ダイアログのupdate:modelValueイベント用ハンドラを生成
   */
  const createBeforeCloseHandler = (hasChanges: Ref<boolean> | (() => boolean), closeDialog: () => void) => {
    return (value: boolean) => {
      if (!value) {
        const hasChangesValue = typeof hasChanges === 'function' ? hasChanges() : hasChanges.value
        confirmAndClose(hasChangesValue, closeDialog)
      }
    }
  }

  return {
    confirmAndClose,
    createBeforeCloseHandler,
  }
}
