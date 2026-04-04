<script setup lang="ts">
import { ref, watch, computed, onBeforeUnmount } from 'vue'
import type { Comment, Role } from '@functions/types/shared'
import { selectComments, upsertComment, deleteComment as deleteCommentApi } from '@/modules/scripts'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/ja'
import { useUserStore } from '@/stores/useUserStore'
import { useTheme } from 'vuetify'

dayjs.extend(relativeTime)
dayjs.locale('ja')

const userStore = useUserStore()
const theme = useTheme()

const CLOSED_WIDTH = 50
const DEFAULT_OPEN_WIDTH = 320
const MIN_WIDTH = 220
const MAX_WIDTH = 600

interface Props {
  /** プロジェクトID */
  projectId: string
  /** コメント件数 */
  commentCount: number
  /** スナップショットモード（読み取り専用） */
  snapshotMode?: boolean
  /** 読み取り専用（ロール判定） */
  isReadOnly?: boolean
  /** ユーザーのロール */
  userRole?: Role
  /** キャッシュ済みコメント（スナップショット用） */
  cachedComments?: Comment[]
  /** 初期表示時の開閉状態 */
  initialOpen?: boolean
  /** 初期表示時のサイドバー幅 */
  initialWidth?: number
}

const props = withDefaults(defineProps<Props>(), {
  snapshotMode: false,
  isReadOnly: false,
  cachedComments: () => [],
  initialOpen: false,
  initialWidth: DEFAULT_OPEN_WIDTH,
})

const emit = defineEmits<{
  (e: 'updated'): void
  (e: 'update:isOpen', value: boolean): void
  (e: 'update:width', value: number): void
}>()

const isOpen = ref(props.initialOpen)
const sidebarWidth = ref(props.initialWidth >= MIN_WIDTH ? props.initialWidth : DEFAULT_OPEN_WIDTH)
const comments = ref<Comment[]>([])
const newComment = ref('')
const isLoading = ref(false)
const isSending = ref(false)
const isResizing = ref(false)
let fetchedAt = 0

const isDark = computed(() => theme.current.value.dark)

const sidebarBaseStyle = computed(() => {
  return isDark.value
    ? {
        backgroundColor: '#0f172a',
        borderColor: '#263040',
      }
    : {
        backgroundColor: '#f1f5f9',
        borderColor: '#cbd5e1',
      }
})

const currentWidth = computed(() => (isOpen.value ? sidebarWidth.value : CLOSED_WIDTH))

const toggle = () => {
  isOpen.value = !isOpen.value
  emit('update:isOpen', isOpen.value)
  emit('update:width', currentWidth.value)
}

// --- ドラッグリサイズ ---
let startX = 0
let startWidth = 0

const onResizeStart = (e: MouseEvent) => {
  e.preventDefault()
  e.stopPropagation()
  isResizing.value = true
  startX = e.clientX
  startWidth = sidebarWidth.value
  document.addEventListener('mousemove', onResizeMove)
  document.addEventListener('mouseup', onResizeEnd)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

const onResizeMove = (e: MouseEvent) => {
  // 右端サイドバーなので、左にドラッグ→幅が広がる
  const delta = startX - e.clientX
  const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta))
  sidebarWidth.value = newWidth
  emit('update:width', newWidth)
}

const onResizeEnd = () => {
  isResizing.value = false
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
})

// --- コメントデータ管理 ---
const loadComments = async () => {
  if (!props.projectId) return
  if (props.snapshotMode && props.cachedComments.length > 0) {
    comments.value = props.cachedComments
    return
  }
  if (Date.now() - fetchedAt < 60000 && comments.value.length > 0) return
  isLoading.value = true
  try {
    comments.value = await selectComments({ projectId: props.projectId })
    fetchedAt = Date.now()
  } catch (err) {
    console.error('Failed to load project comments:', err)
  } finally {
    isLoading.value = false
  }
}

const addComment = async () => {
  if (!newComment.value.trim()) return
  isSending.value = true
  try {
    await upsertComment({
      id: 0,
      content: newComment.value.trim(),
      projectId: props.projectId,
    })
    newComment.value = ''
    fetchedAt = 0
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
    fetchedAt = 0
    await loadComments()
    emit('updated')
  } catch (err) {
    console.error('Failed to delete comment:', err)
  }
}

const canDeleteComment = (comment: Comment) => {
  if (props.isReadOnly || props.snapshotMode) return false
  if (props.userRole === 'owner') return true
  return comment.createdBy === userStore.currentUser?.email
}

const formatTime = (dateStr?: string) => {
  if (!dateStr) return ''
  return dayjs(dateStr).fromNow()
}

const invalidateCache = () => {
  fetchedAt = 0
  comments.value = []
}

watch(isOpen, (open) => {
  if (open) {
    loadComments()
  }
}, { immediate: true })

