<script setup lang="ts">
interface Props {
  text?: string
  location?: 'top' | 'bottom' | 'left' | 'right' | 'start' | 'end'
  icon?: string
  size?: string
  openDelay?: number | string
}

withDefaults(defineProps<Props>(), {
  location: 'top',
  icon: 'mdi-help-circle-outline',
  size: 'small',
  openDelay: 500,
})
</script>

<template>
  <v-tooltip :text="text" :location="location" :open-delay="openDelay" max-width="300">
    <template v-slot:activator="{ props }">
      <v-icon v-bind="props" :size="size" style="cursor: help" class="text-medium-emphasis">
        {{ icon }}
      </v-icon>
    </template>
    <slot name="text">
      {{ text }}
    </slot>
  </v-tooltip>
</template>
