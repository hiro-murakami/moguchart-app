<script setup lang="ts">
import { computed } from 'vue'
import inputRules from '@/modules/inputRules'
import { useUserStore } from '@/stores/useUserStore'
import type { User } from '@functions/types/shared'

const props = defineProps<{
  modelValue: string[]
  label: string
  helpText: string
  /** 入力補完の候補となるユーザー一覧（省略可） */
  users?: User[]
  /** 追加のバリデーションルール（省略可） */
  rules?: ((value: any) => string | boolean)[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void
}>()

const userStore = useUserStore()

/** v-combobox に渡す補完候補アイテム */
const suggestionItems = computed(() => {
  // props.users から候補を作成。メールアドレスまたはdisplayNameが存在するもののみを対象にし、UID単体だけの無関係なものは候補に出さない
  const items = (props.users ?? [])
    .filter((u) => u.email || u.displayName)
    .map((u) => {
      const email = u.email || (u.id?.includes('@') ? u.id : '')
      const title = u.displayName ? (email ? `${u.displayName} (${email})` : u.displayName) : email
      return {
        title,
        value: email || u.id,
      }
    })
    .filter((item) => item.value && item.title)

  // 自分自身がまだ候補に含まれていなければ先頭に追加
  const currentUser = userStore.currentUser
  if (currentUser?.email) {
    const hasSelf = items.some((item) => item.value === currentUser.email || item.value === currentUser.id)
    if (!hasSelf) {
      items.unshift({
        title: currentUser.displayName ? `${currentUser.displayName} (${currentUser.email})` : currentUser.email,
        value: currentUser.email,
      })
    }
  }

  return items
})

/** 内部ルール + 外部から渡されたルールをマージ */
const mergedRules = computed(() => [inputRules.areMailAddresses, ...(props.rules ?? [])])

/** チップに表示するテキストを名前解決する */
function getDisplayText(val: string): string {
  // 自分自身と一致する場合
  if (userStore.currentUser && (userStore.currentUser.id === val || userStore.currentUser.email === val)) {
    if (userStore.currentUser.displayName) {
      return userStore.currentUser.email
        ? `${userStore.currentUser.displayName} (${userStore.currentUser.email})`
        : userStore.currentUser.displayName
    }
    return userStore.currentUser.email || val
  }

  // props.users から検索
  const user = (props.users ?? []).find((u) => u.id === val || u.email === val)
  if (user) {
    if (user.displayName) {
      return user.email ? `${user.displayName} (${user.email})` : user.displayName
    }
    return user.email || (user.id?.includes('@') ? user.id : val)
  }

  return val
}

/** ユーザー情報の詳細（表示名、メール、頭文字）を取得する */
function getUserInfo(val: string) {
  // 自分自身と一致する場合
  if (userStore.currentUser && (userStore.currentUser.id === val || userStore.currentUser.email === val)) {
    const displayName = userStore.currentUser.displayName || undefined
    const email = userStore.currentUser.email || (val.includes('@') ? val : undefined)
    const initial = (displayName || email || val).charAt(0).toUpperCase()
    return { displayName, email, initial, isSelf: true }
  }

  // props.users から検索
  const user = (props.users ?? []).find((u) => u.id === val || u.email === val)
  if (user) {
    const displayName = user.displayName || undefined
    const email = user.email || (user.id?.includes('@') ? user.id : val.includes('@') ? val : undefined)
    const initial = (displayName || email || val).charAt(0).toUpperCase()
    return { displayName, email, initial, isSelf: false }
  }

  const initial = val.charAt(0).toUpperCase()
  return { displayName: undefined, email: val.includes('@') ? val : undefined, initial, isSelf: false }
}

/**
 * v-combobox の update:model-value で受け取る値を正規化する。
 * 候補から選択した場合はオブジェクト { title, value }、
 * 直接入力した場合は string が混在するため、
 * すべて string に統一する。
 */
function handleUpdate(rawValues: (string | { title: string; value: string })[]) {
  const normalized = rawValues.map((v) => (typeof v === 'string' ? v : (v?.value ?? ''))).filter((v) => v !== '')
  emit('update:modelValue', normalized)
}
</script>

<template>
  <v-col cols="12" class="d-flex align-center">
    <v-combobox
      :model-value="modelValue"
      @update:model-value="handleUpdate"
      :label="label"
      :items="suggestionItems"
      :disabled="disabled"
      item-title="title"
      item-value="value"
      multiple
      chips
      deletable-chips
      closable-chips
      density="compact"
      variant="outlined"
      hide-details="auto"
      class="mb-3 mr-2"
      :rules="mergedRules"
      autocomplete="off"
    >
      <template #chip="{ props: chipProps, item }">
        <v-chip v-bind="chipProps" size="small" variant="tonal" class="font-weight-medium">
          <template #prepend>
            <v-avatar size="20" color="primary" class="text-white text-caption mr-1">
              {{ getUserInfo(item.value).initial }}
            </v-avatar>
          </template>
          {{ getDisplayText(item.value) }}
        </v-chip>
      </template>

      <template #item="{ props: itemProps, item }">
        <v-list-item v-bind="itemProps" :title="undefined">
          <template #prepend>
            <v-avatar size="28" color="primary" class="text-white text-caption mr-2 font-weight-bold">
              {{ getUserInfo(item.value).initial }}
            </v-avatar>
          </template>
          <v-list-item-title class="font-weight-medium">
            {{ getUserInfo(item.value).displayName || getUserInfo(item.value).email || item.value }}
            <v-chip v-if="getUserInfo(item.value).isSelf" size="x-small" color="primary" variant="tonal" class="ml-1">
              あなた
            </v-chip>
          </v-list-item-title>
          <v-list-item-subtitle v-if="getUserInfo(item.value).displayName && getUserInfo(item.value).email" class="text-caption">
            {{ getUserInfo(item.value).email }}
          </v-list-item-subtitle>
        </v-list-item>
      </template>
    </v-combobox>
    <HelpText :text="helpText" />
  </v-col>
</template>