// 永続化された設定がロードされた後にpropsが変更されるのを検知
watch(
  () => props.initialOpen,
  (newVal) => {
    isOpen.value = newVal
  },
)

watch(
  () => props.initialWidth,
  (newVal) => {
    if (newVal >= MIN_WIDTH) {
      sidebarWidth.value = newVal
    }
  },
)

watch(
  () => props.projectId,
  () => {
    invalidateCache()
    if (isOpen.value) {
      loadComments()
    }
  },
)

watch(
  () => props.cachedComments,
  (cached) => {
    if (cached.length > 0) {
      comments.value = cached
      fetchedAt = Date.now()
    }
  },
)

defineExpose({ invalidateCache, loadComments, isOpen })
</script>

<template>
  <div
    class="project-comment-sidebar"
    :class="{ resizing: isResizing }"
    :style="{
      width: `${currentWidth}px`,
      padding: isOpen ? '16px 16px 16px 20px' : '0',
      ...sidebarBaseStyle,
    }"
  >
    <!-- リサイズハンドル -->
    <div
      v-if="isOpen"
      class="resize-handle"
      @mousedown="onResizeStart"
    />

    <h3 class="sidebar-header" :class="{ open: isOpen }" @click="toggle">
      <v-icon>
        {{ isOpen ? 'mdi-chevron-right' : 'mdi-chevron-left' }}
      </v-icon>
      <v-icon size="18">mdi-comment-text-outline</v-icon>
      <span>コメント</span>
      <v-chip
        v-if="commentCount > 0 && !isOpen"
        size="x-small"
        variant="tonal"
        color="primary"
        class="comment-badge"
      >
        {{ commentCount }}
      </v-chip>
    </h3>

    <div v-if="isOpen" class="sidebar-content">
      <!-- 新規コメント入力 -->
      <div v-if="!isReadOnly && !snapshotMode" class="comment-input-area">
        <v-textarea
          v-model="newComment"
          placeholder="コメントを入力..."
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

      <!-- ローディング -->
      <v-progress-linear v-if="isLoading" indeterminate color="primary" class="mb-2" />

      <!-- コメント一覧 -->
      <div v-if="!isLoading && comments.length === 0" class="empty-message">
        コメントはまだありません
      </div>

      <div v-else class="comment-list">
        <div v-for="comment in comments" :key="comment.id" class="comment-item">
          <div class="d-flex align-start" style="gap: 8px; width: 100%">
            <UserAvatar
              size="28"
              color="grey-darken-1"
              class="mt-1 flex-shrink-0"
              :url="comment.createdByPhotoURL"
              :name="comment.createdByDisplayName || comment.createdBy"
            />
            <div style="flex: 1; min-width: 0">
              <div class="d-flex align-center" style="gap: 4px">
                <span class="text-caption font-weight-bold text-truncate" style="min-width: 0">
                  {{ comment.createdByDisplayName || comment.createdBy || '不明' }}
                </span>
                <v-spacer />
                <span class="text-caption text-medium-emphasis" style="white-space: nowrap">
                  {{ formatTime(comment.createdAt) }}
                </span>
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
              <div class="text-body-2 mt-1 comment-content">
                {{ comment.content }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.project-comment-sidebar {
  position: fixed;
  right: 0;
  top: 64px;
  bottom: 0;
  border-left: 1px solid transparent;
  transition:
    width 0.3s ease,
    padding 0.3s ease;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  z-index: 10;
}

/* ドラッグ中はtransitionを無効化してスムーズにリサイズ */
.project-comment-sidebar.resizing {
  transition: none;
}

.resize-handle {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
  z-index: 20;
  transition: background-color 0.15s ease;
}

.resize-handle:hover,
.resize-handle:active {
  background-color: rgba(var(--v-theme-primary), 0.3);
}

.sidebar-header {
  margin: 0;
  padding: 10px;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  font-size: 14px;
  cursor: pointer;
  user-select: none;
  writing-mode: vertical-rl;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
}

.sidebar-header.open {
  padding: 0 0 8px 0;
  height: auto;
  writing-mode: horizontal-tb;
  gap: 6px;
  font-size: 16px;
}

.comment-badge {
  writing-mode: horizontal-tb;
}

.sidebar-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  flex-grow: 1;
}

.comment-input-area {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  margin-bottom: 4px;
}

.comment-list {
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-grow: 1;
}

.comment-item {
  padding: 8px;
  border-radius: 6px;
  transition: background-color 0.15s ease;
}

.comment-item:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.04);
}

.comment-item .delete-btn {
  opacity: 0;
  transition: opacity 0.15s ease;
}

.comment-item:hover .delete-btn {
  opacity: 1;
}

.comment-content {
  white-space: pre-wrap;
  word-break: break-word;
}

.empty-message {
  text-align: center;
  opacity: 0.5;
  font-size: 14px;
  padding: 20px;
}
</style>
