<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Comment, Role } from '@functions/types/shared'
import { selectComments, upsertComment, deleteComment as deleteCommentApi } from '@/modules/scripts'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/ja'
import { useUserStore } from '@/stores/useUserStore'

dayjs.extend(relativeTime)
dayjs.locale('ja')

const userStore = useUserStore()

const props = defineProps<{
  modelValue: boolean
  taskId?: number | null
  rowId?: number | null
  projectId?: string | null
  targetName: string
  isReadOnly?: boolean
  userRole?: Role
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'updated'): void
}>()

const comments = ref<Comment[]>([])
const newComment = ref('')
const isLoading = ref(false)
const isSending = ref(false)

const loadComments = async () => {
  const params: { taskId?: number; rowId?: number; projectId?: string } = {}
  if (props.taskId) params.taskId = props.taskId
  else if (props.rowId) params.rowId = props.rowId
  else if (props.projectId) params.projectId = props.projectId
  else return

  isLoading.value = true
  try {
    comments.value = await selectComments(params)
  } catch (err) {
    console.error('Failed to load comments:', err)
  } finally {
    isLoading.value = false
  }
}

const addComment = async () => {
  if (!newComment.value.trim()) return
  isSending.value = true
  try {
    const comment: Comment = {
      id: 0,
      content: newComment.value.trim(),
    }
    if (props.taskId) comment.taskId = props.taskId
    else if (props.rowId) comment.rowId = props.rowId
    else if (props.projectId) comment.projectId = props.projectId

    await upsertComment(comment)
    newComment.value = ''
    await loadComments()
    emit('updated')
  } catch (err) {
    console.error('Failed to add comment:', err)
  } finally {
    isSending.value = false
  }
}

const removeComment = async (commentId: number) => {
  try {
    await deleteCommentApi(commentId)
    await loadComments()
    emit('updated')
  } catch (err) {
    console.error('Failed to delete comment:', err)
  }
}

const formatTime = (dateStr?: string) => {
  if (!dateStr) return ''
  return dayjs(dateStr).fromNow()
}

const canDeleteComment = (comment: Comment) => {
  if (props.isReadOnly) return false
  if (props.userRole === 'owner') return true
  return comment.createdBy === userStore.currentUser?.email
}

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      loadComments()
    } else {
      comments.value = []
      newComment.value = ''
    }
  },
)
</script>

<template>
  <v-dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" max-width="520px">
    <v-card v-draggable-dialog>
      <v-card-title class="d-flex align-center pa-6 pb-2">
        <v-icon icon="mdi-comment-text-outline" class="mr-2" />
        {{ targetName }} のコメント
      </v-card-title>

      <v-card-text class="pa-6 pt-2">
        <!-- 新規コメント入力 -->
        <div v-if="!isReadOnly" class="d-flex align-end mb-4" style="gap: 8px">
          <v-textarea
            v-model="newComment"
            label="コメントを入力"
            rows="2"
            auto-grow
            density="compact"
            variant="outlined"
            hide-details
            :disabled="isSending"
            @keydown.ctrl.enter="addComment"
            @keydown.meta.enter="addComment"
          />
          <v-btn
            icon="mdi-send"
            color="primary"
            variant="flat"
            size="small"
            :disabled="!newComment.trim() || isSending"
            :loading="isSending"
            @click="addComment"
          />
        </div>

        <!-- コメント一覧 -->
        <v-progress-linear v-if="isLoading" indeterminate color="primary" class="mb-2" />

        <div v-if="!isLoading && comments.length === 0" class="text-center text-medium-emphasis py-4">
          コメントはまだありません
        </div>

        <v-list v-else density="compact" class="comment-list">
          <v-list-item v-for="comment in comments" :key="comment.id" class="px-0 comment-item">
            <div class="d-flex align-start" style="gap: 8px; width: 100%">
              <UserAvatar
                size="28"
                color="grey-darken-1"
                class="mt-1 flex-shrink-0"
                :url="comment.createdByPhotoURL"
                :name="comment.createdByDisplayName || comment.createdBy"
              />
              <div style="flex: 1; min-width: 0">
                <div class="d-flex align-center" style="gap: 8px">
                  <span class="text-caption font-weight-bold text-truncate" style="max-width: 200px">
                    {{ comment.createdByDisplayName || comment.createdBy || '不明' }}
                  </span>
                  <span class="text-caption text-medium-emphasis">
                    {{ formatTime(comment.createdAt) }}
                  </span>
                  <v-spacer />
                  <v-btn
                    v-if="canDeleteComment(comment)"
                    icon="mdi-delete-outline"
                    variant="text"
                    size="x-small"
                    color="grey"
                    class="delete-btn"
                    @click="removeComment(comment.id)"
                  />
                </div>
                <div class="text-body-2 mt-1" style="white-space: pre-wrap; word-break: break-word">
                  {{ comment.content }}
                </div>
              </div>
            </div>
          </v-list-item>
        </v-list>
      </v-card-text>

      <v-card-actions class="pa-6 pt-0">
        <v-spacer />
        <v-btn color="grey-darken-1" variant="text" @click="emit('update:modelValue', false)"> 閉じる </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.comment-list {
  max-height: 400px;
  overflow-y: auto;
}

.comment-item .delete-btn {
  opacity: 0;
  transition: opacity 0.15s ease;
}

.comment-item:hover .delete-btn {
  opacity: 1;
}
</style>
