<script setup lang="ts">
import { provideLoading } from '@/modules/useLoading'
import { useUserStore } from '@/stores/useUserStore'
import { storeToRefs } from 'pinia'
import headerImage from '@/assets/header.png'
import { onMounted } from 'vue'

const { isLoading } = provideLoading()
const userStore = useUserStore()
const { firebaseUser: user } = storeToRefs(userStore)

onMounted(() => {
  userStore.initializeAuthListener()
})
</script>

<template>
  <DialogProvider>
    <v-app theme="dark">
      <v-app-bar>
        <img :src="headerImage" height="34" class="header-image ml-4" />
        <v-spacer />
        <v-btn v-if="!user" @click="userStore.signIn"> Login </v-btn>
        <template v-else>
          <v-avatar class="mr-4">
            <v-img :src="user.photoURL ?? ''" />
          </v-avatar>
          <span>{{ user.displayName }}</span>
          <v-btn class="ml-4" @click="userStore.signOut"> Logout </v-btn>
        </template>
      </v-app-bar>
      <v-main>
        <router-view v-if="user" />
        <LoginPrompt v-else />
      </v-main>
      <v-overlay v-model="isLoading" class="align-center justify-center" persistent>
        <v-progress-circular indeterminate size="64" />
      </v-overlay>
    </v-app>
  </DialogProvider>
</template>

<style scoped>
.header-image {
  border-radius: 6px;
}
</style>
