<script setup lang="ts">
import { computed } from 'vue'
import inputRules from '@/modules/inputRules'
import type { Milestone } from '@functions/types/shared'

const props = defineProps<{
  modelValue: Milestone
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: Milestone): void
  (e: 'delete'): void
}>()

const name = computed({
  get: () => props.modelValue.name,
  set: (val) => emit('update:modelValue', { ...props.modelValue, name: val }),
})

const datetime = computed({
  get: () => props.modelValue.datetime,
  set: (val) => emit('update:modelValue', { ...props.modelValue, datetime: val }),
})

const color = computed({
  get: () => props.modelValue.color,
  set: (val) => emit('update:modelValue', { ...props.modelValue, color: val }),
})
</script>

<template>
  <v-card variant="outlined" class="pa-2" style="border-color: rgba(var(--v-border-color), 0.38)">
    <div class="d-flex align-center">
      <div class="mr-2 d-flex align-center justify-start">
        <TooltipBtn
          icon="mdi-delete"
          variant="text"
          color="error"
          size="small"
          tooltip="削除"
          location="top"
          @click="emit('delete')"
        />
      </div>

      <div class="flex-grow-1">
        <v-row density="compact">
          <v-col cols="4">
            <v-text-field
              v-model="name"
              label="マイルストーン名"
              density="compact"
              variant="outlined"
              hide-details="auto"
              :rules="[inputRules.required, inputRules.within(48)]"
              class="small-input"
              autocomplete="off"
            />
          </v-col>
          <v-col cols="5">
            <DateInput
              v-model="datetime"
              type="datetime-local"
              label-datetime="日時"
              hide-details="auto"
              class="small-input"
            />
          </v-col>
          <v-col cols="3">
            <ColorInput v-model="color" label="色" min-width="100px" class="small-input" />
          </v-col>
        </v-row>
      </div>
    </div>
  </v-card>
</template>
