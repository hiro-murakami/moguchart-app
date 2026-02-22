<script setup lang="ts">
import { useAttrs } from 'vue'

defineOptions({
  inheritAttrs: false,
})

interface Props {
  tooltip?: string
  location?: 'top' | 'bottom' | 'left' | 'right' | 'start' | 'end'
  openDelay?: number | string
  tooltipDisabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  location: 'bottom',
  openDelay: 500,
})

const attrs = useAttrs()
</script>

<template>
  <v-tooltip :text="tooltip" :location="location" :open-delay="openDelay" :disabled="!tooltip || tooltipDisabled">
    <template v-slot:activator="{ props: tooltipProps }">
      <v-btn v-bind="tooltip ? { ...tooltipProps, ...attrs } : attrs">
        <template v-for="(_, slotName) in $slots" #[slotName]="slotProps">
          <slot :name="slotName" v-bind="slotProps || {}" />
        </template>
      </v-btn>
    </template>
  </v-tooltip>
</template>
