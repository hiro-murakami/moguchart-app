<script setup lang="ts">
import { ref, watch, computed, nextTick } from 'vue'
import type { Project, ColorPalette, Label, Milestone, ProjectGranularity } from '@functions/types/shared'
import inputRules from '@/modules/inputRules'
import { granularityToInputType } from '@/modules/utils'
import { useProjectDetailDialog } from './composables/useProjectDetailDialog'
import dayjs from 'dayjs'

const props = defineProps<{
  modelValue: boolean
  project?: Project | null
  saving?: boolean
  initialGranularity?: ProjectGranularity
  isDuplicate?: boolean
}>()

const showAuthorityHistoryDialog = ref(false)

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', project: Partial<Project>, options?: { clearProgress?: boolean }): void
  (e: 'open-slide-schedule'): void
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
  localDisableRowReorder,
  localDisableCrossRowMove,
  authorityHistoryUsers,
  title,
  localClearProgress,
  close,
  handleBeforeClose,
  save,
} = useProjectDetailDialog(props, emit)

const openSlideSchedule = () => {
  emit('open-slide-schedule')
}

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

const tab = ref<'general' | 'permissions' | 'editOptions' | 'colorPalettes' | 'labels' | 'milestones'>('general')
const expandedPaletteIndex = ref<number | null>(null)
const expandedLabelIndex = ref<number | null>(null)
const expandedMilestoneIndex = ref<number | null>(null)
const palettesContainer = ref<HTMLElement | null>(null)
const labelsContainer = ref<HTMLElement | null>(null)
const milestonesContainer = ref<HTMLElement | null>(null)

const scrollToBottom = async (container: HTMLElement | null) => {
  await nextTick()
  setTimeout(() => {
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
    }
  }, 50)
}

const addPalette = () => {
  localColorPalettes.value.push({ color: '#000000', backgroundColor: '#ffffff' })
  expandedPaletteIndex.value = localColorPalettes.value.length - 1
  scrollToBottom(palettesContainer.value)
}

const addLabel = () => {
  localLabels.value.push({ name: 'New Label', color: '#cccccc' })
  expandedLabelIndex.value = localLabels.value.length - 1
  scrollToBottom(labelsContainer.value)
}

const addMilestone = () => {
  localMilestones.value.push({ name: '', datetime: '', color: '#FF0000' })
  expandedMilestoneIndex.value = localMilestones.value.length - 1
  scrollToBottom(milestonesContainer.value)
}

const dateInputType = computed(() => granularityToInputType(localGranularity.value))

const dateDurationRules = computed(() => {
  return [
    (val: string) => {
      if (!localStart.value || !localEnd.value) return true
      const start = dayjs(localStart.value)
      const end = dayjs(localEnd.value)

      if (localGranularity.value === 'hourly') {
        if (end.isAfter(start.add(10, 'day'))) {
          return '期間は10日以内に設定してください'
        }
      } else if (localGranularity.value === 'daily') {
        if (end.isAfter(start.add(24, 'month'))) {
          return '期間は24ヶ月以内に設定してください'
        }
      } else if (localGranularity.value === 'monthly') {
        if (end.isAfter(start.add(100, 'year'))) {
          return '期間は100年以内に設定してください'
        }
      }
      return true
    },
  ]
})

watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue) {
      tab.value = 'general'
      expandedPaletteIndex.value = null
      expandedLabelIndex.value = null
      expandedMilestoneIndex.value = null
    }
  },
)
</script>

