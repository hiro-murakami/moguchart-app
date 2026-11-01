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

const getRawLabel = (item: any): Label => item?.raw ?? item

const removeLabel = (label: Label) => {
  const targetVal = label.isUnlabeled ? UNLABELED_VALUE : label.name
  selectedLabels.value = selectedLabels.value.filter((v) => v !== targetVal)
}

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

    <template #selection="{ item, index }">
      <v-chip
        v-if="index === 0"
        :style="{
          backgroundColor: getRawLabel(item).color,
          color: getContrastColor(getRawLabel(item).color),
          borderColor: 'rgba(0,0,0,0.1)',
        }"
        variant="flat"
        size="x-small"
        label
        closable
        class="selected-label-chip"
        :class="{ 'font-weight-bold': getRawLabel(item).isUnlabeled }"
        @click:close.stop="removeLabel(getRawLabel(item))"
      >
        <span class="text-truncate">{{ getRawLabel(item).name }}</span>
      </v-chip>
      <span v-else-if="index === 1" class="text-caption text-medium-emphasis ml-1 flex-shrink-0 font-weight-medium">
        +{{ selectedLabels.length - 1 }}
      </span>
    </template>

    <template #item="{ props, item }">
      <v-list-item v-bind="props" title="">
        <template #prepend>
          <v-chip
            :style="{ color: getContrastColor(getRawLabel(item).color) }"
            :color="getRawLabel(item).color"
            variant="flat"
            size="small"
            label
            class="mr-2 font-weight-bold"
          >
            {{ getRawLabel(item).name }}
          </v-chip>
        </template>
      </v-list-item>
    </template>
  </v-select>
</template>

<style scoped>
.filter-labels-select {
  max-width: 280px;
  min-width: 155px;
}

.filter-labels-select :deep(.v-field__input) {
  flex-wrap: nowrap;
  overflow: hidden;
}

.selected-label-chip {
  max-width: 120px;
}
</style>
