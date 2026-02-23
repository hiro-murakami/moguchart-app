<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { VForm } from 'vuetify/components'

import inputRules from '@/modules/inputRules'
import type { EditingRowData } from '@functions/types/shared'

const props = defineProps<{
  modelValue: boolean
  row?: EditingRowData
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', data: EditingRowData): void
}>()

const isVisible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const formRef = ref<VForm | null>(null)
const formValid = ref(false)

const form = ref({
  name: '',
  description: '',
})

watch(
  () => props.row,
  async (newRow) => {
    if (newRow) {
      form.value = {
        name: newRow.name,
        description: newRow.description || '',
      }
      await nextTick()
      formRef.value?.validate()
    } else {
      formRef.value?.resetValidation()
    }
  },
  { immediate: true },
)

const save = () => {
  if (!formValid.value || !props.row) return
  emit('save', {
    id: props.row.id,
    name: form.value.name,
    description: form.value.description,
  })
}
</script>

<template>
  <v-dialog v-model="isVisible" max-width="600px">
    <v-card>
      <v-card-title class="pa-8 pb-0">行の編集</v-card-title>
      <v-card-text class="pa-8">
        <v-form ref="formRef" v-model="formValid" @submit.prevent>
          <v-row dense>
            <v-col cols="12">
              <v-text-field
                v-model="form.name"
                label="行名"
                required
                autofocus
                density="compact"
                variant="outlined"
                hide-details="auto"
                :rules="[inputRules.required, inputRules.within(191)]"
                autocomplete="off"
                class="mb-3"
              />
            </v-col>
            <v-col cols="12">
              <v-textarea
                v-model="form.description"
                label="説明"
                rows="3"
                auto-grow
                density="compact"
                variant="outlined"
                hide-details="auto"
                :rules="[inputRules.within(1024)]"
                autocomplete="off"
              />
            </v-col>
          </v-row>
        </v-form>
      </v-card-text>
      <v-card-actions class="pa-8 pt-0">
        <v-spacer />
        <v-btn color="grey-darken-1" variant="text" @click="isVisible = false">キャンセル</v-btn>
        <v-btn color="primary" variant="flat" @click="save" :disabled="!formValid" class="ml-2">保存</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
