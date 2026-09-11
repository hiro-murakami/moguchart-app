<script setup lang="ts">
interface Props {
  modelValue: number
  min?: number
  max?: number
  step?: number
  unit?: string
  showValue?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  min: 50,
  max: 200,
  step: 5,
  unit: '%',
  showValue: true,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
}>()

const zoomOut = () => {
  emit('update:modelValue', Math.max(props.min, props.modelValue - props.step))
}

const zoomIn = () => {
  emit('update:modelValue', Math.min(props.max, props.modelValue + props.step))
}

const resetZoom = () => {
  emit('update:modelValue', 100)
}
</script>

<template>
  <div class="d-flex align-center" style="width: 250px">
    <TooltipBtn icon="mdi-magnify-minus" variant="text" size="medium" tooltip="縮小" @click="zoomOut" />
    <v-slider
      :model-value="modelValue"
      :min="min"
      :max="max"
      :step="step"
      hide-details
      density="compact"
      color="primary"
      class="mx-1 flex-grow-1"
      @update:model-value="emit('update:modelValue', $event)"
    />
    <TooltipBtn icon="mdi-magnify-plus" variant="text" size="medium" tooltip="拡大" @click="zoomIn" />
    <span
      v-if="showValue"
      class="text-caption font-weight-bold text-medium-emphasis ml-1"
      style="min-width: 40px; text-align: right; cursor: pointer; user-select: none;"
      title="クリックで100%にリセット"
      @click="resetZoom"
    >
      {{ modelValue }}{{ unit }}
    </span>
  </div>
</template>
