import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useTheme } from 'vuetify'
import type { ActivityLogEntry } from '@/composables/useCollaboration'

export interface UseCollaborationActivityLogProps {
  logs: ActivityLogEntry[]
}

export function useCollaborationActivityLog(props: UseCollaborationActivityLogProps) {
  const theme = useTheme()
  const isDark = computed(() => theme.current.value.dark)

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

  return {
    isDark,
    isExpanded,
    relativeTime,
    visibleLogs,
    unreadCount,
  }
}
