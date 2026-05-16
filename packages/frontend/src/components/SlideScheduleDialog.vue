<script setup lang="ts">
import { computed } from 'vue'
import type { Project } from '@functions/types/shared'
import { granularityToInputType } from '@/modules/utils'
import { useSlideScheduleDialog } from './composables/useSlideScheduleDialog'

const props = defineProps<{
  modelValue: boolean
  project?: Project | null
  saving?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'slide', options: { newStart: string; clearProgress: boolean }): void
}>()

const {
  form,
  formValid,
  localStart,
  localEnd,
  localClearProgress,
  hasStartChanged,
  close,
  slide,
} = useSlideScheduleDialog(props, emit)

const dateInputType = computed(() => granularityToInputType(props.project?.attribute?.granularity))
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="
      (v: boolean) => {
        if (!v) close()
      }
    "
    max-width="600px"
  >
    <v-card>
      <v-card-title class="pa-6 pb-2">
        <v-icon start>mdi-calendar-arrow-right</v-icon>
        期間スライド
      </v-card-title>

      <v-card-text class="pa-6 pt-2">
        <v-form ref="form" v-model="formValid">
          <p class="text-body-2 text-medium-emphasis mb-4">
            新しい開始日を設定すると、すべてのタスク・マイルストーンの日付が自動的にスライドされます。<br />
            終了日はプロジェクト期間を維持するよう自動計算されます。
          </p>

          <v-row density="compact">
            <v-col cols="6">
              <DateInput
                v-model="localStart"
                :type="dateInputType"
                label-daily="開始日"
                label-monthly="開始月"
                label-datetime="開始日時"
                :compare-target="localEnd"
                compare-rule="before"
                hide-details="auto"
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
                hint="開始日の変更に連動して自動調整されます"
                persistent-hint
                disabled
              />
            </v-col>
          </v-row>

          <v-checkbox
            v-model="localClearProgress"
            label="進捗率をクリアする"
            density="compact"
            hide-details
            class="mt-4"
          />
        </v-form>
      </v-card-text>

      <v-card-actions class="pa-6 pt-0">
        <v-btn color="grey-darken-1" variant="text" :disabled="props.saving" @click="close"> キャンセル </v-btn>
        <v-spacer></v-spacer>
        <v-btn
          color="primary"
          variant="flat"
          :loading="props.saving"
          :disabled="props.saving || !hasStartChanged"
          @click="slide"
        >
          OK
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