<template>
  <v-dialog :model-value="modelValue" @update:model-value="handleBeforeClose" max-width="950px">
    <v-card v-draggable-dialog>
      <v-card-title class="pa-8 pb-0">{{ title }}</v-card-title>
      <v-card-text class="px-8 py-4">
        <v-form ref="form" v-model="formValid">
          <v-row>
            <v-col cols="3">
              <v-tabs v-model="tab" direction="vertical" color="primary">
                <v-tab value="general">
                  <v-icon start> mdi-account </v-icon>
                  一般
                </v-tab>
                <v-tab value="editOptions">
                  <v-icon start> mdi-cog </v-icon>
                  編集オプション
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
              <v-window v-model="tab" style="min-height: 600px">
                <v-window-item value="general">
                  <v-row density="compact" class="pt-2">
                    <!-- モード（作成後変更不可） -->
                    <v-col cols="12" class="mb-4 d-flex">
                      <div class="text-caption text-medium-emphasis mr-4 d-flex align-center">
                        <span class="mr-2">モード</span>
                        <HelpText text="モードは作成後に変更できません" />
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
                        :custom-rules="dateDurationRules"
                        hide-details="auto"
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
                        :custom-rules="dateDurationRules"
                        :hide-details="isDuplicate ? false : 'auto'"
                        :hint="isDuplicate ? '開始日の変更に連動して自動調整されます' : undefined"
                        :persistent-hint="isDuplicate"
                        :disabled="isDuplicate"
                        class="mb-3"
                      />
                    </v-col>
                    <v-col v-if="isDuplicate" cols="12" class="py-0">
                      <v-checkbox
                        v-model="localClearProgress"
                        label="進捗率をクリアする"
                        density="compact"
                        hide-details
                        class="mb-3"
                      />
                    </v-col>
                    <v-col v-if="props.project && !isDuplicate" cols="12" class="py-0 mt-n2">
                      <v-btn
                        variant="text"
                        prepend-icon="mdi-calendar-arrow-right"
                        color="primary"
                        size="small"
                        @click="openSlideSchedule"
                      >
                        期間スライド
                      </v-btn>
                    </v-col>
                    <!-- hourly および daily モード時のスナップ単位設定 -->
                    <v-col v-if="localGranularity === 'hourly' || localGranularity === 'daily'" cols="12" class="mb-2">
                      <SnapDurationInput v-model="localSnapDurationMinutes" :granularity="localGranularity" />
                    </v-col>
                    <v-col cols="12" class="mb-4">
                      <v-checkbox v-model="localPublic" density="compact" hide-details>
                        <template v-slot:label>
                          <span class="mr-2">一般公開</span>
                          <HelpText text="ONにすると全てのユーザーが参照できるようになります" />
                        </template>
                      </v-checkbox>
                    </v-col>
                    <v-col cols="4">
                      <v-select
                        v-model="localHistoryIntervalMinutes"
                        :items="historyIntervalOptions"
                        label="変更履歴の自動保存"
                        density="compact"
                        variant="outlined"
                        hide-details="auto"
                        class="mb-3 mr-3"
                      >
                        <template v-slot:append>
                          <HelpText
                            text="設定した間隔が経過した後にガントチャートを変更すると、変更前の状態を自動的にスナップショットとして保存します"
                          />
                        </template>
                      </v-select>
                    </v-col>
                    <v-col cols="5">
                      <v-select
                        v-model="localHistoryRetentionDays"
                        :items="historyRetentionOptions"
                        label="自動履歴の保持期間"
                        density="compact"
                        variant="outlined"
                        hide-details="auto"
                        :disabled="!localHistoryIntervalMinutes"
                        class="mb-3 mr-3"
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
                <v-window-item value="editOptions">
                  <v-row density="compact" class="pt-2">
                    <v-col cols="12" class="mb-2">
                      <v-checkbox v-model="localDisableRowReorder" density="compact" hide-details>
                        <template v-slot:label>
                          <span class="mr-2">行の入れ替えを禁止する</span>
                          <HelpText text="ONにするとドラッグ＆ドロップによる行の並び替えができなくなります" />
                        </template>
                      </v-checkbox>
                    </v-col>
                    <v-col cols="12" class="mb-2">
                      <v-checkbox v-model="localDisableCrossRowMove" density="compact" hide-details>
                        <template v-slot:label>
                          <span class="mr-2">タスクの別行への移動を禁止する</span>
                          <HelpText text="ONにするとタスクを別の行へドラッグ移動できなくなります" />
                        </template>
                      </v-checkbox>
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
                      <v-btn variant="text" prepend-icon="mdi-plus" color="primary" @click="addPalette">
                        パレット追加
                      </v-btn>
                    </v-col>
                  </v-row>
                  <div
                    ref="palettesContainer"
                    style="max-height: 560px; overflow-y: auto; overflow-x: hidden"
                    class="pr-2"
                  >
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
                      <v-btn variant="text" prepend-icon="mdi-plus" color="primary" @click="addLabel">
                        ラベル追加
                      </v-btn>
                    </v-col>
                  </v-row>
                  <div
                    ref="labelsContainer"
                    style="max-height: 560px; overflow-y: auto; overflow-x: hidden"
                    class="pr-2"
                  >
                    <v-row density="compact">
                      <v-col v-for="(label, i) in localLabels" :key="i" cols="12">
                        <LabelInput
                          :model-value="label"
                          :expanded="expandedLabelIndex === i"
                          @update:expanded="(val: boolean) => (expandedLabelIndex = val ? i : null)"
                          @update:model-value="(val: Label) => (localLabels[i] = val)"
                          @delete="
                            () => {
                              localLabels.splice(i, 1)
                              if (expandedLabelIndex === i) expandedLabelIndex = null
                            }
                          "
                        />
                      </v-col>
                    </v-row>
                  </div>
                </v-window-item>
                <v-window-item value="milestones">
                  <v-row density="compact">
                    <v-col cols="12">
                      <v-btn variant="text" prepend-icon="mdi-plus" color="primary" @click="addMilestone">
                        マイルストーン追加
                      </v-btn>
                    </v-col>
                  </v-row>
                  <div
                    ref="milestonesContainer"
                    style="max-height: 560px; overflow-y: auto; overflow-x: hidden"
                    class="pr-2"
                  >
                    <v-row density="compact">
                      <v-col v-for="(milestone, i) in localMilestones" :key="i" cols="12">
                        <MilestoneInput
                          :model-value="milestone"
                          :expanded="expandedMilestoneIndex === i"
                          @update:expanded="(val: boolean) => (expandedMilestoneIndex = val ? i : null)"
                          @update:model-value="(val: Milestone) => (localMilestones[i] = val)"
                          @delete="
                            () => {
                              localMilestones.splice(i, 1)
                              if (expandedMilestoneIndex === i) expandedMilestoneIndex = null
                            }
                          "
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
