<script setup lang="ts">
import { ref, watch } from 'vue'

interface TaskData {
  id: string
  rowId: string
  name: string
  start: string
  end: string
}

const props = defineProps<{
  modelValue: boolean
  task: TaskData
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', task: TaskData): void
}>()

const localTask = ref<TaskData>({ ...props.task })

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
        <v-spacer></v-spacer>
        <v-btn color="blue-darken-1" variant="text" @click="close">
          キャンセル
        </v-btn>
        <v-btn color="blue-darken-1" variant="text" @click="save"> 保存 </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
