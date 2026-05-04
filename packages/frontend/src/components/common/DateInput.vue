<script setup lang="ts">
import { computed } from 'vue'
import inputRules from '@/modules/inputRules'

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
  // datetime-local: TZなしの文字列（例: "2025-05-03T03:00:00"）をそのままスライスして表示
  // dayjs() でパースするとブラウザのローカルTZが介入してズレが生じるため使用しない
  if (inputType.value === 'datetime-local') return props.modelValue.slice(0, 16)
  // date
  return props.modelValue.slice(0, 10)
})

const onUpdateModelValue = (val: string) => {
  let newValue = val
  if (val) {
    if (inputType.value === 'month' && val.length === 7) {
      newValue = `${val}-01`
    } else if (inputType.value === 'datetime-local') {
      // TZオフセットを付けずウォールクロック時刻として保持する
      // dayjs(val).format() は "+09:00" 付きになりバックエンドでUTC変換されて9時間ずれるため使用しない
      newValue = val.length === 16 ? `${val}:00` : val // "YYYY-MM-DDTHH:mm" → "YYYY-MM-DDTHH:mm:ss"
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
      // TZなしのウォールクロック文字列として比較する（dayjs はTZ変換が入るため使わない）
      target = target.slice(0, 16)
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
