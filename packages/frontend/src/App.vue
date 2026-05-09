<script setup lang="ts">
import { provideLoading } from '@/composables/useLoading'
import { useUserStore } from '@/stores/useUserStore'
import { useProjectStore } from '@/stores/useProjectStore'
import { storeToRefs } from 'pinia'
import { onMounted, onUnmounted, ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import headerImage from '@/assets/header2.png'
import { VERSION } from '@functions/types/shared'
import AppUserMenu from '@/components/AppUserMenu.vue'

const { isLoading } = provideLoading()
const userStore = useUserStore()
const projectStore = useProjectStore()
const router = useRouter()
const { firebaseUser, currentTheme, versionUpdated } = storeToRefs(userStore)
const showUserDetail = ref(false)
const showManual = ref(false)
const showAuthorityHistory = ref(false)
const showReleaseNotes = ref(false)

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

// バージョンアップ時にリリースノートを自動表示
watch(versionUpdated, (updated) => {
  if (updated) {
    showReleaseNotes.value = true
  }
})

const returnToSplash = () => {
  projectStore.setProjectId('')
  router.push('/')
}
</script>

<template>
  <DialogProvider>
    <v-app :theme="effectiveTheme">
      <v-app-bar color="moguChartColor" height="54">
        <img :src="headerImage" height="32" class="header-image ml-4" @click="returnToSplash" />
        <span class="ml-2 text-label-large" style="opacity: 0.7">v{{ VERSION }}</span>
        <v-spacer />
        <TooltipBtn
          icon="mdi-book-open-variant"
          variant="text"
          tooltip="操作マニュアル"
          @click="showManual = !showManual"
        />
        <v-btn v-if="!firebaseUser" @click="userStore.signIn"> Login </v-btn>
        <AppUserMenu
          v-else
          v-model:show-user-detail="showUserDetail"
          v-model:show-authority-history="showAuthorityHistory"
          v-model:show-release-notes="showReleaseNotes"
        />
      </v-app-bar>
      <v-main>
        <router-view v-if="firebaseUser" />
        <LoginPrompt v-else />
        <UserDetailDialog v-model="showUserDetail" />
        <AuthorityHistoryDialog v-model="showAuthorityHistory" />
        <OperationManualDrawer v-model="showManual" />
        <ReleaseNotesDialog v-model="showReleaseNotes" />
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
  cursor: pointer;
}
</style>
