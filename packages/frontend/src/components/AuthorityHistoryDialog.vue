<script setup lang="ts">
import { useAuthorityHistoryDialog } from './composables/useAuthorityHistoryDialog'
import inputRules from '@/modules/inputRules'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const { localText, emailCount, hasChanges, close, handleBeforeClose, save } = useAuthorityHistoryDialog(
  props,
  emit,
)
</script>

<template>
  <v-dialog :model-value="modelValue" @update:model-value="handleBeforeClose" max-width="600px">
    <v-card v-draggable-dialog>
      <v-card-title class="pa-8 pb-0">メールアドレス履歴</v-card-title>
      <v-card-subtitle class="px-8 pt-2 pb-0" style="white-space: normal">
        権限設定で使用するメールアドレスの補完候補を管理します。<br />
        1行に1つのメールアドレスを入力してください。
      </v-card-subtitle>
      <v-card-text class="pa-8">
        <v-textarea
          v-model="localText"
          label="メールアドレス一覧"
          placeholder="example@example.com"
          auto-grow
          variant="outlined"
          density="compact"
          hide-details="auto"
          :rows="8"
          autocomplete="off"
          :rules="[inputRules.areMailAddressLines]"
        />
        <div class="text-caption text-medium-emphasis mt-2">
          {{ emailCount }} 件のメールアドレス
        </div>
      </v-card-text>
      <v-card-actions class="pa-8 pt-0">
        <v-spacer></v-spacer>
        <v-btn color="grey-darken-1" variant="text" @click="close"> キャンセル </v-btn>
        <v-btn color="primary" variant="flat" @click="save" class="ml-2"> 保存 </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
