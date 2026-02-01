<script setup lang="ts">
defineProps<{
  role: string
}>()

const getRoleColor = (role: string) => {
  switch (role) {
    case 'owner':
      return 'primary'
    case 'editor':
      return 'secondary'
    case 'viewer':
      return 'default'
    default:
      return 'default'
  }
}

const getRoleLabel = (role: string) => {
  switch (role) {
    case 'owner':
      return 'オーナー'
    case 'editor':
      return '編集者'
    case 'viewer':
      return '閲覧者'
    default:
      return role
  }
}
</script>

<template>
  <v-chip :color="getRoleColor(role)" size="small">
    {{ getRoleLabel(role) }}
  </v-chip>
</template>
