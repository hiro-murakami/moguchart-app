<script setup lang="ts">
import type { Label } from '@functions/types/shared'
import { getContrastColor } from '@/modules/utils'

defineProps<{
  items: Label[]
}>()

const modelValue = defineModel<Label[]>({ default: () => [] })
</script>

<template>
  <v-autocomplete
    v-model="modelValue"
    :items="items"
    item-title="name"
    return-object
    label="ラベル"
    multiple
    chips
    closable-chips
    density="compact"
    variant="outlined"
    hide-details
    autocomplete="off"
  >
    <template #chip="{ props, item }">
      <v-chip
        v-bind="props"
        :color="item.raw.color"
        variant="flat"
        label
        size="small"
        class="font-weight-bold"
        :style="{ color: getContrastColor(item.raw.color) }"
      >
        {{ item.raw.name }}
      </v-chip>
    </template>
    <template #item="{ props, item }">
      <v-list-item v-bind="props" title="">
        <template #prepend>
          <v-chip
            :color="item.raw.color"
            variant="flat"
            label
            size="small"
            class="mr-2 font-weight-bold"
            :style="{ color: getContrastColor(item.raw.color) }"
          >
            {{ item.raw.name }}
          </v-chip>
        </template>
      </v-list-item>
    </template>
  </v-autocomplete>
</template>
