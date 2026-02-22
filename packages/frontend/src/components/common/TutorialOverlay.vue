<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useTheme } from 'vuetify'
import type { TutorialOptions } from '@/composables/useTutorial'

const theme = useTheme()
const isDark = computed(() => theme.current.value.dark)

const isOpen = ref(false)
const state = ref<TutorialOptions>({
  target: '',
  message: '',
  title: '',
  placement: 'bottom',
})

let resolvePromise: ((value: void) => void) | null = null
const targetRect = ref<DOMRect | null>(null)

const updateTargetRect = () => {
  if (!isOpen.value) return

  let element: HTMLElement | null = null
  if (typeof state.value.target === 'string') {
    element = document.querySelector(state.value.target)
  } else {
    element = state.value.target
  }

  if (element) {
    targetRect.value = element.getBoundingClientRect()
  } else {
    targetRect.value = null
  }
}

const open = async (options: TutorialOptions) => {
  state.value = { ...options }
  isOpen.value = true

  await nextTick()
  updateTargetRect()

  window.addEventListener('resize', updateTargetRect)
  window.addEventListener('scroll', updateTargetRect, true)
  window.addEventListener('keydown', handleKeydown, true)

  return new Promise<void>((resolve) => {
    resolvePromise = resolve
  })
}

const close = () => {
  isOpen.value = false
  window.removeEventListener('resize', updateTargetRect)
  window.removeEventListener('scroll', updateTargetRect, true)
  window.removeEventListener('keydown', handleKeydown, true)
  resolvePromise?.()
}

const handleKeydown = (e: KeyboardEvent) => {
  if (isOpen.value) {
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

  // Create a path that covers the whole screen and has a hole for the target
  // using fill-rule="evenodd" (M ... Z for outer rect, M ... Z for inner hole)
  return `M0,0 H${windowWidth} V${windowHeight} H0 Z M${centerX},${centerY} m-${radius},0 a${radius},${radius} 0 1,0 ${radius * 2},0 a${radius},${radius} 0 1,0 -${radius * 2},0 Z`
})

// Message box style... (rest of logic remains similar, but using spotlightParams for consistency if needed)
// Actually, I'll keep the message style logic as is for now but clean up if needed.
// Wait, I see messageContainerStyle below lines 114-152. I'll just keep that part.

// Message box style
const messageContainerStyle = computed(() => {
  if (!targetRect.value) return { display: 'none' }

  const { top, left, width, height } = targetRect.value
  const margin = 12

  const styles: any = {
    position: 'fixed',
    zIndex: 9999,
    maxWidth: '300px',
  }

  // Basic placement logic
  switch (state.value.placement) {
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

defineExpose({ open, close })
</script>

<template>
  <teleport to="body">
    <div v-if="isOpen" class="tutorial-overlay-container">
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
          <v-card-title v-if="state.title" class="text-subtitle-1 pb-1 px-0 pt-0 font-weight-bold">
            {{ state.title }}
          </v-card-title>
          <v-card-text class="pt-2 pb-0 px-0">
            {{ state.message }}
          </v-card-text>
          <v-card-actions class="px-0 pb-0 pt-2">
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
