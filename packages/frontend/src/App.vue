<script setup lang="ts">
import DialogProvider from '@/components/DialogProvider.vue'
import GanttChartView from '@/views/GanttChartView.vue'
</script>

<template>
  <DialogProvider>
    <v-app theme="dark">
      <GanttChartView />
    </v-app>
  </DialogProvider>
</template>

<style scoped></style>
