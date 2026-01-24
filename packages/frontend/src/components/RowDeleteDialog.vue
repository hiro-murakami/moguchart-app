<script setup lang="ts">
import { ref, watch } from 'vue'

interface RowData {
  id: string | number
  label: string
}

const props = defineProps<{
  modelValue: boolean
  rows: RowData[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'delete', rowId: string): void
}>()

const selectedRowId = ref<string | null>(null)

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      selectedRowId.value = null
    }
  },
)

const close = () => {
  emit('update:modelValue', false)
}

const confirmDelete = () => {
  if (selectedRowId.value) {
    emit('delete', String(selectedRowId.value))
  }
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    max-width="400px"
  >
    <v-card>
      <v-card-title>行削除</v-card-title>
      <v-card-text>
        <v-select
          v-model="selectedRowId"
          :items="rows"
          item-title="label"
          item-value="id"
          label="削除する行を選択"
        ></v-select>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="blue-darken-1" variant="text" @click="close">
          キャンセル
        </v-btn>
        <v-btn color="error" variant="text" @click="confirmDelete">
          削除
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
