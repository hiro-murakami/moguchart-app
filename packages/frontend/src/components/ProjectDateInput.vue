<script setup lang="ts">
import { computed } from 'vue'
import inputRules from '@/modules/inputRules'
import type { ProjectGranularity } from '@functions/types/shared'

defineOptions({
  inheritAttrs: false,
})

const props = defineProps<{
  modelValue: string
  granularity: ProjectGranularity | string
  labelDaily?: string
  labelMonthly?: string
  compareTarget?: string
  compareRule?: 'before' | 'after'
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const isMonthly = computed(() => props.granularity === 'monthly')

const displayValue = computed(() => {
  return isMonthly.value && props.modelValue ? props.modelValue.slice(0, 7) : props.modelValue
})

const onUpdateModelValue = (val: string) => {
  const newValue = (isMonthly.value && val && val.length === 7) ? `${val}-01` : val
  emit('update:modelValue', newValue)
}

const label = computed(() => {
  return isMonthly.value ? (props.labelMonthly || '月') : (props.labelDaily || '日')
})

const rules = computed(() => {
  const baseRules: any[] = [inputRules.required]
  if (props.compareTarget) {
    const target = isMonthly.value && props.compareTarget ? props.compareTarget.slice(0, 7) : props.compareTarget
    if (props.compareRule === 'before') {
      baseRules.push(inputRules.dateBefore(target))
    } else if (props.compareRule === 'after') {
      baseRules.push(inputRules.dateAfter(target))
    }
  }
  return baseRules
})
</script>

<template>
  <v-text-field
    v-bind="$attrs"
    :model-value="displayValue"
    @update:model-value="onUpdateModelValue"
    :label="label"
    :type="isMonthly ? 'month' : 'date'"
    density="compact"
    variant="outlined"
    :rules="rules"
  />
</template>
