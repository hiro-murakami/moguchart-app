import type { Directive, DirectiveBinding } from 'vue'

interface DraggableState {
  handleEl: HTMLElement | null
  overlayContentEl: HTMLElement | null
  offsetX: number
  offsetY: number
  translateX: number
  translateY: number
  isDragging: boolean
  onMouseDown: (e: MouseEvent | TouchEvent) => void
  onMouseMove: (e: MouseEvent | TouchEvent) => void
  onMouseUp: (e: MouseEvent | TouchEvent) => void
  setupObserver: MutationObserver | null
  /** overlay の active 状態を監視して開閉時に位置リセットする Observer */
  overlayObserver: MutationObserver | null
}

const stateMap = new WeakMap<HTMLElement, DraggableState>()

/**
 * v-card-title 要素をドラッグハンドルとして検出し、
 * 親の .v-overlay__content を移動させるディレクティブ
 */
function setupDraggable(el: HTMLElement): void {
  const existing = stateMap.get(el)
  if (existing?.handleEl) return

  const handleEl = el.querySelector<HTMLElement>('.v-card-title')
  if (!handleEl) return

  // .v-overlay__content を探す
  const overlayContentEl = el.closest<HTMLElement>('.v-overlay__content')
  if (!overlayContentEl) return

  const state: DraggableState = {
    handleEl,
    overlayContentEl,
    offsetX: 0,
    offsetY: 0,
    translateX: 0,
    translateY: 0,
    isDragging: false,
    setupObserver: null,
    overlayObserver: null,
    onMouseDown: () => {},
    onMouseMove: () => {},
    onMouseUp: () => {},
  }

  // ドラッグハンドルのカーソルスタイル
  handleEl.style.cursor = 'grab'
  handleEl.style.userSelect = 'none'

  function getClientPos(e: MouseEvent | TouchEvent): { clientX: number; clientY: number } {
    if ('touches' in e) {
      const touch = e.touches[0] ?? e.changedTouches[0]
      return { clientX: touch?.clientX ?? 0, clientY: touch?.clientY ?? 0 }
    }
    return { clientX: e.clientX, clientY: e.clientY }
  }

  state.onMouseDown = (e: MouseEvent | TouchEvent) => {
    // テキスト入力やボタンなど操作可能な要素からのドラッグは無視
    const target = e.target as HTMLElement
    if (target.closest('input, textarea, select, button, .v-btn, a, [contenteditable]')) {
      return
    }

    e.preventDefault()
    state.isDragging = true

    const pos = getClientPos(e)
    state.offsetX = pos.clientX - state.translateX
    state.offsetY = pos.clientY - state.translateY

    handleEl.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'

    document.addEventListener('mousemove', state.onMouseMove)
    document.addEventListener('mouseup', state.onMouseUp)
    document.addEventListener('touchmove', state.onMouseMove, { passive: false })
    document.addEventListener('touchend', state.onMouseUp)
  }

  state.onMouseMove = (e: MouseEvent | TouchEvent) => {
    if (!state.isDragging || !overlayContentEl) return
    e.preventDefault()

    const pos = getClientPos(e)
    let newX = pos.clientX - state.offsetX
    let newY = pos.clientY - state.offsetY

    // 画面境界でクランプ
    const rect = overlayContentEl.getBoundingClientRect()
    const dialogWidth = rect.width
    const dialogHeight = rect.height
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    // 現在の中央位置（translate前）
    const baseCenterX = (viewportWidth - dialogWidth) / 2
    const baseCenterY = (viewportHeight - dialogHeight) / 2

    // ダイアログの左上座標が画面外に出ないようにクランプ
    const minX = -baseCenterX
    const maxX = viewportWidth - dialogWidth - baseCenterX
    const minY = -baseCenterY
    const maxY = viewportHeight - dialogHeight - baseCenterY

    newX = Math.max(minX, Math.min(maxX, newX))
    newY = Math.max(minY, Math.min(maxY, newY))

    state.translateX = newX
    state.translateY = newY

    overlayContentEl.style.transform = `translate(${newX}px, ${newY}px)`
  }

  state.onMouseUp = (_e: MouseEvent | TouchEvent) => {
    state.isDragging = false
    handleEl.style.cursor = 'grab'
    document.body.style.userSelect = ''

    document.removeEventListener('mousemove', state.onMouseMove)
    document.removeEventListener('mouseup', state.onMouseUp)
    document.removeEventListener('touchmove', state.onMouseMove)
    document.removeEventListener('touchend', state.onMouseUp)
  }

  handleEl.addEventListener('mousedown', state.onMouseDown)
  handleEl.addEventListener('touchstart', state.onMouseDown, { passive: false })

  // overlay の active 状態を監視し、「非表示→表示」の時だけ位置をリセット
  const overlayEl = overlayContentEl.closest<HTMLElement>('.v-overlay')
  if (overlayEl) {
    state.overlayObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const isActive = overlayEl.classList.contains('v-overlay--active')
          if (isActive) {
            // ダイアログが表示されたとき → 位置リセット
            state.translateX = 0
            state.translateY = 0
            overlayContentEl.style.transform = ''
          }
        }
      }
    })
    state.overlayObserver.observe(overlayEl, { attributes: true, attributeFilter: ['class'] })
  }

  stateMap.set(el, state)
}

function cleanupDraggable(el: HTMLElement): void {
  const state = stateMap.get(el)
  if (!state) return

  if (state.handleEl) {
    state.handleEl.removeEventListener('mousedown', state.onMouseDown)
    state.handleEl.removeEventListener('touchstart', state.onMouseDown)
    state.handleEl.style.cursor = ''
    state.handleEl.style.userSelect = ''
  }

  document.removeEventListener('mousemove', state.onMouseMove)
  document.removeEventListener('mouseup', state.onMouseUp)
  document.removeEventListener('touchmove', state.onMouseMove)
  document.removeEventListener('touchend', state.onMouseUp)

  if (state.setupObserver) {
    state.setupObserver.disconnect()
  }
  if (state.overlayObserver) {
    state.overlayObserver.disconnect()
  }

  stateMap.delete(el)
}

export const draggableDialog: Directive = {
  mounted(el: HTMLElement, _binding: DirectiveBinding) {
    // Vuetify のダイアログは非同期でDOMを生成するため、
    // MutationObserver で v-card-title の出現を待つ
    const trySetup = () => {
      setupDraggable(el)
    }

    // 即座に試行
    trySetup()

    // まだ設定されていなければ Observer で監視
    if (!stateMap.get(el)?.handleEl) {
      const observer = new MutationObserver(() => {
        trySetup()
        const state = stateMap.get(el)
        if (state?.handleEl) {
          observer.disconnect()
        }
      })
      observer.observe(el, { childList: true, subtree: true })

      // observer を保存（cleanup用）
      const state = stateMap.get(el) || ({} as DraggableState)
      state.setupObserver = observer
      stateMap.set(el, state)
    }
  },

  updated(el: HTMLElement) {
    // ハンドルが未設定の場合のみ再試行（位置リセットはしない）
    const state = stateMap.get(el)
    if (!state?.handleEl) {
      setupDraggable(el)
    }
  },

  unmounted(el: HTMLElement) {
    cleanupDraggable(el)
  },
}

