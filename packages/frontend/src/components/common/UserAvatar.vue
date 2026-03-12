<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    url?: string | null
    name?: string | null
    color?: string | null
  }>(),
  {
    color: 'grey-darken-1',
  },
)

const initial = computed(() => {
  return (props.name || '?').charAt(0).toUpperCase()
})
</script>

<template>
  <v-avatar :color="color || undefined">
    <img
      v-if="url"
      :src="url"
      style="width: 100%; height: 100%; object-fit: cover"
      :alt="name || 'Avatar'"
      referrerpolicy="no-referrer"
    />
    <span v-else class="text-white text-caption font-weight-bold">
      {{ initial }}
    </span>
  </v-avatar>
</template>
