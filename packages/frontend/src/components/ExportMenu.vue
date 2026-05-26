<script setup lang="ts">
defineEmits<{
  exportCsv: []
  exportExcel: []
  exportZip: []
  exportPng: []
  exportPdf: []
}>()
</script>

<template>
  <v-menu location="bottom end">
    <template #activator="{ props: exportMenuProps }">
      <TooltipBtn
        v-bind="exportMenuProps"
        icon="mdi-file-export-outline"
        variant="text"
        tooltip="エクスポート"
      />
    </template>
    <v-list density="compact">
      <v-list-item prepend-icon="mdi-file-delimited-outline" @click="$emit('exportCsv')">
        <v-list-item-title>CSV でエクスポート</v-list-item-title>
      </v-list-item>
      <v-list-item prepend-icon="mdi-file-excel-outline" @click="$emit('exportExcel')">
        <v-list-item-title>Excel でエクスポート</v-list-item-title>
      </v-list-item>
      <v-list-item prepend-icon="mdi-folder-zip-outline" @click="$emit('exportZip')">
        <v-list-item-title>ZIP でエクスポート</v-list-item-title>
      </v-list-item>
      <v-divider />
      <v-list-item prepend-icon="mdi-image-outline" @click="$emit('exportPng')">
        <v-list-item-title>PNG でエクスポート</v-list-item-title>
      </v-list-item>
      <v-list-item prepend-icon="mdi-file-pdf-box" @click="$emit('exportPdf')">
        <v-list-item-title>PDF でエクスポート</v-list-item-title>
      </v-list-item>
    </v-list>
  </v-menu>
</template>
