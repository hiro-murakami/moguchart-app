<script setup lang="ts">
import { useUserStore } from '@/stores/useUserStore'

const userStore = useUserStore()
</script>

<template>
  <v-container class="fill-height">
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="4">
        <v-card class="elevation-12">
          <v-toolbar color="primary" dark>
            <v-toolbar-title>Login Required</v-toolbar-title>
          </v-toolbar>
          <v-card-text>
            <p class="text-center">この機能を利用するにはログインが必要です。</p>
          </v-card-text>
          <v-card-actions class="justify-center">
            <v-btn class="text-none" color="white" min-width="220" variant="flat" @click="userStore.signIn">
              <template v-slot:prepend>
                <GoogleIcon />
              </template>
              Sign in with Google
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
