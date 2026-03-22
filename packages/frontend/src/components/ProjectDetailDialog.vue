<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Project, ColorPalette, Label } from '@functions/types/shared'
import inputRules from '@/modules/inputRules'
import { useProjectDetailDialog } from './composables/useProjectDetailDialog'

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
  localHistoryIntervalMinutes,
  localHistoryRetentionDays,
  allUsers,
  title,
  close,
  handleBeforeClose,
  save,
} = useProjectDetailDialog(props, emit)

const historyIntervalOptions = [
  { title: 'なし', value: 0 },
  { title: '5分', value: 5 },
  { title: '15分', value: 15 },
  { title: '30分', value: 30 },
  { title: '1時間', value: 60 },
  { title: '3時間', value: 180 },
  { title: '6時間', value: 360 },
  { title: '12時間', value: 720 },
  { title: '24時間', value: 1440 },
]

const historyRetentionOptions = [
  { title: 'なし（無期限）', value: 0 },
  { title: '7日', value: 7 },
  { title: '14日', value: 14 },
  { title: '30日', value: 30 },
  { title: '60日', value: 60 },
  { title: '90日', value: 90 },
]

const tab = ref<'general' | 'permissions' | 'colorPalettes' | 'labels'>('general')
const expandedPaletteIndex = ref<number | null>(null)

watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue) {
      tab.value = 'general'
      expandedPaletteIndex.value = null
    }
  },
)
</script>

<template>
  <v-dialog :model-value="modelValue" @update:model-value="handleBeforeClose" max-width="800px">
    <v-card>
      <v-card-title class="pa-8 pb-0">{{ title }}</v-card-title>
      <v-card-text class="pa-8">
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
              <v-window v-model="tab" style="min-height: 500px">
                <v-window-item value="general">
                  <v-row density="compact" class="pt-2">
                    <v-col cols="12">
                      <v-text-field
                        v-model="localName"
                        label="プロジェクト名"
                        :rules="[inputRules.required, inputRules.within(191)]"
                        autofocus
                        density="compact"
                        variant="outlined"
                        hide-details="auto"
                        autocomplete="off"
                        class="mb-3"
                      />
                    </v-col>
                    <v-col cols="12">
                      <v-textarea
                        v-model="localDescription"
                        label="説明"
                        auto-grow
                        density="compact"
                        variant="outlined"
                        hide-details="auto"
                        :rules="[inputRules.within(1024)]"
                        class="mb-3"
                      />
                    </v-col>
                    <v-col cols="6">
                      <v-text-field
                        v-model="localStart"
                        label="開始日"
                        type="date"
                        density="compact"
                        variant="outlined"
                        hide-details
                        :rules="[inputRules.required, inputRules.dateBefore(localEnd)]"
                        class="mb-3"
                      />
                    </v-col>
                    <v-col cols="6">
                      <v-text-field
                        v-model="localEnd"
                        label="終了日"
                        type="date"
                        density="compact"
                        variant="outlined"
                        hide-details
                        :rules="[inputRules.required, inputRules.dateAfter(localStart)]"
                        class="mb-3"
                      />
                    </v-col>
                    <v-col cols="12">
                      <v-checkbox v-model="localPublic" density="compact">
                        <template v-slot:label>
                          一般公開
                          <HelpText text="ONにすると全てのユーザーが参照できるようになります" />
                        </template>
                      </v-checkbox>
                    </v-col>
                    <v-col cols="12">
                      <v-select
                        v-model="localHistoryIntervalMinutes"
                        :items="historyIntervalOptions"
                        label="変更履歴の自動保存"
                        density="compact"
                        variant="outlined"
                        hide-details="auto"
                        class="mb-3"
                      >
                        <template v-slot:append>
                          <HelpText
                            text="設定した間隔が経過した後にガントチャートを変更すると、変更前の状態を自動的にスナップショットとして保存します"
                          />
                        </template>
                      </v-select>
                    </v-col>
                    <v-col cols="12">
                      <v-select
                        v-model="localHistoryRetentionDays"
                        :items="historyRetentionOptions"
                        label="自動履歴の保持期間"
                        density="compact"
                        variant="outlined"
                        hide-details="auto"
                        :disabled="!localHistoryIntervalMinutes"
                        class="mb-3"
                      >
                        <template v-slot:append>
                          <HelpText
                            text="自動保存されたスナップショットを指定した日数後に自動削除します。なし（無期限）の場合は削除されません"
                          />
                        </template>
                      </v-select>
                    </v-col>
                  </v-row>
                </v-window-item>
                <v-window-item value="permissions">
                  <v-row density="compact" class="pt-2">
                    <UsersInput
                      v-model="localOwners"
                      label="オーナー"
                      help-text="プロジェクトに対する全権限を持つユーザーのリスト"
                      :users="allUsers"
                      :rules="[inputRules.required]"
                    />
                    <UsersInput
                      v-model="localEditors"
                      label="編集者"
                      help-text="閲覧・編集権限を持つユーザーのリスト"
                      :users="allUsers"
                    />
                    <UsersInput
                      v-model="localViewers"
                      label="閲覧者"
                      help-text="閲覧権限のみを持つユーザーのリスト"
                      :users="allUsers"
                    />
                  </v-row>
                </v-window-item>
                <v-window-item value="colorPalettes">
                  <v-row density="compact">
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
                  </v-row>
                  <div style="max-height: 460px; overflow-y: auto; overflow-x: hidden" class="pr-2">
                    <v-row density="compact">
                      <v-col v-for="(palette, i) in localColorPalettes" :key="i" cols="12">
                        <ColorPaletteInput
                          :model-value="palette"
                          :expanded="expandedPaletteIndex === i"
                          @update:expanded="(val: boolean) => (expandedPaletteIndex = val ? i : null)"
                          @update:model-value="(val: ColorPalette) => (localColorPalettes[i] = val)"
                          @delete="
                            () => {
                              localColorPalettes.splice(i, 1)
                              if (expandedPaletteIndex === i) expandedPaletteIndex = null
                            }
                          "
                        />
                      </v-col>
                    </v-row>
                  </div>
                </v-window-item>
                <v-window-item value="labels">
                  <v-row density="compact">
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
                  </v-row>
                  <div style="max-height: 460px; overflow-y: auto; overflow-x: hidden" class="pr-2">
                    <v-row density="compact">
                      <v-col v-for="(label, i) in localLabels" :key="i" cols="12">
                        <LabelInput
                          :model-value="label"
                          @update:model-value="(val: Label) => (localLabels[i] = val)"
                          @delete="localLabels.splice(i, 1)"
                        />
                      </v-col>
                    </v-row>
                  </div>
                </v-window-item>
              </v-window>
            </v-col>
          </v-row>
        </v-form>
      </v-card-text>
      <v-card-actions class="pa-8 pt-0">
        <v-spacer></v-spacer>
        <v-btn color="grey-darken-1" variant="text" @click="close"> キャンセル </v-btn>
        <v-btn color="primary" variant="flat" @click="save" class="ml-2"> OK </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
