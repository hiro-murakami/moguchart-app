<script setup lang="ts">
import { ref, computed, nextTick, watch, onUnmounted, getCurrentInstance } from 'vue'
import { useTheme } from 'vuetify'
import { useTutorial } from '@/composables/useTutorial'
import type { TutorialKey } from '@functions/types/shared'

const props = withDefaults(
  defineProps<{
    condition?: boolean
    tutorialKey: TutorialKey
    title?: string
    message: string
    placement?: 'top' | 'bottom' | 'left' | 'right'
  }>(),
  {
    condition: true,
  },
)

const emit = defineEmits<{
  (e: 'close'): void
}>()

const theme = useTheme()
const isDark = computed(() => theme.current.value.dark)

const targetRect = ref<DOMRect | null>(null)
const activatorNode = ref<HTMLElement | null>(null)
const dontShowAgain = ref(false)
const { isCompleted, complete } = useTutorial()

const manualDismissed = ref(false)
const isVisible = computed(() => {
  return props.condition && !isCompleted(props.tutorialKey) && !manualDismissed.value
})

watch(
  () => props.condition,
  (newVal) => {
    if (!newVal) {
      manualDismissed.value = false
    }
  },
)

const targetId = `tutorial-${getCurrentInstance()?.uid || Math.random().toString(36).slice(2)}`

const setActivatorRef = (el: any) => {
  activatorNode.value = el || null
}

const getDOMElement = (node: any): Element | null => {
  // 1. 属性で検索して確実に対象を取得する（Vueコンポーネントラップで$elが変なノードになるのを防ぐ）
  const elByAttr = document.querySelector(`[data-tutorial-id="${targetId}"]`)
  if (elByAttr) return elByAttr

  // 以下フォールバック
  if (!node) return null
  if (typeof node.getBoundingClientRect === 'function') return node
  // コンポーネント内のDOM要素を探す
  if (node.$el) {
    if (typeof node.$el.getBoundingClientRect === 'function') return node.$el
    // v-tooltip等で中身がフラグメント/テキストノードになっている場合への安全なフォールバック
    if (node.$el.nextElementSibling && typeof node.$el.nextElementSibling.getBoundingClientRect === 'function') {
      return node.$el.nextElementSibling
    }
  }
  return null
}

let rAFId: number | null = null

const updateTargetRect = () => {
  if (!isVisible.value) return
  const el = getDOMElement(activatorNode.value)
  if (el) {
    const rect = el.getBoundingClientRect()
    // Compare values to avoid unnecessary reactivity
    if (
      !targetRect.value ||
      rect.x !== targetRect.value.x ||
      rect.y !== targetRect.value.y ||
      rect.width !== targetRect.value.width ||
      rect.height !== targetRect.value.height
    ) {
      targetRect.value = rect
    }
  }
}

const trackPosition = () => {
  if (!isVisible.value) return
  updateTargetRect()
  rAFId = requestAnimationFrame(trackPosition)
}

