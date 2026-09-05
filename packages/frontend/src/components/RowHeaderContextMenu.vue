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
  canIndent?: boolean
  canOutdent?: boolean
  isParent?: boolean
  collapsed?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'edit-row'): void
  (e: 'add-row-above'): void
  (e: 'add-row-below'): void
  (e: 'indent'): void
  (e: 'outdent'): void
  (e: 'delete-row'): void
  (e: 'toggle-visibility'): void
  (e: 'toggle-collapse'): void
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

const indentLabel = computed(() => {
  if (isMultiSelected.value) {
    return `選択した${selectedCount.value}行をインデント`
  }
  return 'インデント（子行にする）'
})

const outdentLabel = computed(() => {
  if (isMultiSelected.value) {
    return `選択した${selectedCount.value}行のインデント解除`
  }
  return 'インデント解除'
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
          prepend-icon="mdi-format-indent-increase"
          :title="indentLabel"
          :disabled="!canIndent"
          @click="emit('indent')"
        />
        <v-list-item
          prepend-icon="mdi-format-indent-decrease"
          :title="outdentLabel"
          :disabled="!canOutdent"
          @click="emit('outdent')"
        />
        <v-divider />
        <v-list-item
          :prepend-icon="isHidden ? 'mdi-eye' : 'mdi-eye-off'"
          :title="visibilityLabel"
          @click="emit('toggle-visibility')"
        />
        <v-list-item
          v-if="isParent"
          :prepend-icon="collapsed ? 'mdi-chevron-right' : 'mdi-chevron-down'"
          :title="collapsed ? '配下の行を展開' : '配下の行を折りたたむ'"
          @click="emit('toggle-collapse')"
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
