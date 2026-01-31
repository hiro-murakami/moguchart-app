<script setup lang="ts">
import DialogProvider from '@/components/DialogProvider.vue'
import { provideLoading } from '@/modules/useLoading'
import { useAuth } from '@/modules/useAuth'

const { isLoading } = provideLoading()
const { user, signIn, signOut } = useAuth()
</script>

<template>
  <DialogProvider>
    <v-app theme="dark">
      <v-app-bar>
        <v-app-bar-title>Moguchart</v-app-bar-title>
        <v-spacer />
        <v-btn v-if="!user" @click="signIn"> Login </v-btn>
        <template v-else>
          <v-avatar class="mr-4">
            <v-img :src="user.photoURL ?? ''" />
          </v-avatar>
          <span>{{ user.displayName }}</span>
          <v-btn class="ml-4" @click="signOut"> Logout </v-btn>
        </template>
      </v-app-bar>
      <v-main>
        <router-view />
      </v-main>
      <v-overlay
        v-model="isLoading"
        class="align-center justify-center"
        persistent
      >
        <v-progress-circular indeterminate size="64" />
      </v-overlay>
    </v-app>
  </DialogProvider>
</template>

<style scoped></style>
