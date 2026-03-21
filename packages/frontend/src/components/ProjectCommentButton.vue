<script setup lang="ts">
import type { Comment } from '@functions/types/shared'

interface Props {
  /** コメント件数 */
  commentCount: number
  /** コメント一覧 */
  comments: Comment[]
  /** コメント読み込み中か */
  loading?: boolean
  /** スナップショットモード（読み取り専用） */
  snapshotMode?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  snapshotMode: false,
})

const emit = defineEmits<{
  (e: 'click'): void
  (e: 'fetch'): void
}>()

const handleMenuOpen = (val: boolean) => {
  if (val) emit('fetch')
}
</script>

<template>
  <!-- 通常モード -->
  <v-menu
    v-if="!snapshotMode"
    open-on-hover
    :close-on-content-click="false"
    :open-delay="200"
    :close-delay="200"
    location="bottom"
    @update:model-value="handleMenuOpen"
  >
    <template #activator="{ props: menuProps }">
      <v-btn v-bind="menuProps" variant="text" size="small" class="px-1" min-width="0" @click="emit('click')">
        <v-icon size="18" class="mr-1">mdi-comment-text-outline</v-icon>
        <span v-if="commentCount > 0" style="font-size: 12px; font-weight: bold">
          {{ commentCount }}
        </span>
      </v-btn>
    </template>
    <v-card
      v-if="commentCount > 0"
      max-width="360"
      max-height="300"
      class="overflow-y-auto"
      :theme="$vuetify.theme.current.dark ? 'light' : 'dark'"
    >
      <v-card-text class="pa-3">
        <div v-if="loading" class="text-center py-2">
          <v-progress-circular indeterminate size="20" width="2" />
        </div>
        <template v-else>
          <div v-for="(comment, i) in comments.slice(0, 5)" :key="comment.id">
            <v-divider v-if="i > 0" class="my-2" />
            <div class="text-caption" style="opacity: 0.7">
              {{ comment.createdByDisplayName || comment.createdBy || '不明' }} -
              {{ comment.createdAt ? new Date(comment.createdAt).toLocaleString('ja-JP') : '' }}
            </div>
            <div class="text-body-2 mt-1" style="white-space: pre-wrap; word-break: break-word">
              {{ comment.content }}
            </div>
          </div>
          <div v-if="comments.length > 5" class="text-caption mt-2" style="opacity: 0.6">
            他 {{ comments.length - 5 }}件のコメント...
          </div>
        </template>
      </v-card-text>
    </v-card>
  </v-menu>

  <!-- スナップショットモード -->
  <v-menu
    v-else-if="commentCount > 0"
    open-on-hover
    :close-on-content-click="false"
    :open-delay="200"
    :close-delay="200"
    location="bottom"
  >
    <template #activator="{ props: menuProps }">
      <v-btn v-bind="menuProps" variant="text" size="small" class="px-1" min-width="0">
        <v-icon size="18" class="mr-1">mdi-comment-text-outline</v-icon>
        <span style="font-size: 12px; font-weight: bold">
          {{ commentCount }}
        </span>
      </v-btn>
    </template>
    <v-card
      max-width="360"
      max-height="300"
      class="overflow-y-auto"
      :theme="$vuetify.theme.current.dark ? 'light' : 'dark'"
    >
      <v-card-text class="pa-3">
        <div v-for="(comment, i) in comments.slice(0, 5)" :key="comment.id">
          <v-divider v-if="i > 0" class="my-2" />
          <div class="text-caption" style="opacity: 0.7">
            {{ comment.createdByDisplayName || comment.createdBy || '不明' }} -
            {{ comment.createdAt ? new Date(comment.createdAt).toLocaleString('ja-JP') : '' }}
          </div>
          <div class="text-body-2 mt-1" style="white-space: pre-wrap; word-break: break-word">
            {{ comment.content }}
          </div>
        </div>
        <div v-if="comments.length > 5" class="text-caption mt-2" style="opacity: 0.6">
          他 {{ comments.length - 5 }}件のコメント...
        </div>
      </v-card-text>
    </v-card>
  </v-menu>
</template>
