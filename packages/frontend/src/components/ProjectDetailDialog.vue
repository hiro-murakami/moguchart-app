<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Project } from '@functions/types/shared'
import inputRules from '@/modules/inputRules'
import { useProjectDetailDialog } from '../modules/useProjectDetailDialog'
import { VColorInput } from 'vuetify/labs/VColorInput'
import * as moguchart from '@mogura/moguchart'

const patterns: moguchart.GanttTaskPattern[] = [
  moguchart.PATTERN_DIAGONAL_STRIPE,
  moguchart.PATTERN_DIAGONAL_STRIPE_REVERSE,
  moguchart.PATTERN_VERTICAL_STRIPE,
  moguchart.PATTERN_HORIZONTAL_STRIPE,
  moguchart.PATTERN_CHECKERBOARD,
  moguchart.PATTERN_DOTS,
  moguchart.PATTERN_TRIANGLE,
  moguchart.PATTERN_CIRCLE,
  moguchart.PATTERN_GRID,
  moguchart.PATTERN_DIAGONAL_GRID,
]

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
  title,
  close,
  save,
} = useProjectDetailDialog(props, emit)

const tab = ref<'general' | 'permissions' | 'colorPalettes'>('general')

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
  <v-dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" max-width="900px">
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
                        @click="localColorPalettes.push({ color: '#000000' })"
                      >
                        パレット追加
                      </v-btn>
                    </v-col>
                    <v-col v-for="(palette, i) in localColorPalettes" :key="i" cols="12">
                      <v-card variant="outlined" class="pa-2">
                        <v-row dense align="center">
                          <v-col cols="auto">
                            <v-btn
                              icon="mdi-delete"
                              variant="text"
                              color="error"
                              size="small"
                              @click="localColorPalettes.splice(i, 1)"
                            />
                          </v-col>
                          <v-col>
                            <v-row dense>
                              <v-col cols="12" sm="4">
                                <v-color-input
                                  v-model="palette.color"
                                  label="カラー"
                                  hide-details
                                  density="compact"
                                  mode="hexa"
                                  :modes="['hexa']"
                                  prepend-icon=""
                                  color-pip
                                  show-swatches
                                />
                              </v-col>
                              <v-col cols="12" sm="8" v-if="!palette.pattern">
                                <v-btn
                                  variant="text"
                                  size="small"
                                  @click="palette.pattern = { type: 'dots', color: '#ffffff' }"
                                >
                                  パターン追加
                                </v-btn>
                              </v-col>
                              <template v-else>
                                <v-col cols="12" sm="3">
                                  <v-select
                                    v-model="palette.pattern.type"
                                    :items="patterns"
                                    item-title="type"
                                    item-value="type"
                                    label="タイプ"
                                    hide-details
                                    density="compact"
                                  >
                                    <template #selection="{ item }">
                                      <div class="d-flex align-center">
                                        <div
                                          :style="`width: 80px; height: 16px; border: 1px solid #ccc; flex-shrink: 0; background-repeat: repeat; background-color: ${palette.color || '#ffffff'}; ${moguchart.getPatternStyle({ type: item.raw.type, color: palette.pattern.color || '#000000' })}`"
                                        ></div>
                                      </div>
                                    </template>
                                    <template #item="{ props, item }">
                                      <v-list-item v-bind="props" title="">
                                        <template #prepend>
                                          <div
                                            class="mr-2"
                                            :style="`width: 40px; height: 16px; border: 1px solid #ccc; flex-shrink: 0; background-repeat: repeat; background-color: ${palette.color || '#ffffff'}; ${moguchart.getPatternStyle({ type: item.raw.type, color: palette.pattern.color || '#000000' })}`"
                                          ></div>
                                        </template>
                                      </v-list-item>
                                    </template>
                                  </v-select>
                                </v-col>
                                <v-col cols="12" sm="4">
                                  <v-color-input
                                    v-model="palette.pattern.color"
                                    label="パターンカラー"
                                    hide-details
                                    density="compact"
                                    mode="hexa"
                                    :modes="['hexa']"
                                    prepend-icon=""
                                    color-pip
                                    show-swatches
                                  />
                                </v-col>
                                <v-col cols="auto">
                                  <v-btn
                                    icon="mdi-close"
                                    variant="text"
                                    size="medium"
                                    density="compact"
                                    @click="palette.pattern = undefined"
                                  />
                                </v-col>
                              </template>
                            </v-row>
                          </v-col>
                        </v-row>
                      </v-card>
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
