<script setup lang="ts">
import { useDiscardConfirm } from '@/modules/useConfirm'
import { useProjectStore } from '@/stores/useProjectStore'
import type { ColorPalette, Label, NewTaskTemplate } from '@functions/types/shared'
import { isEqual } from 'lodash'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import ColorPaletteSelect from './common/ColorPaletteSelect.vue'

const props = defineProps<{
  modelValue: boolean
  template: NewTaskTemplate
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', template: NewTaskTemplate): void
}>()

const localTemplate = ref<NewTaskTemplate>({ ...props.template })
const { confirmAndClose } = useDiscardConfirm()

watch(
  () => props.template,
  (newVal) => {
    // ディープコピーで初期化
    localTemplate.value = JSON.parse(JSON.stringify(newVal))
  },
  { deep: true },
)

const hasChanges = computed(() => {
  return !isEqual(props.template, localTemplate.value)
})

const closeDialog = () => emit('update:modelValue', false)

const close = () => confirmAndClose(hasChanges, closeDialog)

const handleBeforeClose = (value: boolean) => {
  if (!value) {
    close()
  }
}

const save = () => {
  emit('save', localTemplate.value)
}

const projectStore = useProjectStore()
const { colorPalettes, labels } = storeToRefs(projectStore)

const onSelectPalette = (palette: ColorPalette) => {
  // attributeが存在しない場合の初期化
  if (!localTemplate.value.attribute) {
    localTemplate.value.attribute = {}
  }

  localTemplate.value.attribute.colorPalette = {
    ...palette,
    pattern: palette.pattern ? { ...palette.pattern } : undefined,
  }
}

// v-modelバインディング用のcomputed properties
// ネストされたオブジェクトへのアクセスを安全に行うため

const colorPalette = computed({
  get: () => localTemplate.value.attribute?.colorPalette,
  set: (val) => {
    if (!localTemplate.value.attribute) localTemplate.value.attribute = {}
    localTemplate.value.attribute.colorPalette = val
  },
})

const templateLabels = computed({
  get: () => localTemplate.value.attribute?.labels || [],
  set: (val: Label[]) => {
    if (!localTemplate.value.attribute) localTemplate.value.attribute = {}
    localTemplate.value.attribute.labels = val
  },
})

const description = computed({
  get: () => localTemplate.value.attribute?.description || '',
  set: (val: string) => {
    if (!localTemplate.value.attribute) localTemplate.value.attribute = {}
    localTemplate.value.attribute.description = val
  },
})
</script>

<template>
  <v-dialog :model-value="modelValue" @update:model-value="handleBeforeClose" max-width="500px">
    <v-card>
      <v-card-title class="pa-8 pb-0">テンプレート編集</v-card-title>
      <v-card-text class="pa-8">
        <v-row dense>
          <v-col cols="12">
            <v-text-field
              v-model="localTemplate.name"
              label="タスク名"
              density="compact"
              variant="outlined"
              hide-details
              autocomplete="off"
              class="mb-3"
            ></v-text-field>
          </v-col>
          <v-col cols="12">
            <v-text-field
              v-model.number="localTemplate.duration"
              label="期間（日）"
              type="number"
              min="1"
              density="compact"
              variant="outlined"
              hide-details
              class="mb-3"
            ></v-text-field>
          </v-col>
          <v-col cols="12" class="mb-3">
            <div class="d-flex align-center mb-1">
              <span class="text-caption font-weight-bold mr-2">色設定</span>
              <ColorPaletteSelect
                :palettes="colorPalettes"
                :text-sample="localTemplate.name"
                @select="onSelectPalette"
              />
            </div>
            <ColorPaletteInput v-if="colorPalette" v-model="colorPalette" @delete="colorPalette = undefined" />
          </v-col>
          <v-col cols="12" class="mb-3">
            <LabelSelect v-model="templateLabels" :items="labels" />
          </v-col>
          <v-col cols="12">
            <v-textarea
              v-model="description"
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
        <v-btn
          color="primary"
          variant="flat"
          @click="save"
          :disabled="!localTemplate.duration || localTemplate.duration < 1"
          class="ml-2"
        >
          保存
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
