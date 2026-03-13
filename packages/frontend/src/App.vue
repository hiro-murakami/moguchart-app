<script setup lang="ts">
import { provideLoading } from '@/composables/useLoading'
import { useUserStore } from '@/stores/useUserStore'
import { useProjectStore } from '@/stores/useProjectStore'
import { storeToRefs } from 'pinia'
import { onMounted, onUnmounted, ref, computed } from 'vue'
import headerImage from '@/assets/header.png'
import { VERSION } from '@functions/types/shared'
import TutorialOverlay from '@/components/common/TutorialOverlay.vue'

const { isLoading } = provideLoading()
const userStore = useUserStore()
const projectStore = useProjectStore()
const { user: appUser, firebaseUser, currentTheme } = storeToRefs(userStore)
const showUserDetail = ref(false)

const systemTheme = ref<'light' | 'dark'>(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

const effectiveTheme = computed(() => {
  if (!currentTheme.value || currentTheme.value === 'system') {
    return systemTheme.value
  }
  return currentTheme.value
})

const updateSystemTheme = (e: MediaQueryListEvent) => {
  systemTheme.value = e.matches ? 'dark' : 'light'
}

onMounted(() => {
  userStore.initializeAuthListener()
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateSystemTheme)
})

onUnmounted(() => {
  window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', updateSystemTheme)
})
</script>

<template>
  <DialogProvider>
    <v-app :theme="effectiveTheme">
      <v-app-bar color="moguChartColor">
        <img :src="headerImage" height="42" class="header-image ml-4" />
        <span class="ml-2 text-label-large" style="opacity: 0.7">v{{ VERSION }}</span>
        <v-spacer />
        <v-btn v-if="!firebaseUser" @click="userStore.signIn"> Login </v-btn>
        <template v-else>
          <v-menu location="bottom end">
            <template v-slot:activator="{ props }">
              <TutorialOverlay
                :condition="!!projectStore.currentProjectId"
                tutorial-key="userSetting"
                message="[ユーザー設定]で表示名とテーマを変更できます"
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
              <v-list-item prepend-icon="mdi-logout" @click="userStore.signOut">
                <v-list-item-title>ログアウト</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
          <div class="d-flex flex-column mr-4">
            <span class="text-label-large">{{ appUser?.displayName || firebaseUser.displayName }}</span>
            <span class="text-label-medium">{{ appUser?.email || firebaseUser.email }}</span>
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
