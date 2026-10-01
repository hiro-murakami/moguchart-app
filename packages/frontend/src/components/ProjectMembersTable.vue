<script setup lang="ts">
import { ref, computed } from 'vue'
import { useUserStore } from '@/stores/useUserStore'
import inputRules from '@/modules/inputRules'
import UserAvatar from '@/components/common/UserAvatar.vue'
import type { User, Role } from '@functions/types/shared'

const props = defineProps<{
  owners: string[]
  editors: string[]
  viewers: string[]
  users?: User[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:owners', value: string[]): void
  (e: 'update:editors', value: string[]): void
  (e: 'update:viewers', value: string[]): void
}>()

const userStore = useUserStore()

const newMemberInput = ref('')
const newMemberRole = ref<Role>('editor')
const errorMessage = ref('')

const roleOptions: { title: string; value: Role }[] = [
  { title: 'オーナー', value: 'owner' },
  { title: '編集者', value: 'editor' },
  { title: '閲覧者', value: 'viewer' },
]

interface MemberItem {
  id: string
  role: Role
  displayName?: string
  email?: string
  photoURL?: string | null
  isCurrentUser: boolean
}

/** ユーザー情報を補完・解決したメンバーリスト */
const memberItems = computed<MemberItem[]>(() => {
  const list: MemberItem[] = []

  const resolveUserInfo = (id: string, role: Role): MemberItem => {
    const isCurrentUser =
      !!userStore.currentUser &&
      (userStore.currentUser.id === id || userStore.currentUser.email === id)

    if (isCurrentUser && userStore.currentUser) {
      return {
        id,
        role,
        displayName: userStore.currentUser.displayName || undefined,
        email: userStore.currentUser.email || (id.includes('@') ? id : undefined),
        photoURL:
          userStore.currentUser.attribute?.photoURL ||
          userStore.firebaseUser?.photoURL ||
          undefined,
        isCurrentUser: true,
      }
    }

    const matchedUser = (props.users ?? []).find(
      (u) => u.id === id || u.email === id,
    )
    if (matchedUser) {
      return {
        id,
        role,
        displayName: matchedUser.displayName || undefined,
        email: matchedUser.email || (id.includes('@') ? id : undefined),
        photoURL: matchedUser.attribute?.photoURL || undefined,
        isCurrentUser: false,
      }
    }

    return {
      id,
      role,
      email: id.includes('@') ? id : undefined,
      photoURL: undefined,
      isCurrentUser: false,
    }
  }

  const addUnique = (item: MemberItem) => {
    const existingIndex = list.findIndex((m) => {
      if (m.id === item.id) return true
      if (m.email && item.email && m.email === item.email) return true
      if (m.isCurrentUser && item.isCurrentUser) return true
      return false
    })
    if (existingIndex === -1) {
      list.push(item)
    } else {
      const existing = list[existingIndex]
      if (existing) {
        if (!existing.email && item.email) existing.email = item.email
        if (!existing.displayName && item.displayName) existing.displayName = item.displayName
        if (!existing.photoURL && item.photoURL) existing.photoURL = item.photoURL
      }
    }
  }

  for (const id of props.owners) {
    addUnique(resolveUserInfo(id, 'owner'))
  }
  for (const id of props.editors) {
    addUnique(resolveUserInfo(id, 'editor'))
  }
  for (const id of props.viewers) {
    addUnique(resolveUserInfo(id, 'viewer'))
  }

  return list
})

/** 現在のオーナー人数（重複排除後） */
const ownerCount = computed(
  () => memberItems.value.filter((m) => m.role === 'owner').length,
)

/** ユーザーに関連するID（UIDとメール）をリストから除外するヘルパー */
function cleanIdentifiers(list: string[], member: MemberItem): string[] {
  return list.filter((id) => {
    if (id === member.id) return false
    if (member.email && id === member.email) return false
    if (member.isCurrentUser && userStore.currentUser) {
      if (id === userStore.currentUser.id || id === userStore.currentUser.email) return false
    }
    return true
  })
}

/** 入力補完候補 */
const suggestionItems = computed(() => {
  const currentIds = new Set([
    ...props.owners,
    ...props.editors,
    ...props.viewers,
  ])

  const candidates: {
    title: string
    value: string
    displayName?: string
    email?: string
    photoURL?: string | null
  }[] = []

  // 1. 履歴ユーザー
  const history = userStore.currentUser?.attribute?.authorityInputHistory ?? []
  for (const email of history) {
    if (typeof email === 'string' && email.includes('@') && !currentIds.has(email)) {
      candidates.push({ title: email, value: email })
    }
  }

  // 2. プロジェクト関係者
  for (const u of props.users ?? []) {
    const val = u.email || u.id
    if (val && !currentIds.has(val) && !currentIds.has(u.id)) {
      const title = u.displayName
        ? u.email
          ? `${u.displayName} (${u.email})`
          : u.displayName
        : u.email || u.id
      if (!candidates.some((c) => c.value === val)) {
        candidates.push({
          title,
          value: val,
          displayName: u.displayName || undefined,
          email: u.email || (u.id?.includes('@') ? u.id : undefined),
          photoURL: u.attribute?.photoURL || undefined,
        })
      }
    }
  }

  return candidates
})

/** 候補アイテムの情報を安全に取得する */
function getCandidateInfo(item: any) {
  const raw = item?.raw || item || {}
  const displayName = raw.displayName || undefined
  const email = raw.email || (typeof raw.value === 'string' && raw.value.includes('@') ? raw.value : undefined)
  const photoURL = raw.photoURL || undefined
  const title = displayName || email || raw.title || raw.value || ''
  return { displayName, email, photoURL, title }
}

/** メンバーのロールを変更する */
function changeRole(member: MemberItem, newRole: Role) {
  if (props.disabled) return
  if (member.role === newRole) return

  // 最後の1人のオーナーのロールは変更不可
  if (member.role === 'owner' && ownerCount.value <= 1) {
    errorMessage.value = 'プロジェクトには最低1人のオーナーが必要です'
    return
  }
  errorMessage.value = ''

  const newOwners = cleanIdentifiers(props.owners, member)
  const newEditors = cleanIdentifiers(props.editors, member)
  const newViewers = cleanIdentifiers(props.viewers, member)

  if (newRole === 'owner') newOwners.push(member.id)
  else if (newRole === 'editor') newEditors.push(member.id)
  else if (newRole === 'viewer') newViewers.push(member.id)

  emit('update:owners', newOwners)
  emit('update:editors', newEditors)
  emit('update:viewers', newViewers)
}

/** メンバーを削除する */
function removeMember(member: MemberItem) {
  if (props.disabled) return

  // 最後の1人のオーナーは削除不可
  if (member.role === 'owner' && ownerCount.value <= 1) {
    errorMessage.value = 'プロジェクトには最低1人のオーナーが必要です'
    return
  }
  errorMessage.value = ''

  emit('update:owners', cleanIdentifiers(props.owners, member))
  emit('update:editors', cleanIdentifiers(props.editors, member))
  emit('update:viewers', cleanIdentifiers(props.viewers, member))
}

/** 新規メンバーを追加する */
function addMember() {
  if (props.disabled) return
  const rawValue = newMemberInput.value
  const target = typeof rawValue === 'object' && rawValue !== null
    ? (rawValue as any).value || (rawValue as any).title || ''
    : String(rawValue || '').trim()

  if (!target) {
    errorMessage.value = 'メールアドレスを入力してください'
    return
  }

  // 既存重複チェック
  const exists = memberItems.value.some(
    (m) => m.id === target || (m.email && m.email === target),
  )
  if (exists) {
    errorMessage.value = '既にプロジェクトのメンバーに含まれています'
    return
  }

  errorMessage.value = ''

  if (newMemberRole.value === 'owner') {
    emit('update:owners', [...props.owners, target])
  } else if (newMemberRole.value === 'editor') {
    emit('update:editors', [...props.editors, target])
  } else if (newMemberRole.value === 'viewer') {
    emit('update:viewers', [...props.viewers, target])
  }

  newMemberInput.value = ''
}

/** 頭文字アバター用文字列 */
function getAvatarInitial(member: MemberItem): string {
  if (member.displayName) {
    return member.displayName.charAt(0).toUpperCase()
  }
  if (member.email) {
    return member.email.charAt(0).toUpperCase()
  }
  return member.id.charAt(0).toUpperCase()
}

/** ロールに応じたバッジ色 */
function getRoleColor(role: Role): string {
  switch (role) {
    case 'owner':
      return 'primary'
    case 'editor':
      return 'secondary'
    case 'viewer':
      return 'grey'
  }
}
</script>

<template>
  <div class="project-members-table w-100">
    <!-- エラーメッセージ表示 -->
    <v-alert
      v-if="errorMessage"
      type="warning"
      density="compact"
      variant="tonal"
      class="mb-3"
      closable
      @click:close="errorMessage = ''"
    >
      {{ errorMessage }}
    </v-alert>

    <!-- 新規メンバー追加エリア -->
    <v-card variant="outlined" class="mb-4 pa-3 rounded-lg" :disabled="disabled">
      <div class="text-subtitle-2 mb-2 font-weight-medium">
        <v-icon icon="mdi-account-plus" size="small" class="mr-1" />
        メンバーを追加
      </div>
      <v-row density="compact" align="center">
        <v-col cols="12" sm="7">
          <v-combobox
            v-model="newMemberInput"
            :items="suggestionItems"
            item-title="title"
            item-value="value"
            label="メールアドレスを入力または選択"
            placeholder="user@example.com"
            density="compact"
            variant="outlined"
            hide-details
            clearable
            autocomplete="off"
            :rules="[inputRules.isMailAddress]"
            @keydown.enter.prevent="addMember"
          >
            <template #item="{ props: itemProps, item }">
              <v-list-item v-bind="itemProps" :title="undefined">
                <template #prepend>
                  <UserAvatar
                    size="28"
                    color="primary"
                    class="mr-2"
                    :url="getCandidateInfo(item).photoURL"
                    :name="getCandidateInfo(item).title"
                  />
                </template>
                <v-list-item-title class="font-weight-medium">
                  {{ getCandidateInfo(item).title }}
                </v-list-item-title>
                <v-list-item-subtitle v-if="getCandidateInfo(item).displayName && getCandidateInfo(item).email" class="text-caption">
                  {{ getCandidateInfo(item).email }}
                </v-list-item-subtitle>
              </v-list-item>
            </template>
          </v-combobox>
        </v-col>
        <v-col cols="7" sm="3">
          <v-select
            v-model="newMemberRole"
            :items="roleOptions"
            label="ロール"
            density="compact"
            variant="outlined"
            hide-details
          />
        </v-col>
        <v-col cols="5" sm="2" class="d-flex justify-end">
          <v-btn
            color="primary"
            variant="flat"
            block
            prepend-icon="mdi-plus"
            :disabled="!newMemberInput || disabled"
            @click="addMember"
          >
            追加
          </v-btn>
        </v-col>
      </v-row>
    </v-card>

    <!-- メンバー一覧テーブル -->
    <v-card variant="outlined" class="rounded-lg">
      <v-table density="compact" class="members-table">
        <thead>
          <tr>
            <th class="text-left font-weight-bold" style="width: 55%">メンバー</th>
            <th class="text-left font-weight-bold" style="width: 33%">権限ロール</th>
            <th class="text-center font-weight-bold" style="width: 12%">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in memberItems" :key="item.id">
            <!-- メンバー情報（アバター＋名前＋メール） -->
            <td class="py-2">
              <div class="d-flex align-center">
                <UserAvatar
                  size="32"
                  :color="getRoleColor(item.role)"
                  class="mr-3"
                  :url="item.photoURL"
                  :name="item.displayName || item.email || item.id"
                />
                <div class="d-flex flex-column text-truncate">
                  <div class="d-flex align-center">
                    <span class="font-weight-medium text-body-2 text-truncate">
                      {{ item.displayName || item.email || item.id }}
                    </span>
                    <v-chip
                      v-if="item.isCurrentUser"
                      size="x-small"
                      color="primary"
                      variant="tonal"
                      class="ml-2"
                    >
                      あなた
                    </v-chip>
                  </div>
                  <span
                    v-if="item.displayName && item.email"
                    class="text-caption text-medium-emphasis text-truncate"
                  >
                    {{ item.email }}
                  </span>
                </div>
              </div>
            </td>

            <!-- ロール変更セレクター -->
            <td class="py-2">
              <v-select
                :model-value="item.role"
                @update:model-value="(val) => changeRole(item, val)"
                :items="roleOptions"
                density="compact"
                variant="outlined"
                hide-details
                :disabled="disabled || (item.role === 'owner' && ownerCount <= 1)"
                style="max-width: 160px"
              />
            </td>

            <!-- 削除ボタン -->
            <td class="text-center py-2">
              <v-btn
                icon="mdi-trash-can-outline"
                variant="text"
                color="error"
                size="small"
                :disabled="disabled || (item.role === 'owner' && ownerCount <= 1)"
                @click="removeMember(item)"
              />
            </td>
          </tr>
          <tr v-if="memberItems.length === 0">
            <td colspan="3" class="text-center py-4 text-medium-emphasis">
              メンバーが登録されていません
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card>

    <div class="text-caption text-medium-emphasis mt-2 px-1">
      ※ プロジェクトには必ず最低1人のオーナーが必要です。
    </div>
  </div>
</template>

<style scoped>
.members-table :deep(td) {
  height: 56px !important;
}
</style>
