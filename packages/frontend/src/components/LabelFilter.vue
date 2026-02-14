<script setup lang="ts">
import { getContrastColor } from '@/modules/utils'

interface Label {
  name: string
  color: string
}

defineProps<{
  availableLabels: Label[]
}>()

const selectedLabels = defineModel<string[]>({ default: () => [] })

const emit = defineEmits<{
  selectAll: []
  clearAll: []
}>()
</script>

<template>
  <v-select
    v-model="selectedLabels"
    :items="availableLabels"
    item-title="name"
    item-value="name"
    label="ラベル絞り込み"
    multiple
    chips
    closable-chips
    density="compact"
    hide-details
    variant="outlined"
    class="filter-labels-select"
    autocomplete="off"
  >
    <template #prepend-item>
      <v-list-item title="すべて選択" @click="emit('selectAll')">
        <template #prepend>
          <v-icon icon="mdi-check-all" color="primary" />
        </template>
      </v-list-item>
      <v-list-item title="選択解除" @click="emit('clearAll')">
        <template #prepend>
          <v-icon icon="mdi-close-circle-outline" color="error" />
        </template>
      </v-list-item>
      <v-divider class="mt-2" />
    </template>

    <template #chip="{ props, item }">
      <v-chip
        v-bind="props"
        :style="{
          backgroundColor: item.raw.color,
          color: getContrastColor(item.raw.color),
          borderColor: 'rgba(0,0,0,0.1)',
        }"
        variant="flat"
        size="small"
        label
      >
        {{ item.raw.name }}
      </v-chip>
    </template>

    <template #item="{ props, item }">
      <v-list-item v-bind="props" title="">
        <template #prepend>
          <v-chip
            :style="{ color: getContrastColor(item.raw.color) }"
            :color="item.raw.color"
            variant="flat"
            size="small"
            label
            class="mr-2 font-weight-bold"
          >
            {{ item.raw.name }}
          </v-chip>
        </template>
        <v-list-item-title>
          {{ item.raw.name }}
        </v-list-item-title>
      </v-list-item>
    </template>
  </v-select>
</template>

<style scoped>
.filter-labels-select {
  max-width: 400px;
  min-width: 300px;
}
</style>
