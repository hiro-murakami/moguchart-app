import { useUserStore } from '@/stores/useUserStore'
import { useDiscardConfirm } from '@/composables/useConfirm'
import { computed, ref, watch } from 'vue'
import { isEqual } from 'lodash'

export function useAuthorityHistoryDialog(
  props: { modelValue: boolean },
  emit: (e: 'update:modelValue', value: boolean) => void,
) {
  const userStore = useUserStore()
  const { confirmAndClose } = useDiscardConfirm()

  /** テキストエリアの内容（改行区切り） */
  const localText = ref('')

  /** ダイアログが開かれたときの初期値 */
  const initialText = ref('')

  /** 現在の履歴を改行区切りテキストとして取得 */
  const currentHistoryText = computed(() => {
    const history = userStore.currentUser?.attribute?.authorityInputHistory ?? []
    return history.join('\n')
  })

  watch(
    () => props.modelValue,
    (isVisible) => {
      if (isVisible) {
        localText.value = currentHistoryText.value
        initialText.value = currentHistoryText.value
      }
    },
  )

  const hasChanges = computed(() => localText.value !== initialText.value)

  /** テキストからメールアドレスの配列に変換（空行・重複を除去） */
  function parseEmails(text: string): string[] {
    return Array.from(
      new Set(
        text
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0),
      ),
    )
  }

  /** 入力中のメールアドレス件数 */
  const emailCount = computed(() => parseEmails(localText.value).length)

  const closeDialog = () => emit('update:modelValue', false)

  const close = () => confirmAndClose(hasChanges, closeDialog)

  const handleBeforeClose = (value: boolean) => {
    if (!value) {
      close()
    }
  }

  const save = async () => {
    if (!userStore.currentUser) return

    const emails = parseEmails(localText.value)
    const updatedUser = {
      ...userStore.currentUser,
      attribute: {
        ...userStore.currentUser.attribute,
        authorityInputHistory: emails,
      },
    }
    await userStore.saveUser(updatedUser)
    closeDialog()
  }

  return {
    localText,
    emailCount,
    hasChanges,
    close,
    handleBeforeClose,
    save,
  }
}
