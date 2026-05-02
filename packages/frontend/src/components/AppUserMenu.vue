<script setup lang="ts">
import { useUserStore } from '@/stores/useUserStore'
import { useProjectStore } from '@/stores/useProjectStore'
import { storeToRefs } from 'pinia'

const userStore = useUserStore()
const projectStore = useProjectStore()
const { user: appUser, firebaseUser } = storeToRefs(userStore)

const showUserDetail = defineModel<boolean>('showUserDetail', { required: true })
const showAuthorityHistory = defineModel<boolean>('showAuthorityHistory', { required: true })
const showReleaseNotes = defineModel<boolean>('showReleaseNotes', { required: true })
</script>

<template>
  <v-menu location="bottom end">
    <template v-slot:activator="{ props }">
      <TutorialOverlay
        :condition="!!projectStore.currentProjectId"
        tutorial-key="userSetting"
        message="[ユーザー設定]で表示名を変更できます"
        placement="bottom"
      >
        <template #activator="{ props: overlayProps }">
          <UserAvatar
            class="mr-4 cursor-pointer"
            v-bind="{ ...props, ...overlayProps }"
            :url="firebaseUser?.photoURL"
            :name="appUser?.displayName || firebaseUser?.displayName"
          />
        </template>
      </TutorialOverlay>
    </template>
    <v-list>
      <v-list-item prepend-icon="mdi-account-cog" @click="showUserDetail = true">
        <v-list-item-title>ユーザー設定</v-list-item-title>
      </v-list-item>
      <v-list-item prepend-icon="mdi-history" @click="showAuthorityHistory = true">
        <v-list-item-title>メールアドレス履歴</v-list-item-title>
      </v-list-item>
      <v-list-item prepend-icon="mdi-note-text-outline" @click="showReleaseNotes = true">
        <v-list-item-title>リリースノート</v-list-item-title>
      </v-list-item>
      <v-list-item prepend-icon="mdi-logout" @click="userStore.signOut">
        <v-list-item-title>ログアウト</v-list-item-title>
      </v-list-item>
    </v-list>
  </v-menu>
  <div class="d-flex flex-column mr-4">
    <span class="text-label-large">{{ appUser?.displayName || firebaseUser?.displayName }}</span>
    <span class="text-label-medium">{{ appUser?.email || firebaseUser?.email }}</span>
  </div>
</template>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}
</style>
