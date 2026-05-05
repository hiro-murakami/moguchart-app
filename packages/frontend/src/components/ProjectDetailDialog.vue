<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { Project, ColorPalette, Label, Milestone } from '@functions/types/shared'
import inputRules from '@/modules/inputRules'
import { granularityToInputType } from '@/modules/utils'
import { useProjectDetailDialog } from './composables/useProjectDetailDialog'

const props = defineProps<{
  modelValue: boolean
  project?: Project | null
  saving?: boolean
}>()

const showAuthorityHistoryDialog = ref(false)

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
  localMilestones,
  localHistoryIntervalMinutes,
  localHistoryRetentionDays,
  localGranularity,
  localSnapDurationMinutes,
  authorityHistoryUsers,
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

const tab = ref<'general' | 'permissions' | 'colorPalettes' | 'labels' | 'milestones'>('general')
const expandedPaletteIndex = ref<number | null>(null)

const dateInputType = computed(() => granularityToInputType(localGranularity.value))

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
  <v-dialog :model-value="modelValue" @update:model-value="handleBeforeClose" max-width="850px">
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
                <v-tab value="milestones">
                  <v-icon start> mdi-flag </v-icon>
                  マイルストーン
                </v-tab>
              </v-tabs>
            </v-col>
            <v-col cols="9">
              <v-window v-model="tab" style="min-height: 500px">
                <v-window-item value="general">
                  <v-row density="compact" class="pt-2">
                    <!-- モード（作成時のみ変更可） -->
                    <v-col cols="12" class="mb-4 d-flex">
                      <template v-if="!props.project">
                        <div class="text-caption text-medium-emphasis mr-4 d-flex align-center">
                          モード
                          <HelpText text="作成後は変更できません" class="ml-1" />
                        </div>
                        <v-btn-toggle
                          v-model="localGranularity"
                          mandatory
                          density="compact"
                          variant="outlined"
                          color="primary"
                          rounded="lg"
                        >
                          <v-btn value="hourly" prepend-icon="mdi-clock-outline"> 時間単位 </v-btn>
                          <v-btn value="daily" prepend-icon="mdi-calendar-today"> 日単位 </v-btn>
                          <v-btn value="monthly" prepend-icon="mdi-calendar-month"> 月単位 </v-btn>
                        </v-btn-toggle>
                      </template>
                      <template v-else>
                        <div class="text-caption text-medium-emphasis mr-4 d-flex align-center">
                          モード
                          <HelpText text="作成時に決定されたため変更できません" class="ml-1" />
                        </div>
                        <v-chip
                          :prepend-icon="
                            localGranularity === 'monthly'
                              ? 'mdi-calendar-month'
                              : localGranularity === 'hourly'
                                ? 'mdi-clock-outline'
                                : 'mdi-calendar-today'
                          "
                          variant="tonal"
                        >
                          {{
                            localGranularity === 'monthly'
                              ? '月単位'
                              : localGranularity === 'hourly'
                                ? '時間単位'
                                : '日単位'
                          }}
                        </v-chip>
                      </template>
                    </v-col>
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
                      <DateInput
                        v-model="localStart"
                        :type="dateInputType"
                        label-daily="開始日"
                        label-monthly="開始月"
                        label-datetime="開始日時"
                        :compare-target="localEnd"
                        compare-rule="before"
                        hide-details
                        class="mb-3"
                      />
                    </v-col>
                    <v-col cols="6">
                      <DateInput
                        v-model="localEnd"
                        :type="dateInputType"
                        label-daily="終了日"
                        label-monthly="終了月"
                        label-datetime="終了日時"
                        :compare-target="localStart"
                        compare-rule="after"
                        hide-details
                        class="mb-3"
                      />
                    </v-col>
                    <!-- hourly モード時のスナップ単位設定 -->
                    <v-col v-if="localGranularity === 'hourly'" cols="12" class="mb-4">
                      <div class="text-caption text-medium-emphasis mt-1 d-flex align-center">
                        スナップ単位
                        <HelpText text="タスクの移動・リサイズ時にスナップする時間単位です" class="ml-1" />
                      </div>
                      <v-btn-toggle
                        v-model="localSnapDurationMinutes"
                        mandatory
                        density="compact"
                        variant="outlined"
                        color="primary"
                        class="w-70"
                      >
                        <v-btn :value="60" class="flex-grow-1">60分</v-btn>
                        <v-btn :value="30" class="flex-grow-1">30分</v-btn>
                        <v-btn :value="15" class="flex-grow-1">15分</v-btn>
                        <v-btn :value="12" class="flex-grow-1">12分</v-btn>
                        <v-btn :value="6" class="flex-grow-1">6分</v-btn>
                        <v-btn :value="5" class="flex-grow-1">5分</v-btn>
                      </v-btn-toggle>
                    </v-col>
                    <v-col cols="12" class="mb-4">
                      <v-checkbox v-model="localPublic" density="compact" hide-details>
                        <template v-slot:label>
                          一般公開
                          <HelpText text="ONにすると全てのユーザーが参照できるようになります" />
                        </template>
                      </v-checkbox>
                    </v-col>
                    <v-col cols="6">
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
                    <v-spacer />
                    <v-col cols="6">
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
                      :users="authorityHistoryUsers"
                      :rules="[inputRules.required]"
                    />
                    <UsersInput
                      v-model="localEditors"
                      label="編集者"
                      help-text="閲覧・編集権限を持つユーザーのリスト"
                      :users="authorityHistoryUsers"
                    />
                    <UsersInput
                      v-model="localViewers"
                      label="閲覧者"
                      help-text="閲覧権限のみを持つユーザーのリスト"
                      :users="authorityHistoryUsers"
                    />
                    <v-col cols="12">
                      <v-btn
                        variant="text"
                        prepend-icon="mdi-history"
                        color="primary"
                        size="small"
                        @click="showAuthorityHistoryDialog = true"
                      >
                        メールアドレス履歴を管理
                      </v-btn>
                    </v-col>
                  </v-row>
                  <AuthorityHistoryDialog v-model="showAuthorityHistoryDialog" />
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
                <v-window-item value="milestones">
                  <v-row density="compact">
                    <v-col cols="12">
                      <v-btn
                        variant="text"
                        prepend-icon="mdi-plus"
                        color="primary"
                        @click="localMilestones.push({ name: '', datetime: '', color: '#FF0000' })"
                      >
                        マイルストーン追加
                      </v-btn>
                    </v-col>
                  </v-row>
                  <div style="max-height: 460px; overflow-y: auto; overflow-x: hidden" class="pr-2">
                    <v-row density="compact">
                      <v-col v-for="(milestone, i) in localMilestones" :key="i" cols="12">
                        <MilestoneInput
                          :model-value="milestone"
                          @update:model-value="(val: Milestone) => (localMilestones[i] = val)"
                          @delete="localMilestones.splice(i, 1)"
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
        <v-btn color="grey-darken-1" variant="text" :disabled="props.saving" @click="close"> キャンセル </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :loading="props.saving"
          :disabled="props.saving"
          @click="save"
          class="ml-2"
        >
          OK
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
