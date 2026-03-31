<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  modelValue: boolean
  x: number
  y: number
  taskId?: string | null
  selectedTaskIds?: string[]
  isReadOnly?: boolean
  disabledDelete?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'edit'): void
  (e: 'comment'): void
  (e: 'delete'): void
  (e: 'copy'): void
}>()

const isMac = computed(() => /Mac|iPhone|iPad|iPod/.test(navigator.userAgent))
const copyShortcut = computed(() => (isMac.value ? '⌘C' : 'Ctrl+C'))

const isVisible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const deleteTitle = computed(() => {
  if (props.taskId && props.selectedTaskIds?.includes(props.taskId) && (props.selectedTaskIds?.length || 0) > 1) {
    return `選択した${props.selectedTaskIds!.length}個を削除`
  }
  return '削除'
})

const copyTitle = computed(() => {
  if (props.taskId && props.selectedTaskIds?.includes(props.taskId) && (props.selectedTaskIds?.length || 0) > 1) {
    return `選択した${props.selectedTaskIds!.length}個をコピー`
  }
  return 'コピー'
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
        <v-list-item v-if="!isReadOnly" prepend-icon="mdi-pencil" title="編集" @click="emit('edit')" />
        <v-list-item prepend-icon="mdi-comment-text-outline" title="コメント" @click="emit('comment')" />
        <v-list-item prepend-icon="mdi-content-copy" @click="emit('copy')">
          <v-list-item-title>
            {{ copyTitle }}
            <span class="text-caption text-medium-emphasis ml-2">{{ copyShortcut }}</span>
          </v-list-item-title>
        </v-list-item>
        <v-divider v-if="!isReadOnly" />
        <v-list-item
          v-if="!isReadOnly"
          prepend-icon="mdi-delete"
          :title="deleteTitle"
          base-color="red"
          :disabled="disabledDelete"
          @click="emit('delete')"
        />
      </v-list>
    </v-menu>
  </div>
</template>

