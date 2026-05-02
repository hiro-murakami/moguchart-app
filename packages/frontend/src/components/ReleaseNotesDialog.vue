<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'
import RELEASE_NOTES from '../../../../docs/release-notes.md?raw'

defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const renderedHtml = computed(() => {
  return marked.parse(RELEASE_NOTES) as string
})
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    max-width="680"
    scrollable
  >
    <v-card>
      <v-card-title class="d-flex align-center pa-4">
        <v-icon icon="mdi-note-text-outline" class="mr-2" />
        <span>リリースノート</span>
        <v-spacer />
        <v-btn
          icon="mdi-close"
          variant="text"
          size="small"
          @click="emit('update:modelValue', false)"
        />
      </v-card-title>
      <v-divider />
      <v-card-text class="release-notes-content pa-6">
        <div v-html="renderedHtml" />
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.release-notes-content {
  max-height: 70vh;
  overflow-y: auto;
}

.release-notes-content :deep(h1) {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.release-notes-content :deep(h2) {
  font-size: 1.2rem;
  font-weight: 700;
  margin-top: 2rem;
  margin-bottom: 0.5rem;
  padding: 0.4rem 0.75rem;
  background: rgba(var(--v-theme-primary), 0.08);
  border-left: 4px solid rgb(var(--v-theme-primary));
  border-radius: 0 4px 4px 0;
}

.release-notes-content :deep(h3) {
  font-size: 0.95rem;
  font-weight: 600;
  margin-top: 1.25rem;
  margin-bottom: 0.4rem;
  color: rgb(var(--v-theme-primary));
}

.release-notes-content :deep(p) {
  margin-bottom: 0.6rem;
  line-height: 1.7;
  font-size: 0.875rem;
}

.release-notes-content :deep(ul),
.release-notes-content :deep(ol) {
  padding-left: 1.5rem;
  margin-bottom: 0.75rem;
}

.release-notes-content :deep(li) {
  margin-bottom: 0.3rem;
  font-size: 0.875rem;
  line-height: 1.6;
}

.release-notes-content :deep(strong) {
  font-weight: 600;
}

.release-notes-content :deep(hr) {
  border: none;
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  margin: 1.5rem 0;
}
</style>
