<script setup lang="ts">
import type { Project } from '@functions/types/shared'
import inputRules from '@/modules/inputRules'
import { useProjectDuplicateDialog } from './composables/useProjectDuplicateDialog'

const props = defineProps<{
  modelValue: boolean
  project?: Project | null
  saving?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', project: Partial<Project>, options: { clearProgress: boolean }): void
}>()

const {
  form,
  formValid,
  localName,
  localStart,
  localEnd,
  localClearProgress,
  description,
  close,
  save,
  currentStep,
  canProceed,
  isFirstStep,
  isLastStep,
  nextStep,
  prevStep,
} = useProjectDuplicateDialog(props, emit)
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="
      (v: boolean) => {
        if (!v) close()
      }
    "
    max-width="660px"
  >
    <v-card>
      <v-card-title class="pa-6 pb-2">プロジェクト複製</v-card-title>

      <v-card-text class="pa-4 pt-0">
        <v-form ref="form" v-model="formValid">
          <!-- ステッパーヘッダー -->
          <v-stepper
            v-model="currentStep"
            :items="['プロジェクト名', '期間', 'オプション']"
            hide-actions
            alt-labels
            flat
            class="stepper-flat"
          >
            <!-- Step 1: プロジェクト名 -->
            <template v-slot:item.1>
              <v-card-subtitle>複製後のプロジェクト名を入力します。</v-card-subtitle>
              <v-sheet class="step-content pa-4 mt-3">
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
              </v-sheet>
            </template>

            <!-- Step 2: 期間 -->
            <template v-slot:item.2>
              <v-card-subtitle>
                複製後のプロジェクトの開始日を入力します。<br />
                タスク・マイルストーンの日付は新しい開始日に応じて自動調整されます。
              </v-card-subtitle>
              <v-sheet class="step-content pa-4 mt-3">
                <v-row density="compact">
                  <v-col cols="6">
                    <DateInput
                      v-model="localStart"
                      :type="props.project?.attribute?.granularity === 'monthly' ? 'month' : 'date'"
                      label-daily="開始日"
                      label-monthly="開始月"
                      :compare-target="localEnd"
                      compare-rule="before"
                      hide-details="auto"
                    />
                  </v-col>
                  <v-col cols="6">
                    <DateInput
                      v-model="localEnd"
                      :type="props.project?.attribute?.granularity === 'monthly' ? 'month' : 'date'"
                      label-daily="終了日"
                      label-monthly="終了月"
                      :compare-target="localStart"
                      compare-rule="after"
                      hint="開始日の変更に連動して自動調整されます"
                      persistent-hint
                      disabled
                    />
                  </v-col>
                </v-row>
              </v-sheet>
            </template>

            <!-- Step 3: オプション -->
            <template v-slot:item.3>
              <v-card-subtitle> チェックを入れると、すべてのタスクの進捗率が 0% にリセットされます。 </v-card-subtitle>
              <v-sheet class="step-content pa-4">
                <v-checkbox
                  v-model="localClearProgress"
                  label="進捗率をクリアする"
                  density="compact"
                  hide-details
                  class="mb-2"
                />
              </v-sheet>
            </template>
          </v-stepper>
        </v-form>
      </v-card-text>

      <!-- ナビゲーションボタン -->
      <v-card-actions class="pa-6 pt-0">
        <v-btn color="grey-darken-1" variant="text" :disabled="props.saving" @click="close"> キャンセル </v-btn>
        <v-spacer></v-spacer>
        <v-btn v-if="!isFirstStep" variant="tonal" @click="prevStep" :disabled="props.saving"> 戻る </v-btn>
        <v-btn v-if="!isLastStep" color="primary" variant="flat" :disabled="!canProceed" @click="nextStep" class="ml-2">
          次へ
        </v-btn>
        <v-btn
          v-if="isLastStep"
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

<style scoped>
.stepper-flat {
  box-shadow: none !important;
  background: transparent !important;
}

.step-content {
  min-height: 100px;
  background: transparent;
}
</style>
