import { ref, computed, nextTick, watch, onUnmounted, getCurrentInstance, inject, type Ref } from 'vue'
import { useTheme } from 'vuetify'
import { useTutorial } from '@/composables/useTutorial'
import type { TutorialKey } from '@functions/types/shared'

export interface UseTutorialOverlayProps {
  condition?: boolean
  tutorialKey: TutorialKey
  placement?: 'top' | 'bottom' | 'left' | 'right'
}

export function useTutorialOverlay(props: UseTutorialOverlayProps, emit: (event: 'close') => void) {
  const theme = useTheme()
  const isDark = computed(() => theme.current.value.dark)

  /** 公開閲覧モードではチュートリアルを表示しない */
  const isPublicViewMode = inject<Ref<boolean>>('isPublicViewMode', ref(false))

  const targetRect = ref<DOMRect | null>(null)
  const activatorNode = ref<HTMLElement | null>(null)
  const dontShowAgain = ref(false)
  const { isCompleted, complete, registerTutorial, unregisterTutorial, currentActiveTutorial } = useTutorial()

  const manualDismissed = ref(false)
  const isEligible = computed(() => {
    return props.condition && !isCompleted(props.tutorialKey) && !manualDismissed.value && !isPublicViewMode.value
  })

  watch(
    isEligible,
    (eligible) => {
      if (eligible) {
        registerTutorial(props.tutorialKey)
      } else {
        unregisterTutorial(props.tutorialKey)
      }
    },
    { immediate: true }
  )

  const isVisible = computed(() => {
    return isEligible.value && currentActiveTutorial.value === props.tutorialKey
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
    rAFId = window.requestAnimationFrame(trackPosition)
  }

  function handleKeydown(e: KeyboardEvent) {
    if (isVisible.value) {
      e.stopPropagation()
      e.preventDefault()
    }
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
          window.cancelAnimationFrame(rAFId)
          rAFId = null
        }
        window.removeEventListener('keydown', handleKeydown, true)
      }
    },
    { immediate: true },
  )

  onUnmounted(() => {
    unregisterTutorial(props.tutorialKey)
    if (rAFId !== null) window.cancelAnimationFrame(rAFId)
    window.removeEventListener('keydown', handleKeydown, true)
  })

  const close = async () => {
    manualDismissed.value = true
    if (dontShowAgain.value) {
      await complete(props.tutorialKey)
    }
    emit('close')
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
    const boxWidth = 350
    const windowWidth = window.innerWidth
    const windowHeight = window.innerHeight

    const styles: Record<string, string | number> = {
      position: 'fixed',
      zIndex: 9999,
      width: `${boxWidth}px`,
      maxWidth: `calc(100vw - ${margin * 2}px)`,
      maxHeight: `calc(100vh - ${margin * 2}px)`,
      overflowY: 'auto'
    }

    const placement = props.placement || 'bottom'

    // 横方向の調整 (top/bottom用)
    const centerX = left + width / 2
    let adjustedLeft = centerX - boxWidth / 2
    if (adjustedLeft < margin) {
      adjustedLeft = margin
    } else if (adjustedLeft + boxWidth > windowWidth - margin) {
      adjustedLeft = windowWidth - margin - boxWidth
    }

    // 縦方向の調整 (left/right用)
    // 高さは可変なので推定値（150px）を使用
    const estimatedHeight = 150
    const centerY = top + height / 2
    let adjustedTop = centerY - estimatedHeight / 2
    if (adjustedTop < margin) {
      adjustedTop = margin
    } else if (adjustedTop + estimatedHeight > windowHeight - margin) {
      adjustedTop = windowHeight - margin - estimatedHeight
    }

    switch (placement) {
      case 'top':
        styles.top = `${top - margin}px`
        styles.left = `${adjustedLeft}px`
        styles.transform = 'translate(0, -100%)'
        break
      case 'left':
        styles.top = `${adjustedTop}px`
        styles.left = `${left - margin}px`
        styles.transform = 'translate(-100%, 0)'
        break
      case 'right':
        styles.top = `${adjustedTop}px`
        styles.left = `${left + width + margin}px`
        styles.transform = 'none'
        break
      case 'bottom':
      default:
        styles.top = `${top + height + margin}px`
        styles.left = `${adjustedLeft}px`
        styles.transform = 'none'
        break
    }

    return styles
  })

  return {
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
  }
}
