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

const { form, formValid, localName, localStart, localEnd, localClearProgress, description, close, save } =
  useProjectDuplicateDialog(props, emit)
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
      <v-card-title class="pa-6 pb-0">プロジェクト複製</v-card-title>
      <v-card-text class="pa-6">
        <v-form ref="form" v-model="formValid">
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
            <v-col v-if="description" cols="12" class="mb-4">
              <div class="text-caption text-medium-emphasis mb-1">説明</div>
              <div class="description-display pa-3 rounded text-body-2">{{ description }}</div>
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
                hint="開始日の変更に連動して自動調整されます"
                persistent-hint
                disabled
                :rules="[inputRules.required, inputRules.dateAfter(localStart)]"
                class="mb-3"
              />
            </v-col>
            <v-col cols="12">
              <v-checkbox
                v-model="localClearProgress"
                label="進捗率をクリアする"
                density="compact"
                hide-details
                class="mb-3"
              />
            </v-col>
          </v-row>
        </v-form>
      </v-card-text>
      <v-card-actions class="pa-6 pt-0">
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

<style scoped>
.description-display {
  background-color: rgba(var(--v-theme-surface-variant), 0.3);
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 120px;
  overflow-y: auto;
}
</style>
