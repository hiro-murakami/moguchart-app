<script setup lang="ts">
import { computed } from 'vue'
import inputRules from '@/modules/inputRules'
import type { Label } from '@functions/types/shared'
import { getContrastColor } from '../../modules/utils'

const props = defineProps<{
  modelValue: Label
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: Label): void
  (e: 'delete'): void
}>()

const name = computed({
  get: () => props.modelValue.name,
  set: (val) => emit('update:modelValue', { ...props.modelValue, name: val }),
})

const color = computed({
  get: () => props.modelValue.color,
  set: (val) => emit('update:modelValue', { ...props.modelValue, color: val }),
})
</script>

<template>
  <v-card variant="outlined" class="pa-2" style="border-color: rgba(var(--v-border-color), 0.38)">
    <div class="d-flex align-center">
      <div class="mr-4 d-flex align-center justify-start" style="width: 30%">
        <TooltipBtn
          icon="mdi-delete"
          variant="text"
          color="error"
          size="small"
          tooltip="削除"
          location="top"
          @click="emit('delete')"
        />
        <v-chip
          :color="color || '#cccccc'"
          variant="flat"
          label
          size="small"
          class="font-weight-bold"
          :style="{ color: getContrastColor(color || '#cccccc') }"
        >
          {{ name || 'Label' }}
        </v-chip>
      </div>

      <div class="flex-grow-1">
        <v-row density="compact">
          <v-col cols="8">
            <v-text-field
              v-model="name"
              label="ラベル名"
              density="compact"
              variant="outlined"
              hide-details="auto"
              :rules="[inputRules.required, inputRules.within(48)]"
              class="small-input"
            />
          </v-col>
          <v-col cols="4">
            <ColorInput v-model="color" label="色" min-width="100px" class="small-input" />
          </v-col>
        </v-row>
      </div>
    </div>
  </v-card>
</template>
