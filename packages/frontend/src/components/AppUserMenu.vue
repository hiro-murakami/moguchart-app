<script setup lang="ts">
import { useUserStore } from '@/stores/useUserStore'
import { useProjectStore } from '@/stores/useProjectStore'
import { storeToRefs } from 'pinia'

const userStore = useUserStore()
const projectStore = useProjectStore()
const { user: appUser, firebaseUser } = storeToRefs(userStore)

const showUserDetail = defineModel<boolean>('showUserDetail', { required: true })
const showReleaseNotes = defineModel<boolean>('showReleaseNotes', { required: true })
const showApiKeyManage = defineModel<boolean>('showApiKeyManage', { required: true })
</script>

<template>
  <!-- 匿名ユーザー（ゲスト）の場合 -->
  <template v-if="userStore.isAnonymous">
    <v-menu location="bottom end">
      <template v-slot:activator="{ props }">
        <div class="d-flex align-center cursor-pointer user-menu-trigger mr-3" v-bind="props">
          <v-avatar color="grey-darken-1" size="32" class="flex-shrink-0">
            <v-icon icon="mdi-account" size="20" color="white" />
          </v-avatar>
          <span class="text-label-large user-display-name ml-2">ゲストユーザー</span>
        </div>
      </template>
      <v-list>
        <v-list-item>
          <v-list-item-title class="font-weight-bold">ゲストユーザー</v-list-item-title>
          <v-list-item-subtitle>ログインしていません</v-list-item-subtitle>
        </v-list-item>
        <v-divider />
        <v-list-item prepend-icon="mdi-google" @click="userStore.signIn">
          <v-list-item-title>Googleでログイン</v-list-item-title>
        </v-list-item>
        <v-list-item prepend-icon="mdi-logout" @click="userStore.signOut">
          <v-list-item-title>ログアウト</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
  </template>

  <!-- 通常ユーザー（Googleログイン済み）の場合 -->
  <template v-else>
    <v-menu location="bottom end">
      <template v-slot:activator="{ props }">
        <div class="d-flex align-center cursor-pointer user-menu-trigger mr-3" v-bind="props">
          <TutorialOverlay
            :condition="!!projectStore.currentProjectId"
            tutorial-key="userSetting"
            message="[ユーザー設定]で表示名を変更できます"
            placement="bottom"
          >
            <template #activator="{ props: overlayProps }">
              <UserAvatar
                class="flex-shrink-0"
                size="32"
                v-bind="overlayProps"
                :url="firebaseUser?.photoURL"
                :name="appUser?.displayName || firebaseUser?.displayName"
              />
            </template>
          </TutorialOverlay>
          <div class="user-info-text ml-2">
            <span class="text-label-large text-truncate user-display-name">
              {{ appUser?.displayName || firebaseUser?.displayName }}
            </span>
            <span class="text-label-medium text-truncate user-email">
              {{ appUser?.email || firebaseUser?.email }}
            </span>
          </div>
        </div>
      </template>
      <v-list>
        <v-list-item prepend-icon="mdi-account-cog" @click="showUserDetail = true">
          <v-list-item-title>ユーザー設定</v-list-item-title>
        </v-list-item>
        <v-list-item prepend-icon="mdi-note-text-outline" @click="showReleaseNotes = true">
          <v-list-item-title>リリースノート</v-list-item-title>
        </v-list-item>

        <v-list-item prepend-icon="mdi-key-variant" @click="showApiKeyManage = true">
          <v-list-item-title>APIキー管理</v-list-item-title>
        </v-list-item>
        <v-list-item prepend-icon="mdi-logout" @click="userStore.signOut">
          <v-list-item-title>ログアウト</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
  </template>
</template>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}

.user-menu-trigger {
  min-width: 0;
}

.user-info-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  max-width: 190px;
  line-height: 1.2;
}

.user-display-name {
  line-height: 1.25;
}

.user-email {
  opacity: 0.85;
  line-height: 1.2;
}

@media (max-height: 820px), (max-width: 1100px) {
  .user-email {
    display: none;
  }
  .user-info-text {
    max-width: 140px;
  }
}

@media (max-width: 640px) {
  .user-info-text,
  .user-display-name {
    display: none;
  }
}
</style>
