<script setup lang="ts">
import { ref, watch } from 'vue'
import { useConfirm } from '@/modules/useConfirm'

interface RowData {
  id: string | number
  name: string
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
const confirm = useConfirm()

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

const confirmDelete = async () => {
  if (!selectedRowId.value) {
    return
  }

  const selectedRow = props.rows.find((r) => String(r.id) === selectedRowId.value)
  const rowName = selectedRow ? selectedRow.name : ''

  const result = await confirm({
    title: '行の削除',
    message: `行「${rowName}」を本当に削除しますか？この行に含まれるすべてのタスクも削除されます。`,
    confirmText: '削除',
    confirmColor: 'error',
  })

  if (result) {
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
          item-title="name"
          item-value="id"
          label="削除する行を選択"
          :disabled="rows.length === 0"
        ></v-select>
        <div v-if="rows.length === 0" class="text-caption">
          削除できる行がありません。
        </div>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="blue-darken-1" variant="text" @click="close">
          キャンセル
        </v-btn>
        <v-btn
          color="error"
          variant="text"
          :disabled="!selectedRowId"
          @click="confirmDelete"
        >
          削除
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
