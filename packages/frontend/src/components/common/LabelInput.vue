<script setup lang="ts">
import { computed } from 'vue'
import type { Label } from '@functions/types/shared'
import ColorInput from './ColorInput.vue'

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
  <v-card variant="outlined" class="pa-2">
    <div class="d-flex align-center">
      <div class="mr-4 d-flex align-center justify-center">
        <v-tooltip location="top" open-delay="500">
          <template #activator="{ props }">
            <v-btn v-bind="props" icon="mdi-delete" variant="text" color="error" size="small" @click="emit('delete')" />
          </template>
          <span>削除</span>
        </v-tooltip>
        <div
          :style="`
            width: 80px;
            height: 24px;
            border-radius: 12px;
            background-color: ${color || '#cccccc'};
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            font-size: 12px;
            font-weight: bold;
            padding: 0 8px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          `"
        >
          {{ name || 'Label' }}
        </div>
      </div>

      <div class="flex-grow-1">
        <v-row dense>
          <v-col cols="8">
            <v-text-field v-model="name" label="ラベル名" density="compact" variant="outlined" hide-details />
          </v-col>
          <v-col cols="4">
            <ColorInput v-model="color" label="色" min-width="100px" />
          </v-col>
        </v-row>
      </div>
    </div>
  </v-card>
</template>
