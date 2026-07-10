<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  modelValue: boolean
  x: number
  y: number
  selectedRowIds?: string[]
  rowId?: number | null
  isHidden?: boolean
  addRowCount?: number
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'edit-row'): void
  (e: 'add-row-above'): void
  (e: 'add-row-below'): void
  (e: 'delete-row'): void
  (e: 'toggle-visibility'): void
  (e: 'add-comment'): void
  (e: 'image'): void
}>()

const isVisible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const isMultiSelected = computed(() => {
  return (
    props.rowId != null &&
    props.selectedRowIds?.includes(String(props.rowId)) &&
    (props.selectedRowIds?.length ?? 0) > 1
  )
})

const selectedCount = computed(() => props.selectedRowIds?.length ?? 1)

const addRowAboveLabel = computed(() => {
  const count = props.addRowCount ?? 1
  if (count > 1) {
    return `上に${count}行を追加`
  }
  return '上に行を追加'
})

const addRowBelowLabel = computed(() => {
  const count = props.addRowCount ?? 1
  if (count > 1) {
    return `下に${count}行を追加`
  }
  return '下に行を追加'
})

const deleteLabel = computed(() => {
  if (isMultiSelected.value) {
    return `選択した${selectedCount.value}行を削除`
  }
  return '行を削除'
})

const visibilityLabel = computed(() => {
  if (isMultiSelected.value) {
    return props.isHidden ? `選択した${selectedCount.value}行を表示` : `選択した${selectedCount.value}行を非表示`
  }
  return props.isHidden ? '行を表示' : '行を非表示'
})
</script>

<template>
  <div
    v-if="isVisible"
    :style="{
      position: 'fixed',
      top: `${y}px`,
      left: `${x}px`,
      width: '0px',
      height: '0px',
    }"
  >
    <v-menu v-model="isVisible" activator="parent">
      <v-list density="compact">
        <v-list-item prepend-icon="mdi-pencil" title="行を編集" :disabled="isMultiSelected" @click="emit('edit-row')" />
        <v-divider />
        <v-list-item prepend-icon="mdi-arrow-up" :title="addRowAboveLabel" @click="emit('add-row-above')" />
        <v-list-item prepend-icon="mdi-arrow-down" :title="addRowBelowLabel" @click="emit('add-row-below')" />
        <v-divider />
        <v-list-item
          :prepend-icon="isHidden ? 'mdi-eye' : 'mdi-eye-off'"
          :title="visibilityLabel"
          @click="emit('toggle-visibility')"
        />
        <v-divider />
        <v-list-item prepend-icon="mdi-comment-text-outline" title="行にコメント" :disabled="isMultiSelected" @click="emit('add-comment')" />
        <v-list-item prepend-icon="mdi-image" title="画像" :disabled="isMultiSelected" @click="emit('image')" />
        <v-divider />
        <v-list-item prepend-icon="mdi-delete" :title="deleteLabel" base-color="red" @click="emit('delete-row')" />
      </v-list>
    </v-menu>
  </div>
</template>