watch(
  isVisible,
  async (newVal) => {
    if (newVal) {
      dontShowAgain.value = false
      await nextTick()
      trackPosition()
      window.addEventListener('keydown', handleKeydown, true)
    } else {
      if (rAFId !== null) {
        cancelAnimationFrame(rAFId)
        rAFId = null
      }
      window.removeEventListener('keydown', handleKeydown, true)
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  if (rAFId !== null) cancelAnimationFrame(rAFId)
  window.removeEventListener('keydown', handleKeydown, true)
})

const close = async () => {
  manualDismissed.value = true
  if (dontShowAgain.value) {
    await complete(props.tutorialKey)
  }
  emit('close')
}

function handleKeydown(e: KeyboardEvent) {
  if (isVisible.value) {
    e.stopPropagation()
    e.preventDefault()
  }
}

// Spotlight parameters
const spotlightParams = computed(() => {
  if (!targetRect.value) return { centerX: 0, centerY: 0, radius: 0 }
  const { top, left, width, height } = targetRect.value
  const centerX = left + width / 2
  const centerY = top + height / 2
  const radius = Math.max(width, height) / 2 + 10 // Add some padding
  return { centerX, centerY, radius }
})

// SVG Path for the overlay (dimmed background with a hole)
const overlayPath = computed(() => {
  if (!targetRect.value) return ''
  const { centerX, centerY, radius } = spotlightParams.value
  const windowWidth = window.innerWidth
  const windowHeight = window.innerHeight

  return `M0,0 H${windowWidth} V${windowHeight} H0 Z M${centerX},${centerY} m-${radius},0 a${radius},${radius} 0 1,0 ${radius * 2},0 a${radius},${radius} 0 1,0 -${radius * 2},0 Z`
})

// Message box style
const messageContainerStyle = computed(() => {
  if (!targetRect.value) return { display: 'none' }

  const { top, left, width, height } = targetRect.value
  const margin = 12

  const styles: Record<string, string | number> = {
    position: 'fixed',
    zIndex: 9999,
    maxWidth: '300px',
  }

  const placement = props.placement || 'bottom'

  switch (placement) {
    case 'top':
      styles.top = `${top - margin}px`
      styles.left = `${left + width / 2}px`
      styles.transform = 'translate(-50%, -100%)'
      break
    case 'left':
      styles.top = `${top + height / 2}px`
      styles.left = `${left - margin}px`
      styles.transform = 'translate(-100%, -50%)'
      break
    case 'right':
      styles.top = `${top + height / 2}px`
      styles.left = `${left + width + margin}px`
      styles.transform = 'translate(0, -50%)'
      break
    case 'bottom':
    default:
      styles.top = `${top + height + margin}px`
      styles.left = `${left + width / 2}px`
      styles.transform = 'translate(-50%, 0)'
      break
  }

  return styles
})
</script>

<template>
  <slot name="activator" :props="{ ref: setActivatorRef, 'data-tutorial-id': targetId }"></slot>
  <teleport to="body">
    <div v-if="isVisible" class="tutorial-overlay-container">
      <!-- SVG Overlay -->
      <svg class="tutorial-svg-overlay">
        <path :d="overlayPath" fill="rgba(0, 0, 0, 0.8)" fill-rule="evenodd" />
        <circle
          v-if="targetRect"
          :cx="spotlightParams.centerX"
          :cy="spotlightParams.centerY"
          :r="spotlightParams.radius"
          fill="none"
          stroke="white"
          stroke-width="2"
          stroke-dasharray="4 4"
          class="spotlight-ring"
        />
      </svg>

      <!-- Message Box -->
      <div v-if="targetRect" :style="messageContainerStyle" class="tutorial-message-box">
        <v-card
          class="elevation-8 rounded-lg pa-4"
          :class="{ 'tutorial-card-dark': isDark }"
          :theme="isDark ? 'dark' : 'light'"
        >
          <v-card-title v-if="title" class="text-subtitle-1 pb-1 px-0 pt-0 font-weight-bold">
            {{ title }}
          </v-card-title>
          <v-card-text class="pt-2 pb-0 px-0">
            {{ message }}
          </v-card-text>
          <v-card-actions class="px-0 pb-0 pt-4 align-center">
            <v-checkbox
              v-model="dontShowAgain"
              label="再表示しない"
              density="compact"
              hide-details
              color="primary"
              class="ma-0 pa-0"
            ></v-checkbox>
            <v-spacer></v-spacer>
            <v-btn
              :color="isDark ? 'teal-accent-3' : 'primary'"
              size="small"
              variant="flat"
              class="px-4"
              @click="close"
            >
              OK
            </v-btn>
          </v-card-actions>
        </v-card>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
.tutorial-overlay-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9998; /* High z-index but below very top system alerts if any */
  pointer-events: none; /* Let clicks pass through the container... */
}

.tutorial-svg-overlay {
  width: 100%;
  height: 100%;
  pointer-events: none; /* Let clicks pass through the SVG box */
}

.tutorial-svg-overlay path {
  pointer-events: auto; /* Capture clicks on the filled part (the dimmed area) */
  cursor: default;
}

.tutorial-message-box {
  pointer-events: auto; /* Allow interaction with the message box */
}

.spotlight-ring {
  animation: spotlight-pulse 2s infinite ease-in-out;
}

@keyframes spotlight-pulse {
  0% {
    stroke-width: 2;
    stroke-opacity: 1;
  }
  50% {
    stroke-width: 3;
    stroke-opacity: 0.7;
  }
  100% {
    stroke-width: 2;
    stroke-opacity: 1;
  }
}

.tutorial-card-dark {
  background-color: #1e293b !important; /* 深みのあるブルー（Slate 800相当） */
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  color: white !important;
}
</style>
