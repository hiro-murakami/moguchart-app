<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Project, ColorPalette, Label } from '@functions/types/shared'
import inputRules from '@/modules/inputRules'
import { useProjectDetailDialog } from '../modules/useProjectDetailDialog'

const props = defineProps<{
  modelValue: boolean
  project?: Project | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', project: Partial<Project>): void
}>()

const {
  form,
  formValid,
  localName,
  localDescription,
  localStart,
  localEnd,
  localPublic,
  localOwners,
  localEditors,
  localViewers,
  localColorPalettes,
  localLabels,
  title,
  close,
  handleBeforeClose,
  save,
} = useProjectDetailDialog(props, emit)

const tab = ref<'general' | 'permissions' | 'colorPalettes' | 'labels'>('general')

watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue) {
      tab.value = 'general'
    }
  },
)
</script>

<template>
  <v-dialog :model-value="modelValue" @update:model-value="handleBeforeClose" max-width="900px">
    <v-card>
      <v-card-title>{{ title }}</v-card-title>
      <v-card-text>
        <v-form ref="form" v-model="formValid">
          <v-row>
            <v-col cols="3">
              <v-tabs v-model="tab" direction="vertical" color="primary">
                <v-tab value="general">
                  <v-icon start> mdi-account </v-icon>
                  一般
                </v-tab>
                <v-tab value="permissions">
                  <v-icon start> mdi-lock </v-icon>
                  権限
                </v-tab>
                <v-tab value="colorPalettes">
                  <v-icon start> mdi-palette </v-icon>
                  カラーパレット
                </v-tab>
                <v-tab value="labels">
                  <v-icon start> mdi-label </v-icon>
                  ラベル
                </v-tab>
              </v-tabs>
            </v-col>
            <v-col cols="9">
              <v-window v-model="tab" style="min-height: 450px">
                <v-window-item value="general">
                  <v-row dense>
                    <v-col cols="12">
                      <v-text-field
                        v-model="localName"
                        label="プロジェクト名"
                        :rules="[inputRules.required, inputRules.within(191)]"
                        autofocus
                        autocomplete="off"
                      />
                    </v-col>
                    <v-col cols="12">
                      <v-textarea v-model="localDescription" label="説明" auto-grow />
                    </v-col>
                    <v-col cols="6">
                      <v-text-field
                        v-model="localStart"
                        label="開始日"
                        type="date"
                        :rules="[inputRules.required, inputRules.dateBefore(localEnd)]"
                      />
                    </v-col>
                    <v-col cols="6">
                      <v-text-field
                        v-model="localEnd"
                        label="終了日"
                        type="date"
                        :rules="[inputRules.required, inputRules.dateAfter(localStart)]"
                      />
                    </v-col>
                    <v-col cols="12">
                      <v-checkbox v-model="localPublic" label="一般公開" />
                    </v-col>
                  </v-row>
                </v-window-item>
                <v-window-item value="permissions">
                  <v-col cols="12">
                    <v-combobox
                      v-model="localOwners"
                      label="オーナー"
                      multiple
                      chips
                      deletable-chips
                      closable-chips
                      :rules="[inputRules.areMailAddresses]"
                      autocomplete="off"
                    />
                  </v-col>
                  <v-col cols="12">
                    <v-combobox
                      v-model="localEditors"
                      label="編集者"
                      multiple
                      chips
                      deletable-chips
                      closable-chips
                      :rules="[inputRules.areMailAddresses]"
                      autocomplete="off"
                    />
                  </v-col>
                  <v-col cols="12">
                    <v-combobox
                      v-model="localViewers"
                      label="閲覧者"
                      multiple
                      chips
                      deletable-chips
                      closable-chips
                      :rules="[inputRules.areMailAddresses]"
                      autocomplete="off"
                    />
                  </v-col>
                </v-window-item>
                <v-window-item value="colorPalettes">
                  <v-row dense>
                    <v-col cols="12">
                      <v-btn
                        variant="text"
                        prepend-icon="mdi-plus"
                        color="primary"
                        @click="localColorPalettes.push({ color: '#000000', backgroundColor: '#ffffff' })"
                      >
                        パレット追加
                      </v-btn>
                    </v-col>
                    <v-col v-for="(palette, i) in localColorPalettes" :key="i" cols="12">
                      <ColorPaletteInput
                        :model-value="palette"
                        @update:model-value="(val: ColorPalette) => (localColorPalettes[i] = val)"
                        @delete="localColorPalettes.splice(i, 1)"
                      />
                    </v-col>
                  </v-row>
                </v-window-item>
                <v-window-item value="labels">
                  <v-row dense>
                    <v-col cols="12">
                      <v-btn
                        variant="text"
                        prepend-icon="mdi-plus"
                        color="primary"
                        @click="localLabels.push({ name: 'New Label', color: '#cccccc' })"
                      >
                        ラベル追加
                      </v-btn>
                    </v-col>
                    <v-col v-for="(label, i) in localLabels" :key="i" cols="12">
                      <LabelInput
                        :model-value="label"
                        @update:model-value="(val: Label) => (localLabels[i] = val)"
                        @delete="localLabels.splice(i, 1)"
                      />
                    </v-col>
                  </v-row>
                </v-window-item>
              </v-window>
            </v-col>
          </v-row>
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="blue-darken-1" variant="text" @click="close"> キャンセル </v-btn>
        <v-btn color="blue-darken-1" variant="text" @click="save"> OK </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
