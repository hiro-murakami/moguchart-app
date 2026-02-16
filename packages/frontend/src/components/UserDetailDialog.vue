<script setup lang="ts">
import { useDiscardConfirm } from '@/modules/useConfirm'
import { toDateString } from '@/modules/utils'
import { useUserStore } from '@/stores/useUserStore'
import type { User } from '@functions/types/shared'
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const userStore = useUserStore()
const user = computed(() => userStore.user)

const localDisplayName = ref('')
const localTheme = ref<'light' | 'dark' | 'system'>('system')

const themeOptions = [
  { title: 'ライト', value: 'light' },
  { title: 'ダーク', value: 'dark' },
  { title: 'システム', value: 'system' },
]

const { confirmAndClose } = useDiscardConfirm()

watch(
  () => props.modelValue,
  (val) => {
    if (val && user.value) {
      localDisplayName.value = user.value.displayName || ''
      localTheme.value = user.value.attribute.theme || 'system'
    }
  },
)

const hasChanges = computed(() => {
  if (!user.value) return false
  return (
    localDisplayName.value !== (user.value.displayName || '') ||
    localTheme.value !== (user.value.attribute.theme || 'system')
  )
})

const save = async () => {
  if (!user.value) return
  const updatedUser: User = {
    ...user.value,
    displayName: localDisplayName.value,
    attribute: {
      ...user.value.attribute,
      theme: localTheme.value,
    },
  }
  await userStore.saveUser(updatedUser)
  emit('update:modelValue', false)
}

const closeDialog = () => emit('update:modelValue', false)

const close = () => confirmAndClose(hasChanges, closeDialog)

const handleBeforeClose = (value: boolean) => {
  if (!value) {
    close()
  }
}
</script>

<template>
  <v-dialog :model-value="modelValue" @update:model-value="handleBeforeClose" max-width="500px">
    <v-card v-if="user">
      <v-card-title class="pa-8 pb-0">ユーザー設定</v-card-title>
      <v-card-text class="pa-8">
        <v-form>
          <v-row>
            <v-col cols="12">
              <v-text-field
                label="メールアドレス"
                :model-value="user.email"
                readonly
                variant="filled"
                density="default"
                hide-details
                class="mb-3"
              />
            </v-col>
            <v-col cols="12">
              <v-text-field
                label="最終ログイン"
                :model-value="toDateString(user.attribute.lastLoginAt, 'YYYY/MM/DD HH:mm:ss')"
                readonly
                variant="filled"
                density="default"
                hide-details
                class="mb-3"
              />
            </v-col>
            <v-col cols="12">
              <v-text-field
                v-model="localDisplayName"
                label="表示名"
                autofocus
                autocomplete="off"
                variant="outlined"
                density="compact"
                hide-details
                class="mb-3"
              />
            </v-col>
            <v-col cols="12">
              <v-radio-group v-model="localTheme" inline label="テーマ" hide-details class="mb-3">
                <v-radio
                  v-for="option in themeOptions"
                  :key="option.value"
                  :label="option.title"
                  :value="option.value"
                ></v-radio>
              </v-radio-group>
            </v-col>
          </v-row>
        </v-form>
      </v-card-text>
      <v-card-actions class="pa-8 pt-0">
        <v-spacer></v-spacer>
        <v-btn color="grey-darken-1" variant="text" @click="close"> キャンセル </v-btn>
        <v-btn color="primary" variant="flat" @click="save" class="ml-2"> 保存 </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
