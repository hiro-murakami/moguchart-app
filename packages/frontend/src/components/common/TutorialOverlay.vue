<script setup lang="ts">
import type { TutorialKey } from '@functions/types/shared'
import { useTutorialOverlay } from './composables/useTutorialOverlay'

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

const {
  isDark,
  targetRect,
  dontShowAgain,
  isVisible,
  targetId,
  setActivatorRef,
  close,
  spotlightParams,
  overlayPath,
  messageContainerStyle,
} = useTutorialOverlay(props, emit)
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
