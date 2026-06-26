<script setup lang="ts">
import { provideLoading } from '@/composables/useLoading'
import { useUserStore } from '@/stores/useUserStore'
import { useProjectStore } from '@/stores/useProjectStore'
import { storeToRefs } from 'pinia'
import { onMounted, onUnmounted, ref, computed, watch, provide } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import headerImage from '@/assets/header2.png'
import { VERSION } from '@functions/types/shared'
import AppUserMenu from '@/components/AppUserMenu.vue'
import { fetchPublicProject } from '@/modules/publicApi'

const { isLoading } = provideLoading()
const userStore = useUserStore()
const projectStore = useProjectStore()
const route = useRoute()
const router = useRouter()
const { firebaseUser, currentTheme, versionUpdated } = storeToRefs(userStore)
const showUserDetail = ref(false)
const showManual = ref(false)
const showAuthorityHistory = ref(false)
const showReleaseNotes = ref(false)

/** 未ログインで公開プロジェクトを閲覧中かどうか */
const isPublicViewMode = ref(false)
/** 公開プロジェクトの判定中フラグ */
const isCheckingPublicProject = ref(false)
/** 公開プロジェクト判定済みの ID キャッシュ（重複チェック防止） */
let lastCheckedPublicId = ''

// 子コンポーネント（useGanttChartView）からアクセスできるように provide
provide('isPublicViewMode', isPublicViewMode)

/** 公開閲覧モード用のテーマオーバーライド（DisplaySettingsMenu から更新される） */
const publicThemeOverride = ref<'light' | 'dark' | 'system' | null>(null)
provide('publicThemeOverride', publicThemeOverride)

const systemTheme = ref<'light' | 'dark'>(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

const resolveTheme = (theme: 'light' | 'dark' | 'system' | null | undefined): 'light' | 'dark' => {
  if (!theme || theme === 'system') return systemTheme.value
  return theme
}

const effectiveTheme = computed(() => {
  // 公開閲覧モードではオーバーライドを優先
  if (isPublicViewMode.value && publicThemeOverride.value) {
    return resolveTheme(publicThemeOverride.value)
  }
  return resolveTheme(currentTheme.value)
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

/**
 * 未ログイン時に /:id ルートの場合、公開プロジェクトかどうかをチェックする。
 * 認証状態の確定を待ってから判定するため、onAuthStateChanged → firebaseUser の更新後に実行される。
 */
const checkPublicProject = async () => {
  // ログイン済みの場合は通常フロー
  if (firebaseUser.value) {
    isPublicViewMode.value = false
    lastCheckedPublicId = ''
    return
  }

  // /:id パターンの場合のみ判定
  const routeId = route.params.id as string | undefined
  if (!routeId || routeId === lastCheckedPublicId) return

  lastCheckedPublicId = routeId
  isCheckingPublicProject.value = true
  try {
    const project = await fetchPublicProject(routeId)
    if (project) {
      isPublicViewMode.value = true
      projectStore.setPublicProject(project)
    } else {
      isPublicViewMode.value = false
    }
  } catch {
    isPublicViewMode.value = false
  } finally {
    isCheckingPublicProject.value = false
  }
}

// 認証状態変更 or ルート変更で公開プロジェクトチェックを実行
watch([firebaseUser, () => route.params.id], () => {
  checkPublicProject()
}, { immediate: true })

const returnToSplash = () => {
  projectStore.setProjectId('')
  isPublicViewMode.value = false
  lastCheckedPublicId = ''
  router.push('/')
}

/** router-view を表示すべきかどうか */
const shouldShowRouterView = computed(() => {
  return !!firebaseUser.value || isPublicViewMode.value
})

/** LoginPrompt を表示すべきかどうか */
const shouldShowLoginPrompt = computed(() => {
  return !firebaseUser.value && !isPublicViewMode.value && !isCheckingPublicProject.value
})
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
        <router-view v-if="shouldShowRouterView" />
        <LoginPrompt v-else-if="shouldShowLoginPrompt" />
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
