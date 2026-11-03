<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
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

const selectRef = ref<{ $el?: HTMLElement } | null>(null)
const containerWidth = ref(200)
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  const el = selectRef.value?.$el
  if (el && typeof ResizeObserver !== 'undefined') {
    containerWidth.value = el.clientWidth || 200
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          containerWidth.value = entry.contentRect.width
        }
      }
    })
    resizeObserver.observe(el)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})

const estimateChipWidth = (text: string): number => {
  let w = 0
  for (const ch of text) {
    w += ch.charCodeAt(0) > 0x7f ? 11.5 : 7
  }
  return Math.min(180, Math.ceil(w + 38))
}

const maxVisibleChips = computed(() => {
  const total = selectedLabels.value.length
  if (total <= 1) return 1

  const usableWidth = Math.max(80, containerWidth.value - 48)
  const chipWidths = selectedLabels.value.map((val) => {
    const name = val === UNLABELED_VALUE ? 'ラベルなし' : val
    return estimateChipWidth(name)
  })

  const sumAll = chipWidths.reduce((a, b) => a + b, 0)
  if (sumAll <= usableWidth) {
    return total
  }

  const badgeReserve = 28
  let accumulated = chipWidths[0] ?? 0
  let count = 1
  for (let i = 1; i < total; i++) {
    const nextWidth = chipWidths[i] ?? 0
    if (accumulated + nextWidth <= usableWidth - badgeReserve) {
      accumulated += nextWidth
      count++
    } else {
      break
    }
  }
  return count
})
</script>

<template>
  <v-select
    ref="selectRef"
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
        v-if="index < maxVisibleChips"
        :style="{
          backgroundColor: getRawLabel(item).color,
          color: getContrastColor(getRawLabel(item).color),
          borderColor: 'rgba(0,0,0,0.1)',
        }"
        variant="flat"
        size="x-small"
        label
        closable
        class="selected-label-chip mr-1"
        :class="{ 'font-weight-bold': getRawLabel(item).isUnlabeled }"
        @click:close.stop="removeLabel(getRawLabel(item))"
      >
        <span class="text-truncate">{{ getRawLabel(item).name }}</span>
      </v-chip>
      <span
        v-else-if="index === maxVisibleChips"
        class="text-caption text-medium-emphasis ml-1 flex-shrink-0 font-weight-medium"
      >
        +{{ selectedLabels.length - maxVisibleChips }}
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
  min-width: 135px;
}

.filter-labels-select :deep(.v-field__input) {
  flex-wrap: nowrap;
  overflow: hidden;
}

.selected-label-chip {
  max-width: 180px;
  min-width: 48px;
  flex: 0 1 auto;
}

.selected-label-chip :deep(.v-chip__content) {
  min-width: 0;
  overflow: hidden;
}
</style>
