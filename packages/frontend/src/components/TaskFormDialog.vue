<script setup lang="ts">
import { useProjectStore } from '@/stores/useProjectStore'
import type { ColorPalette, Label } from '@functions/types/shared'
import { storeToRefs } from 'pinia'

const props = defineProps<{
  modelValue: boolean
  title: string
  name: string
  colorPalette?: ColorPalette
  labels?: Label[]
  description?: string
  saveDisabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'update:name', value: string): void
  (e: 'update:colorPalette', value: ColorPalette | undefined): void
  (e: 'update:labels', value: Label[]): void
  (e: 'update:description', value: string): void
  (e: 'save'): void
  (e: 'close'): void
}>()

const projectStore = useProjectStore()
const { colorPalettes, labels: storeLabels } = storeToRefs(projectStore)

const onSelectPalette = (palette: ColorPalette) => {
  emit('update:colorPalette', {
    ...palette,
    pattern: palette.pattern ? { ...palette.pattern } : undefined,
  })
}

const handleBeforeClose = (value: boolean) => {
  if (!value) {
    emit('close')
  }
}
</script>

<template>
  <v-dialog :model-value="modelValue" @update:model-value="handleBeforeClose" max-width="600px">
    <v-card>
      <v-card-title class="pa-8 pb-0">{{ title }}</v-card-title>
      <v-card-text class="pa-8">
        <v-row dense>
          <v-col cols="12">
            <v-text-field
              :model-value="name"
              @update:model-value="emit('update:name', $event)"
              label="タスク名"
              density="compact"
              variant="outlined"
              hide-details
              autocomplete="off"
              class="mb-3"
            ></v-text-field>
          </v-col>
          <slot name="extra-fields"></slot>
          <v-col cols="12" class="mb-3">
            <div class="d-flex align-center mb-1">
              <span class="text-caption font-weight-bold mr-2">色設定</span>
              <ColorPaletteSelect :palettes="colorPalettes" :text-sample="name" @select="onSelectPalette" />
            </div>
            <ColorPaletteInput
              v-if="colorPalette"
              :model-value="colorPalette"
              @update:model-value="emit('update:colorPalette', $event)"
              @delete="emit('update:colorPalette', undefined)"
            />
          </v-col>
          <v-col cols="12" class="mb-3">
            <LabelSelect
              :model-value="labels || []"
              @update:model-value="emit('update:labels', $event)"
              :items="storeLabels"
            />
          </v-col>
          <v-col cols="12">
            <v-textarea
              :model-value="description || ''"
              @update:model-value="emit('update:description', $event)"
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
        <v-btn color="grey-darken-1" variant="text" @click="emit('close')"> キャンセル </v-btn>
        <v-btn color="primary" variant="flat" @click="emit('save')" :disabled="saveDisabled" class="ml-2"> 保存 </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
