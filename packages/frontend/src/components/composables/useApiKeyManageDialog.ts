import { ref, onMounted } from 'vue'
import {
  fetchApiKeys,
  createApiKey,
  revokeApiKey,
  type ApiKeyItem,
  type ApiKeyCreated,
} from '@/modules/apiKeyApi'

export function useApiKeyManageDialog(
  props: { modelValue: boolean },
  emit: (e: 'update:modelValue', value: boolean) => void,
) {
  /** APIキー一覧 */
  const apiKeys = ref<ApiKeyItem[]>([])
  /** ローディング中フラグ */
  const loading = ref(false)
  /** エラーメッセージ */
  const errorMessage = ref('')
  /** 新規作成フォームの表示フラグ */
  const showCreateForm = ref(false)
  /** 新規作成フォーム: キー名 */
  const newKeyName = ref('')
  /** 新規作成フォーム: スコープ */
  const newKeyScope = ref<'read' | 'read-write'>('read-write')
  /** 作成直後のフルキー（1回のみ表示） */
  const createdKey = ref<ApiKeyCreated | null>(null)
  /** 作成中フラグ */
  const creating = ref(false)
  /** コピー完了フラグ */
  const copied = ref(false)
  /** 無効化確認ダイアログ */
  const confirmRevokeId = ref<string | null>(null)

  /** 一覧を読み込む */
  const loadKeys = async () => {
    loading.value = true
    errorMessage.value = ''
    try {
      apiKeys.value = await fetchApiKeys()
    } catch (e: any) {
      errorMessage.value = e.message || 'APIキーの取得に失敗しました'
    } finally {
      loading.value = false
    }
  }

  /** 新規キーを作成する */
  const handleCreate = async () => {
    if (!newKeyName.value.trim()) return
    creating.value = true
    errorMessage.value = ''
    try {
      createdKey.value = await createApiKey(newKeyName.value.trim(), newKeyScope.value)
      showCreateForm.value = false
      newKeyName.value = ''
      newKeyScope.value = 'read-write'
      await loadKeys()
    } catch (e: any) {
      errorMessage.value = e.message || 'APIキーの作成に失敗しました'
    } finally {
      creating.value = false
    }
  }

  /** キーをクリップボードにコピーする */
  const copyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key)
      copied.value = true
      setTimeout(() => {
        copied.value = false
      }, 2000)
    } catch {
      // フォールバック
      const textarea = document.createElement('textarea')
      textarea.value = key
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      copied.value = true
      setTimeout(() => {
        copied.value = false
      }, 2000)
    }
  }

  /** キーを無効化する */
  const handleRevoke = async (id: string) => {
    errorMessage.value = ''
    try {
      await revokeApiKey(id)
      confirmRevokeId.value = null
      await loadKeys()
    } catch (e: any) {
      errorMessage.value = e.message || 'APIキーの無効化に失敗しました'
    }
  }

  /** 作成結果表示を閉じる */
  const dismissCreatedKey = () => {
    createdKey.value = null
  }

  /** ダイアログを閉じる */
  const close = () => {
    showCreateForm.value = false
    createdKey.value = null
    errorMessage.value = ''
    emit('update:modelValue', false)
  }

  return {
    apiKeys,
    loading,
    errorMessage,
    showCreateForm,
    newKeyName,
    newKeyScope,
    createdKey,
    creating,
    copied,
    confirmRevokeId,
    loadKeys,
    handleCreate,
    copyKey,
    handleRevoke,
    dismissCreatedKey,
    close,
  }
}
