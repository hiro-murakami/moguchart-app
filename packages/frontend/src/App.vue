<script setup lang="ts">
import DialogProvider from '@/components/DialogProvider.vue'
import { provideLoading } from '@/modules/useLoading'

const { isLoading } = provideLoading()
</script>

<template>
  <DialogProvider>
    <v-app theme="dark">
      <router-view />
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
