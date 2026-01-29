<script setup lang="ts">
import DialogProvider from '@/components/DialogProvider.vue'
import GanttChartView from '@/views/GanttChartView.vue'
import { provideLoading } from '@/modules/useLoading'

const { isLoading } = provideLoading()
</script>

<template>
  <DialogProvider>
    <v-app theme="dark">
      <GanttChartView />
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
