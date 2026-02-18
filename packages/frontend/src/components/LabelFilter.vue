<script setup lang="ts">
import { computed } from 'vue'
import { getContrastColor } from '@/modules/utils'
import { UNLABELED_VALUE } from '@/modules/constants'

interface Label {
  name: string
  color: string
  isUnlabeled?: boolean
}

const props = defineProps<{
  availableLabels: Label[]
}>()

const selectedLabels = defineModel<string[]>({ default: () => [] })

const items = computed(() => [{ name: 'ラベルなし', color: '#9e9e9e', isUnlabeled: true }, ...props.availableLabels])

const emit = defineEmits<{
  selectAll: []
  clearAll: []
}>()
</script>

<template>
  <v-select
    v-model="selectedLabels"
    :items="items"
    item-title="name"
    :item-value="(item: any) => (item.isUnlabeled ? UNLABELED_VALUE : item.name)"
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
        :class="{ 'font-weight-bold': item.raw.isUnlabeled }"
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
      </v-list-item>
    </template>
  </v-select>
</template>

<style scoped>
.filter-labels-select {
  max-width: 300px;
  min-width: 200px;
}
</style>
