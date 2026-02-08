<script setup lang="ts">
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

watch(
  () => props.modelValue,
  (val) => {
    if (val && user.value) {
      localDisplayName.value = user.value.displayName || ''
      localTheme.value = user.value.attribute.theme || 'system'
    }
  },
)

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

const close = () => {
  emit('update:modelValue', false)
}
</script>

<template>
  <v-dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" max-width="500px">
    <v-card v-if="user">
      <v-card-title>ユーザー設定</v-card-title>
      <v-card-text>
        <v-form>
          <v-row dense>
            <v-col cols="12">
              <v-text-field label="メールアドレス" :model-value="user.email" readonly variant="filled" />
            </v-col>
            <v-col cols="12">
              <v-text-field
                label="最終ログイン"
                :model-value="toDateString(user.attribute.lastLoginAt, 'YYYY/MM/DD HH:mm:ss')"
                readonly
                variant="filled"
              />
            </v-col>
            <v-col cols="12">
              <v-text-field v-model="localDisplayName" label="表示名" autofocus autocomplete="off" />
            </v-col>
            <v-col cols="12">
              <v-radio-group v-model="localTheme" inline label="テーマ" hide-details>
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
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="blue-darken-1" variant="text" @click="close"> キャンセル </v-btn>
        <v-btn color="blue-darken-1" variant="text" @click="save"> 保存 </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
