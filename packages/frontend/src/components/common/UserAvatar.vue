<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    url?: string | null
    name?: string | null
    color?: string | null
    /** trueの場合、URLも名前のイニシャルも表示せずmdi-accountアイコンを表示する */
    isAnonymous?: boolean
  }>(),
  {
    color: 'grey-darken-1',
    isAnonymous: false,
  },
)

const initial = computed(() => {
  return (props.name || '?').charAt(0).toUpperCase()
})

/** アイコンフォールバックを使うかどうか（匿名 or URLも名前もない場合） */
const useIcon = computed(() => props.isAnonymous || (!props.url && !props.name))
</script>

<template>
  <v-avatar :color="color || undefined">
    <img
      v-if="url && !isAnonymous"
      :src="url"
      style="width: 100%; height: 100%; object-fit: cover"
      :alt="name || 'Avatar'"
      referrerpolicy="no-referrer"
    />
    <v-icon v-else-if="useIcon" icon="mdi-account" color="white" />
    <span v-else class="text-white text-caption font-weight-bold">
      {{ initial }}
    </span>
  </v-avatar>
</template>
