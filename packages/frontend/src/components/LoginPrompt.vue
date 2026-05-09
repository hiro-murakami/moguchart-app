<script setup lang="ts">
import { useUserStore } from '@/stores/useUserStore'
import { useAlert } from '@/composables/useAlert'

const userStore = useUserStore()
const alert = useAlert()

const handleSignInAnonymously = async () => {
  userStore.setSuppressProjectList(true)
  await userStore.signInAnonymously()
  await alert({
    title: 'ゲストユーザーとしてログインしました',
    message: 'ゲストユーザーで作成したデータは、およそ24時間後に自動削除されます。',
  })
  userStore.setSuppressProjectList(false)
}
</script>

<template>
  <v-container class="fill-height">
    <v-row align="center" justify="center" style="height: 100vh">
      <v-col cols="12" sm="8" md="4">
        <v-card class="elevation-12">
          <v-toolbar color="primary" dark>
            <v-toolbar-title>Login Required</v-toolbar-title>
          </v-toolbar>
          <v-card-actions class="flex-column align-center py-8">
            <v-btn class="text-none mb-2" color="white" min-width="220" variant="flat" @click="userStore.signIn">
              <template v-slot:prepend>
                <GoogleIcon />
              </template>
              Sign in with Google
            </v-btn>
            <v-btn
              class="text-none"
              color="grey-darken-1"
              min-width="220"
              variant="outlined"
              prepend-icon="mdi-account-outline"
              @click="handleSignInAnonymously"
            >
              ゲストとしてログインする
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
