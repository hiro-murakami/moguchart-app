<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import inputRules from '@/modules/inputRules'
import type { ProjectGranularity } from '@functions/types/shared'

defineOptions({
  inheritAttrs: false,
})

const props = defineProps<{
  modelValue: string
  type?: 'month' | 'date' | 'datetime-local'
  labelDaily?: string
  labelMonthly?: string
  labelDatetime?: string
  compareTarget?: string
  compareRule?: 'before' | 'after'
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const inputType = computed(() => {
  return props.type || 'date'
})

const displayValue = computed(() => {
  if (!props.modelValue) return ''
  if (inputType.value === 'month') return props.modelValue.slice(0, 7)
  if (inputType.value === 'datetime-local') return dayjs(props.modelValue).format('YYYY-MM-DDTHH:mm')
  // date
  return props.modelValue.slice(0, 10)
})

const onUpdateModelValue = (val: string) => {
  let newValue = val
  if (val) {
    if (inputType.value === 'month' && val.length === 7) {
      newValue = `${val}-01`
    } else if (inputType.value === 'datetime-local') {
      newValue = dayjs(val).format() // ISO format
    }
  }
  emit('update:modelValue', newValue)
}

const label = computed(() => {
  if (inputType.value === 'month') return props.labelMonthly || '月'
  if (inputType.value === 'datetime-local') return props.labelDatetime || '日時'
  return props.labelDaily || '日'
})

const rules = computed(() => {
  const baseRules: any[] = [inputRules.required]
  if (props.compareTarget) {
    let target = props.compareTarget
    if (inputType.value === 'month') {
      target = target.slice(0, 7)
    } else if (inputType.value === 'datetime-local') {
      target = dayjs(target).format('YYYY-MM-DDTHH:mm')
    } else {
      target = target.slice(0, 10)
    }
    
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
    :type="inputType"
    density="compact"
    variant="outlined"
    :rules="rules"
  />
</template>
