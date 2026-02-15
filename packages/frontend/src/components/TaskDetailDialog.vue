<script setup lang="ts">
import { useConfirm, useDiscardConfirm } from '@/modules/useConfirm'
import { useProjectStore } from '@/stores/useProjectStore'
import type { ColorPalette, Label, EditingTaskData, SimpleRowData } from '@functions/types/shared'
import { isEqual } from 'lodash'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import ColorPaletteSelect from './common/ColorPaletteSelect.vue'

const props = defineProps<{
  modelValue: boolean
  task: EditingTaskData
  rows: SimpleRowData[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', task: EditingTaskData): void
  (e: 'delete', id: string): void
}>()

const localTask = ref<EditingTaskData>({ ...props.task })
const confirm = useConfirm()
const { confirmAndClose } = useDiscardConfirm()

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

const closeDialog = () => emit('update:modelValue', false)

const close = () => confirmAndClose(hasChanges, closeDialog)

const handleBeforeClose = (value: boolean) => {
  if (!value) {
    close()
  }
}

const save = () => {
  emit('save', localTask.value)
}

const projectStore = useProjectStore()
const { colorPalettes, labels } = storeToRefs(projectStore)

const onSelectPalette = (palette: ColorPalette) => {
  localTask.value.colorPalette = {
    ...palette,
    pattern: palette.pattern ? { ...palette.pattern } : undefined,
  }
}
</script>

<template>
  <v-dialog :model-value="modelValue" @update:model-value="handleBeforeClose" max-width="500px">
    <v-card>
      <v-card-title class="pa-8 pb-0">タスク編集</v-card-title>
      <v-card-text class="pa-8">
        <v-row dense>
          <v-col cols="12">
            <v-text-field
              v-model="localTask.name"
              label="タスク名"
              density="compact"
              variant="outlined"
              hide-details
              autocomplete="off"
              class="mb-3"
            ></v-text-field>
          </v-col>
          <v-col cols="12">
            <v-select
              v-model="localTask.rowId"
              :items="rows"
              item-title="name"
              item-value="id"
              label="行"
              density="compact"
              variant="outlined"
              hide-details
              autocomplete="off"
              class="mb-3"
            ></v-select>
          </v-col>
          <v-col cols="6">
            <v-text-field
              v-model="localTask.start"
              label="開始日"
              type="date"
              density="compact"
              variant="outlined"
              hide-details
              class="mb-3"
            ></v-text-field>
          </v-col>
          <v-col cols="6">
            <v-text-field
              v-model="localTask.end"
              label="終了日"
              type="date"
              density="compact"
              variant="outlined"
              hide-details
              class="mb-3"
            ></v-text-field>
          </v-col>
          <v-col cols="12" class="mb-3">
            <div class="d-flex align-center mb-1">
              <span class="text-caption font-weight-bold mr-2">色設定</span>
              <ColorPaletteSelect :palettes="colorPalettes" :text-sample="localTask.name" @select="onSelectPalette" />
            </div>
            <ColorPaletteInput
              v-if="localTask.colorPalette"
              v-model="localTask.colorPalette"
              @delete="localTask.colorPalette = undefined"
            />
          </v-col>
          <v-col cols="12" class="mb-3">
            <LabelSelect v-model="localTask.labels" :items="labels" />
          </v-col>
          <v-col cols="12">
            <v-textarea
              v-model="localTask.description"
              label="説明"
              rows="3"
              auto-grow
              density="compact"
              variant="outlined"
              hide-details
              autocomplete="off"
            ></v-textarea>
          </v-col>
        </v-row>
      </v-card-text>
      <v-card-actions class="pa-8 pt-0">
        <v-spacer></v-spacer>
        <v-btn color="grey-darken-1" variant="text" @click="close"> キャンセル </v-btn>
        <v-btn color="primary" variant="flat" @click="save" class="ml-2"> 保存 </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
