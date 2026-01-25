<script setup lang="ts">
import { ref, watch } from 'vue'

interface TaskData {
  id: string
  rowId: string
  name: string
  start: string
  end: string
}

interface RowData {
  id: string
  name: string
}

const props = defineProps<{
  modelValue: boolean
  task: TaskData
  rows: RowData[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', task: TaskData): void
  (e: 'delete', id: string): void
}>()

const localTask = ref<TaskData>({ ...props.task })
const showDeleteConfirm = ref(false)

watch(
  () => props.task,
  (newVal) => {
    localTask.value = { ...newVal }
  },
  { deep: true },
)

const close = () => {
  emit('update:modelValue', false)
}

const save = () => {
  emit('save', localTask.value)
}

const handleDelete = () => {
  showDeleteConfirm.value = true
}

const executeDelete = () => {
  showDeleteConfirm.value = false
  emit('delete', localTask.value.id)
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    max-width="500px"
  >
    <v-card>
      <v-card-title>タスク編集</v-card-title>
      <v-card-text>
        <v-container>
          <v-row>
            <v-col cols="12">
              <v-text-field
                v-model="localTask.name"
                label="タスク名"
              ></v-text-field>
            </v-col>
            <v-col cols="12">
              <v-select
                v-model="localTask.rowId"
                :items="rows"
                item-title="name"
                item-value="id"
                label="行"
              ></v-select>
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="localTask.start"
                label="開始日"
                type="date"
              ></v-text-field>
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="localTask.end"
                label="終了日"
                type="date"
              ></v-text-field>
            </v-col>
          </v-row>
        </v-container>
      </v-card-text>
      <v-card-actions>
        <v-btn
          v-if="localTask.id !== '0'"
          color="error"
          variant="text"
          @click="handleDelete"
        >
          削除
        </v-btn>
        <v-spacer></v-spacer>
        <v-btn color="blue-darken-1" variant="text" @click="close">
          キャンセル
        </v-btn>
        <v-btn color="blue-darken-1" variant="text" @click="save"> 保存 </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog v-model="showDeleteConfirm" max-width="300">
    <v-card>
      <v-card-title>削除確認</v-card-title>
      <v-card-text>本当に削除しますか？</v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="grey" variant="text" @click="showDeleteConfirm = false">
          キャンセル
        </v-btn>
        <v-btn color="error" variant="text" @click="executeDelete">
          削除
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
