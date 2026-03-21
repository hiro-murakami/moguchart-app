<script setup lang="ts">
interface Props {
  modelValue: number
  min?: number
  max?: number
  step?: number
}

const props = withDefaults(defineProps<Props>(), {
  min: 10,
  max: 80,
  step: 5,
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
</script>

<template>
  <div class="d-flex align-center" style="width: 220px">
    <TooltipBtn icon="mdi-magnify-minus" variant="text" size="medium" tooltip="縮小" @click="zoomOut" />
    <v-slider
      :model-value="modelValue"
      :min="min"
      :max="max"
      :step="step"
      hide-details
      density="compact"
      class="mx-2 flex-grow-1"
      @update:model-value="emit('update:modelValue', $event)"
    />
    <TooltipBtn icon="mdi-magnify-plus" variant="text" size="medium" tooltip="拡大" @click="zoomIn" />
  </div>
</template>
