<script setup lang="ts">
import { useAuthorityHistoryDialog } from './composables/useAuthorityHistoryDialog'
import inputRules from '@/modules/inputRules'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const {
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
} = useAuthorityHistoryDialog(props, emit)

const getInitial = (email: string) => {
  return email.charAt(0).toUpperCase()
}
</script>

<template>
  <v-dialog :model-value="modelValue" @update:model-value="handleBeforeClose" max-width="640px" scrollable>
    <v-card v-draggable-dialog class="authority-history-dialog rounded-lg">
      <div class="pa-6 pb-2 d-flex align-start justify-space-between">
        <div>
          <div class="text-h6 font-weight-bold d-flex align-center">
            <v-icon color="primary" class="mr-2">mdi-history</v-icon>
            メールアドレス履歴
          </div>
          <div class="text-caption text-medium-emphasis mt-1">
            権限設定やメンバー選択で使用するメールアドレスの補完候補を管理します。
          </div>
        </div>
        <v-btn icon="mdi-close" variant="text" size="small" @click="close" />
      </div>

      <v-tabs v-model="activeTab" density="compact" color="primary" class="px-6 border-b">
        <v-tab value="list" prepend-icon="mdi-format-list-bulleted" class="text-body-2 font-weight-medium">
          リスト管理
          <v-chip size="x-small" color="primary" variant="tonal" class="ml-2 font-weight-bold">
            {{ emailList.length }}
          </v-chip>
        </v-tab>
        <v-tab value="text" prepend-icon="mdi-text-box-edit-outline" class="text-body-2 font-weight-medium">
          一括テキスト編集
        </v-tab>
      </v-tabs>

      <v-card-text class="pa-6" style="min-height: 400px; max-height: 520px; overflow-y: auto">
        <!-- リスト管理タブ -->
        <template v-if="activeTab === 'list'">
          <!-- 新規追加入力エリア -->
          <div class="mb-4">
            <div class="text-caption font-weight-bold text-medium-emphasis mb-1">
              メールアドレスの追加
            </div>
            <div class="d-flex align-start ga-2">
              <v-text-field
                v-model="inputEmail"
                placeholder="例: user@example.com（カンマや改行で複数追加可）"
                prepend-inner-icon="mdi-email-plus-outline"
                density="compact"
                variant="outlined"
                hide-details="auto"
                :error-messages="inputError"
                @keydown.enter.prevent="addEmail"
                @input="inputError = ''"
                autocomplete="off"
                class="flex-grow-1"
              />
              <v-btn
                color="primary"
                variant="flat"
                :disabled="!inputEmail.trim()"
                @click="addEmail"
                prepend-icon="mdi-plus"
                height="40"
                class="px-4"
              >
                追加
              </v-btn>
            </div>
          </div>

          <!-- ツールバー（検索 & アクション） -->
          <div class="d-flex align-center justify-space-between ga-2 mb-2">
            <v-text-field
              v-model="searchQuery"
              placeholder="履歴内を検索..."
              density="compact"
              variant="outlined"
              prepend-inner-icon="mdi-magnify"
              hide-details
              clearable
              style="max-width: 240px"
            />
            <div class="d-flex align-center ga-1">
              <v-tooltip text="全メールアドレスをコピー" location="top">
                <template #activator="{ props: tooltipProps }">
                  <v-btn
                    v-bind="tooltipProps"
                    variant="text"
                    size="small"
                    prepend-icon="mdi-content-copy"
                    :disabled="emailList.length === 0"
                    @click="copyAllEmails"
                  >
                    一括コピー
                  </v-btn>
                </template>
              </v-tooltip>

              <v-tooltip text="すべての履歴を消去" location="top">
                <template #activator="{ props: tooltipProps }">
                  <v-btn
                    v-bind="tooltipProps"
                    variant="text"
                    size="small"
                    color="error"
                    prepend-icon="mdi-trash-can-outline"
                    :disabled="emailList.length === 0"
                    @click="clearAll"
                  >
                    全削除
                  </v-btn>
                </template>
              </v-tooltip>
            </div>
          </div>

          <!-- メールアドレス一覧 -->
          <v-sheet border rounded class="email-list-sheet">
            <template v-if="filteredEmails.length > 0">
              <v-list density="compact" class="pa-0">
                <template v-for="(email, index) in filteredEmails" :key="email">
                  <v-list-item class="email-list-item py-2 px-3">
                    <template #prepend>
                      <v-avatar size="32" color="primary" variant="tonal" class="font-weight-bold text-caption mr-3">
                        {{ getInitial(email) }}
                      </v-avatar>
                    </template>

                    <v-list-item-title class="text-body-2 font-mono" :title="email">
                      {{ email }}
                    </v-list-item-title>

                    <template #append>
                      <div class="d-flex align-center ga-1">
                        <v-tooltip :text="copiedEmail === email ? 'コピーしました！' : 'クリップボードにコピー'" location="top">
                          <template #activator="{ props: copyProps }">
                            <v-btn
                              v-bind="copyProps"
                              :icon="copiedEmail === email ? 'mdi-check' : 'mdi-content-copy'"
                              size="x-small"
                              variant="text"
                              :color="copiedEmail === email ? 'success' : 'grey-darken-1'"
                              @click="copyEmail(email)"
                            />
                          </template>
                        </v-tooltip>

                        <v-tooltip text="削除" location="top">
                          <template #activator="{ props: deleteProps }">
                            <v-btn
                              v-bind="deleteProps"
                              icon="mdi-close"
                              size="x-small"
                              variant="text"
                              color="grey-darken-1"
                              class="delete-btn"
                              @click="removeEmail(email)"
                            />
                          </template>
                        </v-tooltip>
                      </div>
                    </template>
                  </v-list-item>
                  <v-divider v-if="index < filteredEmails.length - 1" />
                </template>
              </v-list>
            </template>


            <!-- 空状態 -->
            <template v-else>
              <div v-if="emailList.length === 0" class="d-flex flex-column align-center justify-center py-10 text-medium-emphasis">
                <v-icon size="48" color="grey-lighten-1" class="mb-2">mdi-email-outline</v-icon>
                <div class="text-subtitle-2 font-weight-bold">メールアドレス履歴がありません</div>
                <div class="text-caption text-disabled mt-1 text-center">
                  上のフォームから追加するか、権限設定で入力すると自動的に保存されます
                </div>
              </div>
              <div v-else class="d-flex flex-column align-center justify-center py-10 text-medium-emphasis">
                <v-icon size="48" color="grey-lighten-1" class="mb-2">mdi-email-search-outline</v-icon>
                <div class="text-subtitle-2 font-weight-bold">「{{ searchQuery }}」に一致する履歴はありません</div>
                <v-btn size="small" variant="text" color="primary" class="mt-2" @click="searchQuery = ''">
                  検索条件をクリア
                </v-btn>
              </div>
            </template>
          </v-sheet>

          <!-- リスト下部ステータス -->
          <div class="text-caption text-medium-emphasis mt-2 d-flex justify-space-between align-center">
            <span>
              {{ searchQuery ? `${filteredEmails.length} / ` : '' }}{{ emailList.length }} 件のメールアドレス
            </span>
            <span class="text-disabled">
              ※ 保存ボタンを押すと変更が確定されます
            </span>
          </div>
        </template>

        <!-- 一括テキスト編集タブ -->
        <template v-else>
          <div class="mb-3 text-caption text-medium-emphasis">
            1行に1つのメールアドレスを入力してください。<br />
            リスト管理タブとリアルタイムに同期されます。
          </div>
          <v-textarea
            v-model="localText"
            label="メールアドレス一覧"
            placeholder="example@example.com"
            auto-grow
            variant="outlined"
            density="compact"
            hide-details="auto"
            :rows="10"
            autocomplete="off"
            :rules="[inputRules.areMailAddressLines]"
            class="font-mono text-body-2"
          />
          <div class="d-flex justify-space-between align-center mt-2">
            <div class="text-caption text-medium-emphasis">
              {{ emailCount }} 件のメールアドレス
            </div>
            <v-btn
              size="small"
              variant="text"
              prepend-icon="mdi-broom"
              @click="syncTextToList(); localText = emailList.join('\n')"
            >
              重複・空行を整理
            </v-btn>
          </div>
        </template>
      </v-card-text>

      <v-divider />

      <v-card-actions class="pa-4 px-6">
        <div v-if="hasChanges" class="d-flex align-center text-caption text-warning font-weight-medium">
          <v-icon size="small" class="mr-1">mdi-alert-circle-outline</v-icon>
          未保存の変更があります
        </div>
        <v-spacer />
        <v-btn color="grey-darken-1" variant="text" @click="close"> キャンセル </v-btn>
        <v-btn color="primary" variant="flat" :disabled="!hasChanges" @click="save" class="ml-2 px-5"> 保存 </v-btn>
      </v-card-actions>
    </v-card>

    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      :timeout="2200"
      location="bottom right"
      density="compact"
    >
      {{ snackbar.text }}
    </v-snackbar>
  </v-dialog>
</template>

<style scoped>
.authority-history-dialog {
  overflow: hidden;
}

.email-list-sheet {
  max-height: 280px;
  overflow-y: auto;
}

.email-list-item {
  transition: background-color 0.15s ease;
}

.email-list-item:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.04);
}

.delete-btn:hover {
  color: rgb(var(--v-theme-error)) !important;
}

.font-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
</style>
