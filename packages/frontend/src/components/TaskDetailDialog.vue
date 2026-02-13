<script setup lang="ts">
import { useConfirm, useDiscardConfirm } from '@/modules/useConfirm'
import { useProjectStore } from '@/stores/useProjectStore'
import type { ColorPalette, Label } from '@functions/types/shared'
import { getContrastColor } from '@/modules/utils'
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
  description?: string
  colorPalette?: ColorPalette
  labels?: Label[]
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
            <v-col cols="12">
              <v-autocomplete
                v-model="localTask.labels"
                :items="labels"
                item-title="name"
                return-object
                label="ラベル"
                multiple
                chips
                closable-chips
                autocomplete="off"
              >
                <template #chip="{ props, item }">
                  <v-chip
                    v-bind="props"
                    :color="item.raw.color"
                    variant="flat"
                    label
                    size="small"
                    class="font-weight-bold"
                    :style="{ color: getContrastColor(item.raw.color) }"
                  >
                    {{ item.raw.name }}
                  </v-chip>
                </template>
                <template #item="{ props, item }">
                  <v-list-item v-bind="props" title="">
                    <template #prepend>
                      <v-chip
                        :color="item.raw.color"
                        variant="flat"
                        label
                        size="small"
                        class="mr-2 font-weight-bold"
                        :style="{ color: getContrastColor(item.raw.color) }"
                      >
                        {{ item.raw.name }}
                      </v-chip>
                    </template>
                    <v-list-item-title>
                      {{ item.raw.name }}
                    </v-list-item-title>
                  </v-list-item>
                </template>
              </v-autocomplete>
            </v-col>
            <v-col cols="12">
              <v-textarea
                v-model="localTask.description"
                label="説明"
                rows="3"
                auto-grow
                autocomplete="off"
              ></v-textarea>
            </v-col>
          </v-row>
        </v-container>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="blue-darken-1" variant="text" @click="close"> キャンセル </v-btn>
        <v-btn color="blue-darken-1" variant="text" @click="save"> 保存 </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
