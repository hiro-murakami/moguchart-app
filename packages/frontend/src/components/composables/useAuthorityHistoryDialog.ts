import { useUserStore } from '@/stores/useUserStore'
import { useDiscardConfirm, useConfirm } from '@/composables/useConfirm'
import { computed, ref, watch } from 'vue'
import { isEqual } from 'lodash'
import { isEmailFormat } from '@/modules/utils'

export function useAuthorityHistoryDialog(
  props: { modelValue: boolean },
  emit: (e: 'update:modelValue', value: boolean) => void,
) {
  const userStore = useUserStore()
  const { confirmAndClose } = useDiscardConfirm()
  const confirm = useConfirm()

  /** 現在のアクティブタブ: 'list' | 'text' */
  const activeTab = ref<'list' | 'text'>('list')

  /** メールアドレスリスト（内部状態） */
  const emailList = ref<string[]>([])

  /** テキストエリアの内容（改行区切り） */
  const localText = ref('')

  /** ダイアログが開かれたときの初期メールアドレスリスト（変更検知用） */
  const initialEmails = ref<string[]>([])

  /** 新規追加用の入力文字列 */
  const inputEmail = ref('')

  /** 入力バリデーションエラーメッセージ */
  const inputError = ref('')

  /** 検索クエリ */
  const searchQuery = ref('')

  /** 最近コピーしたメールアドレス（一時的なアイコンフィードバック用） */
  const copiedEmail = ref<string | null>(null)

  /** コピー成功などのスナックバー／フィードバック表示用 */
  const snackbar = ref({
    show: false,
    text: '',
    color: 'success',
  })

  /** 現在保存されている履歴（メールアドレスのみ）を取得 */
  const getStoredHistory = (): string[] => {
    const history = userStore.currentUser?.attribute?.authorityInputHistory ?? []
    return history.filter((val): val is string => typeof val === 'string' && val.includes('@'))
  }

  /** テキストからメールアドレスの配列に変換（空行・重複・非メールアドレスを除去） */
  function parseEmails(text: string): string[] {
    return Array.from(
      new Set(
        text
          .split(/[\n,;]+/)
          .map((line) => line.trim())
          .filter((line) => line.length > 0 && line.includes('@')),
      ),
    )
  }

  /** テキストエリアの内容をリストへ同期する */
  const syncTextToList = () => {
    emailList.value = parseEmails(localText.value)
  }

  // ダイアログが開かれたときに初期化
  watch(
    () => props.modelValue,
    (isVisible) => {
      if (isVisible) {
        const stored = getStoredHistory()
        emailList.value = [...stored]
        initialEmails.value = [...stored]
        localText.value = stored.join('\n')
        inputEmail.value = ''
        inputError.value = ''
        searchQuery.value = ''
        activeTab.value = 'list'
      }
    },
  )

  /** タブ切り替え時の同期 */
  watch(activeTab, (newTab) => {
    if (newTab === 'text') {
      localText.value = emailList.value.join('\n')
    } else {
      syncTextToList()
    }
  })

  /** 変更があるかどうか */
  const hasChanges = computed(() => {
    const currentList = activeTab.value === 'text' ? parseEmails(localText.value) : emailList.value
    return !isEqual(currentList, initialEmails.value)
  })

  /** 検索クエリで絞り込んだメールアドレスリスト */
  const filteredEmails = computed(() => {
    const q = searchQuery.value.trim().toLowerCase()
    if (!q) return emailList.value
    return emailList.value.filter((email) => email.toLowerCase().includes(q))
  })

  /** 登録件数 */
  const emailCount = computed(() => {
    return activeTab.value === 'text' ? parseEmails(localText.value).length : emailList.value.length
  })

  const showToast = (text: string, color: string = 'success') => {
    snackbar.value = {
      show: true,
      text,
      color,
    }
  }

  /** メールアドレスの追加（カンマ・セミコロン・改行区切りの一括入力にも対応） */
  const addEmail = () => {
    const raw = inputEmail.value.trim()
    if (!raw) return

    // カンマ、セミコロン、改行、空白で分割
    const tokens = raw
      .split(/[\s,;]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0)

    if (tokens.length === 0) return

    const invalidEmails: string[] = []
    const duplicateEmails: string[] = []
    const addedEmails: string[] = []

    for (const token of tokens) {
      if (!isEmailFormat(token)) {
        invalidEmails.push(token)
        continue
      }
      if (emailList.value.includes(token) || addedEmails.includes(token)) {
        duplicateEmails.push(token)
        continue
      }
      addedEmails.push(token)
    }

    if (invalidEmails.length > 0) {
      inputError.value = `${invalidEmails.join(', ')} は有効なメールアドレス形式ではありません`
      return
    }

    if (addedEmails.length === 0 && duplicateEmails.length > 0) {
      inputError.value = 'すでに入力履歴に登録されています'
      return
    }

    // 新規メールアドレスを先頭に追加（直近追加したものが分かりやすいように）
    emailList.value = [...addedEmails, ...emailList.value]
    localText.value = emailList.value.join('\n')
    inputEmail.value = ''
    inputError.value = ''

    if (duplicateEmails.length > 0) {
      showToast(`${addedEmails.length}件を追加しました（${duplicateEmails.length}件は登録済みのため除外）`, 'info')
    } else if (addedEmails.length > 1) {
      showToast(`${addedEmails.length}件のメールアドレスを追加しました`, 'success')
    }
  }

  /** 個別削除 */
  const removeEmail = (email: string) => {
    emailList.value = emailList.value.filter((e) => e !== email)
    localText.value = emailList.value.join('\n')
  }

  /** 全削除の確認と実行 */
  const clearAll = async () => {
    if (emailList.value.length === 0) return
    const result = await confirm({
      title: 'メールアドレス履歴の全削除',
      message: '登録されているすべてのメールアドレス履歴を削除しますか？\n（「保存」ボタンを押すまではデータベースに反映されません）',
      confirmText: 'すべて削除',
      confirmColor: 'error',
    })
    if (result) {
      emailList.value = []
      localText.value = ''
      showToast('すべての履歴をクリアしました', 'info')
    }
  }

  /** 1件コピー */
  let copyTimeoutId: any = null
  const copyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email)
      copiedEmail.value = email
      if (copyTimeoutId) clearTimeout(copyTimeoutId)
      copyTimeoutId = setTimeout(() => {
        if (copiedEmail.value === email) {
          copiedEmail.value = null
        }
      }, 1500)
      showToast(`「${email}」をコピーしました`, 'success')
    } catch (e) {
      console.error('Failed to copy email:', e)
    }
  }

  /** 全件コピー */
  const copyAllEmails = async () => {
    if (emailList.value.length === 0) return
    try {
      await navigator.clipboard.writeText(emailList.value.join('\n'))
      showToast(`${emailList.value.length}件のメールアドレスをコピーしました`, 'success')
    } catch (e) {
      console.error('Failed to copy emails:', e)
    }
  }

  const closeDialog = () => emit('update:modelValue', false)

  const close = () => confirmAndClose(hasChanges, closeDialog)

  const handleBeforeClose = (value: boolean) => {
    if (!value) {
      close()
    }
  }

  const save = async () => {
    if (!userStore.currentUser) return

    if (activeTab.value === 'text') {
      syncTextToList()
    }

    const emails = emailList.value
    const updatedUser = {
      ...userStore.currentUser,
      attribute: {
        ...userStore.currentUser.attribute,
        authorityInputHistory: emails,
      },
    }
    await userStore.saveUser(updatedUser)
    initialEmails.value = [...emails]
    closeDialog()
  }

  return {
    activeTab,
    emailList,
    filteredEmails,
    localText,
    inputEmail,
    inputError,
    searchQuery,
    copiedEmail,
    emailCount,
    hasChanges,
    snackbar,
    addEmail,
    removeEmail,
    clearAll,
    copyEmail,
    copyAllEmails,
    syncTextToList,
    close,
    handleBeforeClose,
    save,
  }
}


