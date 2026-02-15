<script setup lang="ts">
import { provideLoading } from '@/modules/useLoading'
import { useUserStore } from '@/stores/useUserStore'
import { storeToRefs } from 'pinia'
import { onMounted, ref } from 'vue'

const { isLoading } = provideLoading()
const userStore = useUserStore()
const { user: appUser, firebaseUser, headerImage, currentTheme } = storeToRefs(userStore)
const showUserDetail = ref(false)

onMounted(() => {
  userStore.initializeAuthListener()
})
</script>

<template>
  <DialogProvider>
    <v-app :theme="currentTheme">
      <v-app-bar color="moguChartColor">
        <img :src="headerImage" height="42" class="header-image ml-4" />
        <v-spacer />
        <v-btn v-if="!firebaseUser" @click="userStore.signIn"> Login </v-btn>
        <template v-else>
          <v-menu location="bottom end">
            <template v-slot:activator="{ props }">
              <v-avatar class="mr-4 cursor-pointer" v-bind="props">
                <v-img :src="firebaseUser.photoURL ?? ''" />
              </v-avatar>
            </template>
            <v-list>
              <v-list-item prepend-icon="mdi-account-cog" @click="showUserDetail = true">
                <v-list-item-title>ユーザー設定</v-list-item-title>
              </v-list-item>
              <v-list-item prepend-icon="mdi-logout" @click="userStore.signOut">
                <v-list-item-title>ログアウト</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
          <div class="d-flex flex-column mr-4">
            <span class="text-subtitle-2">{{ appUser?.displayName ?? firebaseUser.displayName }}</span>
            <span class="text-caption text-medium-emphasis">{{ appUser?.email ?? firebaseUser.email }}</span>
          </div>
        </template>
      </v-app-bar>
      <v-main>
        <router-view v-if="firebaseUser" />
        <LoginPrompt v-else />
        <UserDetailDialog v-model="showUserDetail" />
      </v-main>
      <v-overlay v-model="isLoading" class="align-center justify-center" persistent>
        <v-progress-circular indeterminate size="64" />
      </v-overlay>
    </v-app>
  </DialogProvider>
</template>

<style scoped lang="scss">
.header-image {
  border-radius: 6px;
}
.cursor-pointer {
  cursor: pointer;
}
</style>
