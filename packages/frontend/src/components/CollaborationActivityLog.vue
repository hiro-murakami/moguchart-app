<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useTheme } from 'vuetify'
import type { ActivityLogEntry } from '@/composables/useCollaboration'

const theme = useTheme()
const isDark = computed(() => theme.current.value.dark)

const props = defineProps<{
  logs: ActivityLogEntry[]
}>()

/** パネルの開閉状態 */
const isExpanded = ref(false)

/** 相対時間の再計算用タイマーtick */
const tick = ref(0)
let tickTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  tickTimer = setInterval(() => {
    tick.value++
  }, 10_000)
})

onUnmounted(() => {
  if (tickTimer) {
    clearInterval(tickTimer)
    tickTimer = null
  }
})

/** 相対時間を返す */
const relativeTime = (timestamp: string): string => {
  // tick を参照してリアクティブに再計算させる
  void tick.value
  const diff = Date.now() - new Date(timestamp).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 5) return 'たった今'
  if (seconds < 60) return `${seconds}秒前`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}分前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}時間前`
  const days = Math.floor(hours / 24)
  return `${days}日前`
}

const visibleLogs = computed(() => {
  return props.logs.slice(0, 20)
})

const unreadCount = computed(() => {
  if (isExpanded.value) return 0
  // 直近30秒以内の新着ログ数を返す
  const threshold = Date.now() - 30_000
  void tick.value
  return props.logs.filter((log) => new Date(log.timestamp).getTime() > threshold).length
})
</script>

<template>
  <Transition name="log-panel">
    <div v-if="logs.length > 0" class="activity-log-container" :class="{ expanded: isExpanded, 'is-dark': isDark }">
      <!-- ヘッダーバー（常に表示） -->
      <button class="log-header" @click="isExpanded = !isExpanded">
        <v-icon :icon="isExpanded ? 'mdi-chevron-down' : 'mdi-chevron-up'" size="18" class="mr-1" />
        <v-icon icon="mdi-history" size="18" class="mr-2" />
        <span class="log-header-title">変更履歴</span>
        <span v-if="unreadCount > 0" class="unread-badge">{{ unreadCount }}</span>
        <v-spacer />
        <span class="log-header-count">{{ logs.length }}件</span>
      </button>

      <!-- ログ一覧（展開時のみ表示） -->
      <Transition name="log-list">
        <div v-if="isExpanded" class="log-list">
          <TransitionGroup name="log-item" tag="div" class="log-items">
            <div v-for="log in visibleLogs" :key="log.id" class="log-entry">
              <v-avatar :color="log.color" size="28" class="log-avatar">
                <img
                  v-if="log.avatarUrl"
                  :src="log.avatarUrl"
                  style="width: 100%; height: 100%; object-fit: cover"
                  :alt="log.displayName"
                />
                <span v-if="!log.avatarUrl" class="text-white text-caption font-weight-bold">
                  {{ log.displayName.charAt(0).toUpperCase() }}
                </span>
              </v-avatar>
              <div class="log-content">
                <div class="log-user-line">
                  <span class="log-user-name">{{ log.displayName }}</span>
                  <span class="log-time">{{ relativeTime(log.timestamp) }}</span>
                </div>
                <div class="log-description">{{ log.description }}</div>
              </div>
            </div>
          </TransitionGroup>
          <div v-if="logs.length > 20" class="log-more">他 {{ logs.length - 20 }}件の変更</div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<style scoped>
.activity-log-container {
  position: fixed;
  bottom: 16px;
  right: 16px;
  width: 340px;
  z-index: 1000;
  border-radius: 12px;
  overflow: hidden;
  background: rgba(250, 250, 250, 0.95);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.1),
    0 1px 4px rgba(0, 0, 0, 0.05);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  color: #333;
}

.activity-log-container.is-dark {
  background: rgba(38, 38, 38, 0.94);
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.4),
    0 2px 8px rgba(0, 0, 0, 0.25);
  color: #e0e0e0;
}

.log-header {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 10px 14px;
  border: none;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: inherit;
  background: transparent;
  transition: background-color 0.15s;
}

.log-header:hover {
  background: rgba(128, 128, 128, 0.08);
}

.log-header-title {
  white-space: nowrap;
}

.log-header-count {
  font-size: 11px;
  font-weight: 500;
  opacity: 0.5;
  white-space: nowrap;
}

.unread-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  background: #ef5350;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  padding: 0 5px;
  margin-left: 6px;
  line-height: 1;
  animation: badge-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes badge-pop {
  0% {
    transform: scale(0);
  }
  100% {
    transform: scale(1);
  }
}

.log-list {
  max-height: 320px;
  overflow-y: auto;
  border-top: 1px solid rgba(128, 128, 128, 0.12);
}

.log-list::-webkit-scrollbar {
  width: 4px;
}

.log-list::-webkit-scrollbar-thumb {
  background: rgba(128, 128, 128, 0.25);
  border-radius: 2px;
}

.log-items {
  padding: 4px 0;
}

.log-entry {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 14px;
  transition: background-color 0.15s;
}

.log-entry:hover {
  background: rgba(128, 128, 128, 0.06);
}

.log-avatar {
  flex-shrink: 0;
  margin-top: 2px;
}

.log-content {
  flex: 1;
  min-width: 0;
  line-height: 1.3;
}

.log-user-line {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 2px;
}

.log-user-name {
  font-size: 12px;
  font-weight: 600;
  color: inherit;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
}

.log-time {
  font-size: 11px;
  color: inherit;
  opacity: 0.45;
  white-space: nowrap;
  flex-shrink: 0;
}

.log-description {
  font-size: 12px;
  color: inherit;
  opacity: 0.65;
}

.log-more {
  text-align: center;
  font-size: 11px;
  padding: 6px 0 10px;
  opacity: 0.4;
}

/* --- Transitions --- */

.log-panel-enter-active {
  animation: slide-up 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.log-panel-leave-active {
  animation: slide-up 0.25s ease reverse;
}

@keyframes slide-up {
  0% {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.log-list-enter-active {
  transition: all 0.25s ease;
}
.log-list-leave-active {
  transition: all 0.2s ease;
}
.log-list-enter-from {
  max-height: 0;
  opacity: 0;
}
.log-list-leave-to {
  max-height: 0;
  opacity: 0;
}

.log-item-enter-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.log-item-leave-active {
  transition: all 0.2s ease;
}
.log-item-enter-from {
  opacity: 0;
  transform: translateX(-10px);
}
.log-item-leave-to {
  opacity: 0;
  transform: translateX(10px);
}
.log-item-move {
  transition: transform 0.3s ease;
}
</style>
