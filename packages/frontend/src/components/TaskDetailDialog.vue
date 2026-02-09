<script setup lang="ts">
import { useConfirm } from '@/modules/useConfirm'
import { useProjectStore } from '@/stores/useProjectStore'
import type { ColorPalette } from '@functions/types/shared'
import { isEqual } from 'lodash'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import ColorPaletteSelect from './common/ColorPaletteSelect.vue'

interface TaskData {
  id: string
  rowId: string
  name: string
  start: string
  end: string
  colorPalette?: ColorPalette
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
const confirm = useConfirm()

watch(
  () => props.task,
  (newVal) => {
    localTask.value = { ...newVal }
  },
  { deep: true },
)

const hasChanges = computed(() => {
  return !isEqual(props.task, localTask.value)
})

const close = async () => {
  if (hasChanges.value) {
    const result = await confirm({
      title: '確認',
      message: '入力内容が変更されています。破棄してダイアログを閉じますか？',
      confirmText: '破棄して閉じる',
      confirmColor: 'warning',
    })
    if (!result) {
      return
    }
  }
  emit('update:modelValue', false)
}

const handleBeforeClose = (value: boolean) => {
  if (!value) {
    close()
  }
}

const save = () => {
  emit('save', localTask.value)
}

const handleDelete = async () => {
  const result = await confirm({
    title: '削除確認',
    message: `「${localTask.value.name}」を本当に削除しますか？`,
    confirmText: '削除',
    confirmColor: 'error',
  })
  if (result) {
    emit('delete', localTask.value.id)
  }
}

const projectStore = useProjectStore()
const { colorPalettes } = storeToRefs(projectStore)

const onSelectPalette = (palette: ColorPalette) => {
  localTask.value.colorPalette = {
    ...palette,
    pattern: palette.pattern ? { ...palette.pattern } : undefined,
  }
}
</script>

<template>
  <v-dialog :model-value="modelValue" @update:model-value="handleBeforeClose" max-width="600px">
    <v-card>
      <v-card-title>タスク編集</v-card-title>
      <v-card-text>
        <v-container>
          <v-row>
            <v-col cols="12">
              <v-text-field v-model="localTask.name" label="タスク名" autocomplete="off"></v-text-field>
            </v-col>
            <v-col cols="12">
              <v-select
                v-model="localTask.rowId"
                :items="rows"
                item-title="name"
                item-value="id"
                label="行"
                autocomplete="off"
              ></v-select>
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="localTask.start" label="開始日" type="date"></v-text-field>
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="localTask.end" label="終了日" type="date"></v-text-field>
            </v-col>
            <v-col cols="12">
              <div class="d-flex align-center mb-2">
                <span class="text-subtitle-1 mr-2">色設定</span>
                <ColorPaletteSelect :palettes="colorPalettes" :text-sample="localTask.name" @select="onSelectPalette" />
              </div>
              <ColorPaletteInput
                v-if="localTask.colorPalette"
                v-model="localTask.colorPalette"
                @delete="localTask.colorPalette = undefined"
              />
            </v-col>
          </v-row>
        </v-container>
      </v-card-text>
      <v-card-actions>
        <v-btn v-if="localTask.id !== '0'" color="error" variant="text" @click="handleDelete"> 削除 </v-btn>
        <v-spacer></v-spacer>
        <v-btn color="blue-darken-1" variant="text" @click="close"> キャンセル </v-btn>
        <v-btn color="blue-darken-1" variant="text" @click="save"> 保存 </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
