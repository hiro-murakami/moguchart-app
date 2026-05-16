<script setup lang="ts">
import { computed } from 'vue'
import type { ProjectGranularity } from '@functions/types/shared'

const props = defineProps<{
  modelValue: number
  granularity: ProjectGranularity
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
}>()

const localValue = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})
</script>

<template>
  <div class="text-caption text-medium-emphasis mt-1 d-flex align-center">
    スナップ単位
    <HelpText text="タスクの移動・リサイズ時にスナップする時間単位です" class="ml-1" />
  </div>
  <v-btn-toggle
    v-if="granularity === 'hourly'"
    v-model="localValue"
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
  <v-btn-toggle
    v-if="granularity === 'daily'"
    v-model="localValue"
    mandatory
    density="compact"
    variant="outlined"
    color="primary"
    class="w-70"
  >
    <v-btn :value="1440" class="flex-grow-1">24時間</v-btn>
    <v-btn :value="720" class="flex-grow-1">12時間</v-btn>
    <v-btn :value="360" class="flex-grow-1">6時間</v-btn>
    <v-btn :value="180" class="flex-grow-1">3時間</v-btn>
  </v-btn-toggle>
</template>
