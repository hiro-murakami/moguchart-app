<script setup lang="ts">
import { computed } from 'vue'
import inputRules from '@/modules/inputRules'
import { formatValueForDateInput } from '@/modules/utils'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(
  defineProps<{
    modelValue: string
    type?: 'month' | 'date' | 'datetime-local'
    labelDaily?: string
    labelMonthly?: string
    labelDatetime?: string
    min?: string
    max?: string
    compareTarget?: string
    compareRule?: 'before' | 'after'
    customRules?: any[]
    required?: boolean
  }>(),
  {
    required: true,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const inputType = computed(() => {
  return props.type || 'date'
})

const displayValue = computed(() => {
  return formatValueForDateInput(props.modelValue, inputType.value)
})

const formattedMin = computed(() => {
  return props.min ? formatValueForDateInput(props.min, inputType.value) : undefined
})

const formattedMax = computed(() => {
  return props.max ? formatValueForDateInput(props.max, inputType.value) : undefined
})

const onUpdateModelValue = (val: string | null) => {
  let newValue = val || ''
  if (newValue) {
    if (inputType.value === 'month' && newValue.length === 7) {
      newValue = `${newValue}-01`
    } else if (inputType.value === 'datetime-local') {
      // TZオフセットを付けずウォールクロック時刻として保持する
      // dayjs(val).format() は "+09:00" 付きになりバックエンドでUTC変換されて9時間ずれるため使用しない
      newValue = newValue.length === 16 ? `${newValue}:00` : newValue // "YYYY-MM-DDTHH:mm" → "YYYY-MM-DDTHH:mm:ss"
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
  const baseRules: any[] = props.required ? [inputRules.required] : []
  if (props.compareTarget) {
    const target = formatValueForDateInput(props.compareTarget, inputType.value)

    if (props.compareRule === 'before') {
      baseRules.push(inputRules.dateBefore(target))
    } else if (props.compareRule === 'after') {
      baseRules.push(inputRules.dateAfter(target))
    }
  }
  if (props.customRules) {
    baseRules.push(...props.customRules)
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
    :min="formattedMin"
    :max="formattedMax"
    density="compact"
    variant="outlined"
    :rules="rules"
  />
</template>
