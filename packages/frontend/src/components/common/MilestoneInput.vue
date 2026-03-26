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

const date = computed({
  get: () => props.modelValue.date,
  set: (val) => emit('update:modelValue', { ...props.modelValue, date: val }),
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
            <v-text-field
              v-model="date"
              label="日時"
              type="datetime-local"
              density="compact"
              variant="outlined"
              hide-details="auto"
              :rules="[inputRules.required]"
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
