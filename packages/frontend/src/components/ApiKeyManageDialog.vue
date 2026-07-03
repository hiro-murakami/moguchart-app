<script setup lang="ts">
import { watch } from 'vue'
import { useApiKeyManageDialog } from './composables/useApiKeyManageDialog'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const {
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
} = useApiKeyManageDialog(props, emit)

// ダイアログが開かれたときに一覧を読み込む
watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      loadKeys()
    }
  },
)

/** 日時フォーマット */
const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** スコープの表示ラベル */
const scopeLabel = (scope: string): string => {
  return scope === 'read' ? '読み取り専用' : '読み書き'
}

/** スコープの色 */
const scopeColor = (scope: string): string => {
  return scope === 'read' ? 'info' : 'success'
}
</script>

<template>
  <v-dialog :model-value="modelValue" @update:model-value="close" max-width="850px" scrollable>
    <v-card v-draggable-dialog>
      <v-card-title class="d-flex align-center pa-6 pb-2">
        <v-icon icon="mdi-key-variant" class="mr-2" />
        APIキー管理
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" density="compact" @click="close" />
      </v-card-title>

      <v-card-text class="pa-6 pt-2">
        <!-- エラーメッセージ -->
        <v-alert v-if="errorMessage" type="error" variant="tonal" closable class="mb-4" @click:close="errorMessage = ''">
          {{ errorMessage }}
        </v-alert>

        <!-- 作成完了通知 -->
        <v-alert
          v-if="createdKey"
          type="success"
          variant="tonal"
          closable
          class="mb-4"
          @click:close="dismissCreatedKey"
        >
          <div class="font-weight-bold mb-2">APIキーが作成されました</div>
          <div class="text-body-2 mb-2">このキーは今回のみ表示されます。安全な場所に保存してください。</div>
          <div class="d-flex align-center">
            <code class="pa-2 flex-grow-1" style="word-break: break-all; background: rgba(0,0,0,0.06); border-radius: 4px;">
              {{ createdKey.key }}
            </code>
            <v-btn
              :icon="copied ? 'mdi-check' : 'mdi-content-copy'"
              :color="copied ? 'success' : undefined"
              variant="text"
              size="small"
              class="ml-2"
              @click="copyKey(createdKey!.key)"
            />
          </div>
        </v-alert>

        <!-- 新規作成フォーム -->
        <v-expand-transition>
          <v-card v-if="showCreateForm" variant="outlined" class="mb-4 pa-4">
            <div class="text-subtitle-2 mb-3">新しいAPIキーを作成</div>
            <v-text-field
              v-model="newKeyName"
              label="キーの名前"
              placeholder="例: CI/CD連携用"
              variant="outlined"
              density="compact"
              hide-details="auto"
              autofocus
              class="mb-3"
            />
            <v-select
              v-model="newKeyScope"
              :items="[
                { title: '読み書き (read-write)', value: 'read-write' },
                { title: '読み取り専用 (read)', value: 'read' },
              ]"
              label="スコープ"
              variant="outlined"
              density="compact"
              hide-details="auto"
              class="mb-3"
            />
            <div class="d-flex justify-end">
              <v-btn
                variant="text"
                color="grey-darken-1"
                @click="showCreateForm = false"
                class="mr-2"
              >
                キャンセル
              </v-btn>
              <v-btn
                variant="flat"
                color="primary"
                :loading="creating"
                :disabled="!newKeyName.trim()"
                @click="handleCreate"
              >
                作成
              </v-btn>
            </div>
          </v-card>
        </v-expand-transition>

        <!-- 一覧 -->
        <div v-if="loading" class="d-flex justify-center py-8">
          <v-progress-circular indeterminate />
        </div>

        <template v-else>
          <div v-if="apiKeys.length === 0" class="text-center py-8 text-medium-emphasis">
            <v-icon icon="mdi-key-remove" size="48" class="mb-2" />
            <div>APIキーはまだ作成されていません</div>
          </div>

          <v-list v-else lines="two" class="pa-0">
            <template v-for="(item, index) in apiKeys" :key="item.id">
              <v-list-item class="px-0">
                <template #prepend>
                  <v-icon
                    :icon="item.active ? 'mdi-key' : 'mdi-key-remove'"
                    :color="item.active ? 'primary' : 'grey'"
                    class="mr-3"
                  />
                </template>

                <v-list-item-title class="d-flex align-center">
                  <span :class="{ 'text-decoration-line-through text-medium-emphasis': !item.active }">
                    {{ item.name }}
                  </span>
                  <v-chip
                    :color="item.active ? scopeColor(item.scope) : 'grey'"
                    size="x-small"
                    class="ml-2"
                  >
                    {{ scopeLabel(item.scope) }}
                  </v-chip>
                  <v-chip v-if="!item.active" color="error" size="x-small" class="ml-1">
                    無効
                  </v-chip>
                </v-list-item-title>

                <v-list-item-subtitle>
                  <code class="text-caption">{{ item.key }}</code>
                  <span class="mx-2">·</span>
                  <span class="text-caption">
                    作成: {{ formatDate(item.createdAt) }}
                  </span>
                  <template v-if="item.lastUsedAt">
                    <span class="mx-2">·</span>
                    <span class="text-caption">
                      最終使用: {{ formatDate(item.lastUsedAt) }}
                    </span>
                  </template>
                </v-list-item-subtitle>

                <template #append>
                  <v-btn
                    v-if="item.active"
                    icon="mdi-delete-outline"
                    variant="text"
                    color="error"
                    size="small"
                    @click="confirmRevokeId = item.id"
                  />
                </template>
              </v-list-item>
              <v-divider v-if="index < apiKeys.length - 1" />
            </template>
          </v-list>
        </template>
      </v-card-text>

      <v-card-actions class="pa-6 pt-2">
        <v-btn
          v-if="!showCreateForm"
          prepend-icon="mdi-plus"
          variant="flat"
          color="primary"
          @click="showCreateForm = true"
        >
          新しいキーを作成
        </v-btn>
        <v-spacer />
        <v-btn variant="text" color="grey-darken-1" @click="close">
          閉じる
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- 無効化確認ダイアログ -->
  <v-dialog :model-value="!!confirmRevokeId" @update:model-value="confirmRevokeId = null" max-width="400px">
    <v-card v-draggable-dialog>
      <v-card-title class="pa-6 pb-2">APIキーの無効化</v-card-title>
      <v-card-text class="pa-6 pt-2">
        このAPIキーを無効化しますか？この操作は元に戻せません。
        このキーを使用しているアプリケーションはアクセスできなくなります。
      </v-card-text>
      <v-card-actions class="pa-6 pt-0">
        <v-spacer />
        <v-btn variant="text" color="grey-darken-1" @click="confirmRevokeId = null">
          キャンセル
        </v-btn>
        <v-btn variant="flat" color="error" @click="handleRevoke(confirmRevokeId!)">
          無効化
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
