import dayjs from 'dayjs'
import { getContrastColor, toDateString } from '@/modules/utils'
import * as moguchart from '@mogura/moguchart-core'
import { selectTaskComments, selectComments } from '@/modules/scripts'
import type { Comment } from '@functions/types/shared'
import { UNLABELED_VALUE } from '@/modules/constants'
import { getCachedImageUrl, setImageSrc } from '@/modules/imageCache'

const commentsCache = new Map<number, { data: Comment[]; fetchedAt: number }>()
const rowCommentsCache = new Map<number, { data: Comment[]; fetchedAt: number }>()

/** ダークモード判定に基づくツールチップの配色を返す */
const getTooltipColors = () => {
  const isDark = !!document.querySelector('.v-theme--dark')
  // ライトモード→黒ベース、ダークモード→白ベース
  const bg = isDark ? '#fff' : '#212121'
  const text = isDark ? 'rgba(0,0,0,0.87)' : 'rgba(255,255,255,0.87)'
  const textMuted = isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)'
  const textStrong = isDark ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.9)'
  const border = isDark ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.15)'
  const divider = isDark ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.12)'
  return { bg, text, textMuted, textStrong, border, divider }
}

/** ツールチップの表示位置を画面内に収まるよう調整する */
const adjustTooltipPosition = (tooltipEl: HTMLElement, anchorRect: DOMRect) => {
  const margin = 6
  // まず一旦デフォルト位置（アンカーの下側）で配置
  let left = anchorRect.left
  let top = anchorRect.bottom + 4

  // DOM追加後に実際のサイズを取得
  const elRect = tooltipEl.getBoundingClientRect()

  // 右端はみ出し
  if (left + elRect.width > window.innerWidth - margin) {
    left = window.innerWidth - elRect.width - margin
  }
  // 左端はみ出し
  if (left < margin) {
    left = margin
  }
  // 下端はみ出し: アンカーの上側に表示
  if (top + elRect.height > window.innerHeight - margin) {
    top = anchorRect.top - elRect.height - 4
  }
  // 上端はみ出し
  if (top < margin) {
    top = margin
  }

  tooltipEl.style.left = `${left}px`
  tooltipEl.style.top = `${top}px`
}

/**
 * スナップショットモードなどAPI不要の場面で、コメントデータをキャッシュに事前ロードする。
 * fetchedAt を Infinity にすることでキャッシュ有効期限が切れないようにする。
 */
export const preloadCommentsCache = (entries: { taskId: number; comments: Comment[] }[]) => {
  for (const entry of entries) {
    commentsCache.set(entry.taskId, { data: entry.comments, fetchedAt: Infinity })
  }
}

/**
 * スナップショットモードなどAPI不要の場面で、行コメントデータをキャッシュに事前ロードする。
 * fetchedAt を Infinity にすることでキャッシュ有効期限が切れないようにする。
 */
export const preloadRowCommentsCache = (entries: { rowId: number; comments: Comment[] }[]) => {
  for (const entry of entries) {
    rowCommentsCache.set(entry.rowId, { data: entry.comments, fetchedAt: Infinity })
  }
}

const renderComments = (container: HTMLElement, comments: Comment[], count: number) => {
  const colors = getTooltipColors()
  container.innerHTML = ''
  container.style.display = 'flex'
  container.style.flexDirection = 'column'
  container.style.gap = '6px'

  const titleSpan = document.createElement('div')
  titleSpan.style.fontWeight = 'bold'
  titleSpan.style.color = colors.textStrong
  titleSpan.style.fontSize = '12px'
  titleSpan.textContent = `💬 コメント (${count}件)`
  container.appendChild(titleSpan)

  // 最大5件表示
  const displayComments = [...comments]
    .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
    .slice(-5)

  displayComments.forEach((c, i) => {
    const cDiv = document.createElement('div')
    cDiv.style.display = 'flex'
    cDiv.style.flexDirection = 'column'
    cDiv.style.gap = '1px'
    if (i > 0) {
      cDiv.style.borderTop = `1px solid ${colors.divider}`
      cDiv.style.paddingTop = '5px'
    }

    const headerDiv = document.createElement('div')
    headerDiv.style.fontSize = '10px'
    headerDiv.style.color = colors.textMuted
    headerDiv.style.marginBottom = '1px'
    const name = c.createdByDisplayName || '名無し'
    const time = c.createdAt ? dayjs(c.createdAt).format('YYYY/MM/DD HH:mm') : ''
    headerDiv.textContent = `${name} ${time}`

    const contentDiv = document.createElement('div')
    contentDiv.style.wordBreak = 'break-word'
    contentDiv.style.whiteSpace = 'pre-wrap'
    contentDiv.style.color = colors.textStrong
    // 100文字で制限
    const content = c.content.length > 100 ? c.content.slice(0, 100) + '...' : c.content
    contentDiv.textContent = content

    cDiv.appendChild(headerDiv)
    cDiv.appendChild(contentDiv)
    container.appendChild(cDiv)
  })

  if (comments.length > 5) {
    const moreDiv = document.createElement('div')
    moreDiv.style.fontSize = '10px'
    moreDiv.style.color = colors.textMuted
    moreDiv.style.textAlign = 'center'
    moreDiv.style.marginTop = '2px'
    moreDiv.style.borderTop = `1px solid ${colors.divider}`
    moreDiv.style.paddingTop = '4px'
    moreDiv.textContent = `他 ${comments.length - 5} 件のコメント...`
    container.appendChild(moreDiv)
  }
}

/**
 * テキスト中の検索キーワードにマッチした部分をハイライト表示する。
 * マッチ部分を <mark> スタイルの span 要素でラップした DocumentFragment を返す。
 */
const highlightText = (text: string, keywords: string[], parent: HTMLElement) => {
  if (!keywords || keywords.length === 0) {
    parent.textContent = text
    return
  }

  // 正規表現の特殊文字をエスケープ
  const escaped = keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi')
  const parts = text.split(regex)

  parts.forEach((part) => {
    if (regex.test(part)) {
      const mark = document.createElement('span')
      mark.style.backgroundColor = 'rgba(255, 235, 59, 0.7)'
      mark.style.borderRadius = '2px'
      mark.style.padding = '0 1px'
      mark.textContent = part
      parent.appendChild(mark)
    } else {
      parent.appendChild(document.createTextNode(part))
    }
    // reset regex lastIndex since we reuse it
    regex.lastIndex = 0
  })
}

/** オリジナルサイズの画像をライトボックスで表示する（複数画像ナビゲーション対応） */
const openImageLightbox = (srcs: string[], initialIndex = 0) => {
  // 既存のライトボックスがあれば閉じる
  document.querySelectorAll('[data-moguchart-lightbox]').forEach((el) => el.remove())

  let currentIndex = initialIndex

  const overlay = document.createElement('div')
  overlay.setAttribute('data-moguchart-lightbox', 'true')
  overlay.style.position = 'fixed'
  overlay.style.top = '0'
  overlay.style.left = '0'
  overlay.style.width = '100vw'
  overlay.style.height = '100vh'
  overlay.style.zIndex = '10000'
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)'
  overlay.style.display = 'flex'
  overlay.style.alignItems = 'center'
  overlay.style.justifyContent = 'center'
  overlay.style.overflow = 'auto'
  overlay.style.cursor = 'zoom-out'
  overlay.style.opacity = '0'
  overlay.style.transition = 'opacity 0.2s ease'

  const img = document.createElement('img')
  img.src = getCachedImageUrl(srcs[currentIndex]!)
  img.style.display = 'block'
  img.style.margin = 'auto'
  img.style.maxWidth = 'calc(100vw - 120px)'
  img.style.maxHeight = 'calc(100vh - 80px)'
  img.style.objectFit = 'contain'
  img.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.5)'
  img.style.borderRadius = '4px'
  img.draggable = false
  img.style.cursor = 'default'
  img.addEventListener('click', (e) => e.stopPropagation())
  overlay.appendChild(img)

  // カウンター表示（複数画像時のみ）
  let counterEl: HTMLElement | null = null
  if (srcs.length > 1) {
    counterEl = document.createElement('div')
    counterEl.style.cssText =
      'position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); color: white; font-size: 14px; font-weight: bold; text-shadow: 0 1px 4px rgba(0,0,0,0.8); pointer-events: none;'
    counterEl.textContent = `${currentIndex + 1} / ${srcs.length}`
    overlay.appendChild(counterEl)
  }

  const updateImage = () => {
    img.src = getCachedImageUrl(srcs[currentIndex]!)
    if (counterEl) counterEl.textContent = `${currentIndex + 1} / ${srcs.length}`
  }

  // ナビゲーションボタン（複数画像時のみ）
  if (srcs.length > 1) {
    const btnStyle =
      'position: fixed; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.15); border: none; color: white; font-size: 28px; width: 44px; height: 44px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); transition: background 0.15s;'

    const prevBtn = document.createElement('button')
    prevBtn.style.cssText = btnStyle + 'left: 16px;'
    prevBtn.textContent = '‹'
    prevBtn.addEventListener('mouseenter', () => (prevBtn.style.background = 'rgba(255,255,255,0.3)'))
    prevBtn.addEventListener('mouseleave', () => (prevBtn.style.background = 'rgba(255,255,255,0.15)'))
    prevBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      currentIndex = (currentIndex - 1 + srcs.length) % srcs.length
      updateImage()
    })
    overlay.appendChild(prevBtn)

    const nextBtn = document.createElement('button')
    nextBtn.style.cssText = btnStyle + 'right: 16px;'
    nextBtn.textContent = '›'
    nextBtn.addEventListener('mouseenter', () => (nextBtn.style.background = 'rgba(255,255,255,0.3)'))
    nextBtn.addEventListener('mouseleave', () => (nextBtn.style.background = 'rgba(255,255,255,0.15)'))
    nextBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      currentIndex = (currentIndex + 1) % srcs.length
      updateImage()
    })
    overlay.appendChild(nextBtn)
  }

  const closeLightbox = () => {
    overlay.style.opacity = '0'
    setTimeout(() => overlay.remove(), 200)
    document.removeEventListener('keydown', onKeyDown)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') closeLightbox()
    if (srcs.length > 1) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        currentIndex = (currentIndex - 1 + srcs.length) % srcs.length
        updateImage()
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        currentIndex = (currentIndex + 1) % srcs.length
        updateImage()
      }
    }
  }

  overlay.addEventListener('click', closeLightbox)
  document.addEventListener('keydown', onKeyDown)

  document.body.appendChild(overlay)
  // フェードイン
  requestAnimationFrame(() => {
    overlay.style.opacity = '1'
  })
}

export const barContent = (task: moguchart.GanttTask) => {
  // サマリータスクの場合（ブラケット形状に最適化した専用レイアウト）
  if (task.type === 'summary') {
    const summaryContainer = document.createElement('div')
    summaryContainer.style.display = 'flex'
    summaryContainer.style.alignItems = 'center'
    summaryContainer.style.justifyContent = 'flex-start'
    summaryContainer.style.width = '100%'
    summaryContainer.style.height = '60%'
    summaryContainer.style.padding = '0 8px'
    summaryContainer.style.boxSizing = 'border-box'
    summaryContainer.style.gap = '6px'
    summaryContainer.style.whiteSpace = 'nowrap'
    summaryContainer.style.overflow = 'hidden'
    summaryContainer.style.pointerEvents = 'none'
    summaryContainer.style.userSelect = 'none'

    const iconSpan = document.createElement('span')
    iconSpan.style.fontSize = '10px'
    iconSpan.style.opacity = '0.9'
    iconSpan.style.filter = 'drop-shadow(1px 1px 1px rgba(0,0,0,0.5))'
    iconSpan.textContent = '📁'
    summaryContainer.appendChild(iconSpan)

    const nameSpan = document.createElement('span')
    nameSpan.style.cssText =
      'font-weight: 700; font-size: 11px; text-shadow: 1px 1px 2px rgba(0,0,0,0.6); color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;'
    nameSpan.textContent = task.name || ''
    summaryContainer.appendChild(nameSpan)

    if (task.progress !== undefined && !Number.isNaN(task.progress)) {
      const progressBadge = document.createElement('span')
      progressBadge.style.cssText =
        'font-size: 10px; font-weight: 700; background: rgba(0,0,0,0.4); color: #ffffff; padding: 0px 5px; border-radius: 4px; text-shadow: 1px 1px 1px rgba(0,0,0,0.5); flex-shrink: 0; border: 1px solid rgba(255,255,255,0.2);'
      progressBadge.textContent = `${Math.round(task.progress)}%`
      summaryContainer.appendChild(progressBadge)
    }

    return summaryContainer
  }

  const taskWithAttr = task as any
  const labels = taskWithAttr.attribute?.labels as { name: string; color: string }[] | undefined
  const description = taskWithAttr.attribute?.description as string | undefined
  const commentCount = taskWithAttr.commentCount as number | undefined
  const isLocked = taskWithAttr.attribute?.lock === true

  const container = document.createElement('div')
  container.style.display = 'flex'
  container.style.flexDirection = 'column'
  container.style.justifyContent = 'flex-start'
  container.style.alignItems = 'flex-start'
  container.style.height = '100%'
  container.style.boxSizing = 'border-box'
  container.style.whiteSpace = 'nowrap'
  container.style.overflow = 'hidden'
  container.style.padding = '2px 8px'
  container.style.gap = '1px'
  container.style.pointerEvents = 'none'
  container.style.position = 'relative'
  container.style.userSelect = 'none'

  const headerContainer = document.createElement('div')
  headerContainer.style.display = 'flex'
  headerContainer.style.alignItems = 'center'
  headerContainer.style.gap = '6px'
  headerContainer.style.width = '100%'
  headerContainer.style.overflow = 'hidden'

  // ロックアイコン
  if (isLocked) {
    const lockIcon = document.createElement('span')
    lockIcon.style.fontSize = '11px'
    lockIcon.style.flexShrink = '0'
    lockIcon.style.opacity = '0.85'
    lockIcon.style.filter = 'drop-shadow(1px 1px 1px rgba(0,0,0,0.4))'
    lockIcon.textContent = '🔒'
    headerContainer.appendChild(lockIcon)
  }

  const nameSpan = document.createElement('span')
  nameSpan.style.cssText = `font-weight: bold; font-size: 12px; text-shadow: 1px 1px 2px rgba(0,0,0,0.5); color: white; white-space: nowrap; ${task.labelStyle || ''}`

  const searchKeywords = (task as any)._searchKeywords as string[] | undefined
  if (searchKeywords && searchKeywords.length > 0) {
    highlightText(task.name || '', searchKeywords, nameSpan)
  } else {
    nameSpan.textContent = task.name || ''
  }
  headerContainer.appendChild(nameSpan)

  if (labels && labels.length > 0) {
    const labelsContainer = document.createElement('div')
    labelsContainer.style.display = 'flex'
    labelsContainer.style.gap = '4px'
    labelsContainer.style.flexShrink = '0'

    labels.forEach((l) => {
      const labelSpan = document.createElement('span')
      labelSpan.style.backgroundColor = l.color
      labelSpan.style.color = getContrastColor(l.color)
      labelSpan.style.padding = '0px 6px'
      labelSpan.style.borderRadius = '3px'
      labelSpan.style.fontSize = '10px'
      labelSpan.style.fontWeight = 'bold'
      labelSpan.textContent = l.name
      labelsContainer.appendChild(labelSpan)
    })
    headerContainer.appendChild(labelsContainer)
  }

  // コメントバッジ
  if (commentCount && commentCount > 0) {
    const taskId = Number(task.id)
    const badge = document.createElement('span')
    badge.style.display = 'inline-flex'
    badge.style.alignItems = 'center'
    badge.style.gap = '2px'
    badge.style.backgroundColor = 'rgba(255, 255, 255, 0.25)'
    badge.style.color = 'white'
    badge.style.padding = '0px 5px'
    badge.style.borderRadius = '8px'
    badge.style.fontSize = '10px'
    badge.style.fontWeight = 'bold'
    badge.style.flexShrink = '0'
    badge.style.textShadow = '1px 1px 2px rgba(0,0,0,0.5)'
    badge.style.pointerEvents = 'auto'
    badge.style.cursor = 'default'
    badge.textContent = `💬 ${commentCount}`

    let tooltipEl: HTMLElement | null = null
    let hideTimeout: ReturnType<typeof setTimeout> | null = null

    const showTooltip = () => {
      if (hideTimeout) {
        clearTimeout(hideTimeout)
        hideTimeout = null
      }
      if (tooltipEl) return

      const colors = getTooltipColors()
      tooltipEl = document.createElement('div')
      tooltipEl.style.position = 'fixed'
      tooltipEl.style.zIndex = '9999'
      tooltipEl.style.backgroundColor = colors.bg
      tooltipEl.style.color = colors.text
      tooltipEl.style.border = `1px solid ${colors.border}`
      tooltipEl.style.borderRadius = '8px'
      tooltipEl.style.padding = '8px 12px'
      tooltipEl.style.maxWidth = '320px'
      tooltipEl.style.fontSize = '12px'
      tooltipEl.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
      tooltipEl.style.pointerEvents = 'none'

      const rect = badge.getBoundingClientRect()
      tooltipEl.style.left = `${rect.left}px`
      tooltipEl.style.top = `${rect.bottom + 4}px`

      const cached = commentsCache.get(taskId)
      if (cached && Date.now() - cached.fetchedAt < 60000) {
        renderComments(tooltipEl, cached.data, commentCount)
      } else {
        tooltipEl.textContent = `コメント読み込み中... (${commentCount}件)`
        selectTaskComments(taskId)
          .then((comments) => {
            commentsCache.set(taskId, { data: comments, fetchedAt: Date.now() })
            if (tooltipEl) {
              renderComments(tooltipEl, comments, commentCount)
              adjustTooltipPosition(tooltipEl, rect)
            }
          })
          .catch(() => {
            if (tooltipEl) tooltipEl.textContent = 'コメントの読み込みに失敗しました'
          })
      }
      document.body.appendChild(tooltipEl)
      adjustTooltipPosition(tooltipEl, rect)
    }

    const removeTooltip = () => {
      if (hideTimeout) {
        clearTimeout(hideTimeout)
        hideTimeout = null
      }
      if (tooltipEl) {
        tooltipEl.remove()
        tooltipEl = null
      }
    }

    const hideTooltip = () => {
      hideTimeout = setTimeout(removeTooltip, 100)
    }

    badge.addEventListener('mouseenter', showTooltip)
    badge.addEventListener('mouseleave', hideTooltip)
    badge.addEventListener('mousedown', removeTooltip)
    document.addEventListener('mousedown', (e) => {
      if (tooltipEl && e.target !== badge) removeTooltip()
    })

    headerContainer.appendChild(badge)
  }

  // 画像サムネイル
  const imageUrls = (taskWithAttr.attribute?.imageUrls as string[] | undefined)?.filter(Boolean)
  if (imageUrls && imageUrls.length > 0) {
    const thumbWrapper = document.createElement('span')
    thumbWrapper.style.position = 'absolute'
    thumbWrapper.style.right = '4px'
    thumbWrapper.style.top = '0'
    thumbWrapper.style.height = '100%'
    thumbWrapper.style.boxSizing = 'border-box'
    thumbWrapper.style.aspectRatio = '1'
    thumbWrapper.style.display = 'flex'
    thumbWrapper.style.alignItems = 'center'
    thumbWrapper.style.justifyContent = 'center'
    thumbWrapper.style.borderRadius = '3px'
    thumbWrapper.style.overflow = 'hidden'
    thumbWrapper.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'
    thumbWrapper.style.pointerEvents = 'auto'
    thumbWrapper.style.cursor = 'default'
    thumbWrapper.style.border = '1px solid rgba(255, 255, 255, 0.3)'

    const thumbImg = document.createElement('img')
    setImageSrc(thumbImg, imageUrls[0]!)
    thumbImg.style.width = '100%'
    thumbImg.style.height = '100%'
    thumbImg.style.objectFit = 'cover'
    thumbImg.style.display = 'block'
    thumbImg.draggable = false
    thumbWrapper.appendChild(thumbImg)

    // 複数画像の場合、枚数バッジを表示
    if (imageUrls.length > 1) {
      const countBadge = document.createElement('span')
      countBadge.style.cssText =
        'position: absolute; bottom: -1px; right: -1px; background: rgba(0,0,0,0.7); color: white; font-size: 8px; font-weight: bold; padding: 0 3px; border-radius: 3px 0 3px 0; line-height: 14px;'
      countBadge.textContent = `${imageUrls.length}`
      thumbWrapper.appendChild(countBadge)
    }

    let popupEl: HTMLElement | null = null
    let popupHideTimeout: ReturnType<typeof setTimeout> | null = null

    const showImagePopup = () => {
      if (popupHideTimeout) {
        clearTimeout(popupHideTimeout)
        popupHideTimeout = null
      }
      if (popupEl) return

      // 再レンダリングで孤立した既存ポップアップを削除
      document.querySelectorAll('[data-moguchart-image-popup]').forEach((el) => el.remove())

      // ガントバーのツールチップを非表示にする（タイマーもキャンセル）
      thumbWrapper.dispatchEvent(new CustomEvent('bar-mouseleave', { bubbles: true, composed: true }))

      const colors = getTooltipColors()
      popupEl = document.createElement('div')
      popupEl.setAttribute('data-moguchart-image-popup', 'true')
      popupEl.style.position = 'fixed'
      popupEl.style.zIndex = '9999'
      popupEl.style.backgroundColor = colors.bg
      popupEl.style.border = `1px solid ${colors.border}`
      popupEl.style.borderRadius = '8px'
      popupEl.style.padding = '6px'
      popupEl.style.boxShadow = '0 8px 24px rgba(0,0,0,0.25)'
      popupEl.style.pointerEvents = 'auto'
      popupEl.style.cursor = 'zoom-in'
      popupEl.style.maxWidth = '400px'
      popupEl.style.maxHeight = '320px'
      popupEl.style.overflowY = imageUrls.length > 1 ? 'auto' : 'hidden'
      popupEl.style.display = 'flex'
      popupEl.style.flexDirection = 'column'
      popupEl.style.gap = '4px'

      imageUrls.forEach((url, idx) => {
        const popupImg = document.createElement('img')
        setImageSrc(popupImg, url)
        popupImg.style.maxWidth = '388px'
        popupImg.style.maxHeight = imageUrls.length === 1 ? '296px' : '200px'
        popupImg.style.objectFit = 'contain'
        popupImg.style.display = 'block'
        popupImg.style.borderRadius = '4px'
        popupImg.style.cursor = 'zoom-in'
        popupImg.draggable = false

        popupImg.addEventListener('click', (e) => {
          e.stopPropagation()
          removeImagePopup()
          openImageLightbox(imageUrls, idx)
        })
        popupEl!.appendChild(popupImg)
      })

      popupEl.addEventListener('mouseenter', () => {
        if (popupHideTimeout) {
          clearTimeout(popupHideTimeout)
          popupHideTimeout = null
        }
      })
      popupEl.addEventListener('mouseleave', () => {
        popupHideTimeout = setTimeout(removeImagePopup, 100)
      })

      document.body.appendChild(popupEl)

      const rect = thumbWrapper.getBoundingClientRect()
      adjustTooltipPosition(popupEl, rect)
    }

    const removeImagePopup = () => {
      if (popupHideTimeout) {
        clearTimeout(popupHideTimeout)
        popupHideTimeout = null
      }
      if (popupEl) {
        popupEl.remove()
        popupEl = null
      }
    }

    const hideImagePopup = () => {
      popupHideTimeout = setTimeout(removeImagePopup, 100)
    }

    thumbWrapper.addEventListener('mouseenter', showImagePopup)
    thumbWrapper.addEventListener('mouseleave', hideImagePopup)
    thumbWrapper.addEventListener('mousedown', (e) => {
      // ライトボックスが開くときの mousedown ではポップアップを消さない
      e.stopPropagation()
    })
    document.addEventListener('mousedown', (e) => {
      if (
        popupEl &&
        e.target !== thumbWrapper &&
        !thumbWrapper.contains(e.target as Node) &&
        e.target !== popupEl &&
        !popupEl.contains(e.target as Node)
      )
        removeImagePopup()
    })

    container.appendChild(thumbWrapper)
  }

  container.appendChild(headerContainer)

  if (description) {
    const descSpan = document.createElement('span')
    descSpan.style.cssText = `font-size: 10px; opacity: 0.9; text-shadow: 1px 1px 2px rgba(0,0,0,0.5); color: white; overflow: hidden; text-overflow: ellipsis; width: 100%; display: block; ${task.labelStyle || ''}`
    if (searchKeywords && searchKeywords.length > 0) {
      highlightText(description, searchKeywords, descSpan)
    } else {
      descSpan.textContent = description
    }
    container.appendChild(descSpan)
  }

  return container
}

export const tooltip = (task: moguchart.GanttTask, isHourly?: boolean) => {
  const isSummary = task.type === 'summary'
  const taskWithAttr = task as any
  const labels = taskWithAttr.attribute?.labels as { name: string; color: string }[] | undefined
  const description = taskWithAttr.attribute?.description as string | undefined
  const progress = isSummary ? task.progress : (taskWithAttr.attribute?.progress as number | undefined)

  const container = document.createElement('div')
  container.style.display = 'flex'
  container.style.flexDirection = 'column'
  container.style.gap = '4px'
  container.style.padding = '8px'
  container.style.maxWidth = '300px'

  // 日付
  const dateSpan = document.createElement('div')
  dateSpan.style.fontSize = '11px'
  dateSpan.style.opacity = '0.9'
  const start = dayjs(task.start)
  const end = dayjs(task.end)

  if (isHourly) {
    const diffMinutes = end.diff(start, 'minute')
    const diffHours = diffMinutes / 60
    const hoursStr = Number.isInteger(diffHours) ? diffHours.toString() : diffHours.toFixed(1)
    dateSpan.textContent = `${start.format('YYYY/MM/DD HH:mm')} - ${end.format('YYYY/MM/DD HH:mm')} (${hoursStr}時間)`
  } else {
    const days = end.diff(start, 'day') + 1
    dateSpan.textContent = `${toDateString(task.start, 'YYYY/MM/DD')} - ${toDateString(task.end, 'YYYY/MM/DD')} (${days}日)`
  }
  container.appendChild(dateSpan)

  // タスク名
  const nameSpan = document.createElement('div')
  nameSpan.style.fontWeight = 'bold'
  nameSpan.style.fontSize = '14px'
  nameSpan.style.marginBottom = '4px'
  if (isSummary) {
    nameSpan.innerHTML = `<span style="opacity: 0.85; font-size: 11px; display: flex; align-items: center; gap: 4px; margin-bottom: 2px;">📁 <span>サマリータスク（配下集計）</span></span>${task.name || ''}`
  } else {
    nameSpan.textContent = task.name || ''
  }
  container.appendChild(nameSpan)

  // ラベル
  if (labels && labels.length > 0) {
    const labelsContainer = document.createElement('div')
    labelsContainer.style.display = 'flex'
    labelsContainer.style.flexWrap = 'wrap'
    labelsContainer.style.gap = '4px'
    labelsContainer.style.marginBottom = '4px'

    labels.forEach((l) => {
      const labelSpan = document.createElement('span')
      labelSpan.style.backgroundColor = l.color
      labelSpan.style.color = getContrastColor(l.color)
      labelSpan.style.padding = '2px 6px'
      labelSpan.style.borderRadius = '4px'
      labelSpan.style.fontSize = '10px'
      labelSpan.style.fontWeight = 'bold'
      labelSpan.textContent = l.name
      labelsContainer.appendChild(labelSpan)
    })
    container.appendChild(labelsContainer)
  }

  // 説明
  if (description) {
    const descDiv = document.createElement('div')
    descDiv.style.fontSize = '12px'
    descDiv.style.whiteSpace = 'pre-wrap' // 改行を保持
    descDiv.style.opacity = '0.7'
    descDiv.style.marginTop = '4px'
    descDiv.style.paddingTop = '4px'
    descDiv.style.borderTop = '1px solid rgba(128, 128, 128, 0.3)'
    descDiv.textContent = description
    container.appendChild(descDiv)
  }

  // 担当者
  const assignees = taskWithAttr.attribute?.assignees as string[] | undefined
  if (assignees && assignees.length > 0) {
    const assigneesDiv = document.createElement('div')
    assigneesDiv.style.fontSize = '12px'
    assigneesDiv.style.marginTop = '4px'
    assigneesDiv.style.paddingTop = '4px'
    assigneesDiv.style.borderTop = '1px solid rgba(128, 128, 128, 0.3)'
    assigneesDiv.style.display = 'flex'
    assigneesDiv.style.alignItems = 'center'
    assigneesDiv.style.gap = '4px'
    assigneesDiv.style.flexWrap = 'wrap'

    const titleSpan = document.createElement('span')
    titleSpan.style.opacity = '0.7'
    titleSpan.textContent = '担当:'
    assigneesDiv.appendChild(titleSpan)

    assignees.forEach((email) => {
      const chip = document.createElement('span')
      chip.style.cssText =
        'background-color: rgba(128, 128, 128, 0.2); padding: 1px 6px; border-radius: 10px; font-size: 11px;'
      chip.textContent = email
      assigneesDiv.appendChild(chip)
    })
    container.appendChild(assigneesDiv)
  }

  // 進捗率
  if (progress != null && progress >= 0) {
    const clampedProgress = Math.min(100, Math.max(0, progress))
    const progressDiv = document.createElement('div')
    progressDiv.style.fontSize = '12px'
    progressDiv.style.marginTop = '4px'
    progressDiv.style.paddingTop = '4px'
    progressDiv.style.borderTop = '1px solid rgba(128, 128, 128, 0.3)'

    const progressHeader = document.createElement('div')
    progressHeader.style.display = 'flex'
    progressHeader.style.justifyContent = 'space-between'
    progressHeader.style.alignItems = 'center'
    progressHeader.style.marginBottom = '4px'
    const progressTitle = document.createElement('span')
    progressTitle.textContent = '進捗'
    const progressValue = document.createElement('span')
    progressValue.style.fontWeight = 'bold'
    progressValue.textContent = `${clampedProgress}%`
    progressHeader.appendChild(progressTitle)
    progressHeader.appendChild(progressValue)
    progressDiv.appendChild(progressHeader)

    const barBg = document.createElement('div')
    barBg.style.cssText =
      'width: 100%; height: 6px; background-color: rgba(128,128,128,0.3); border-radius: 3px; overflow: hidden;'
    const barFill = document.createElement('div')
    barFill.style.cssText = `width: ${clampedProgress}%; height: 100%; background-color: #4caf50; border-radius: 3px;`
    barBg.appendChild(barFill)
    progressDiv.appendChild(barBg)

    container.appendChild(progressDiv)
  }

  // 画像プレビュー
  const tooltipImageUrls = ((task as any).attribute?.imageUrls as string[] | undefined)?.filter(Boolean)
  if (tooltipImageUrls && tooltipImageUrls.length > 0) {
    const imgDiv = document.createElement('div')
    imgDiv.style.marginTop = '4px'
    imgDiv.style.paddingTop = '4px'
    imgDiv.style.borderTop = '1px solid rgba(128, 128, 128, 0.3)'
    imgDiv.style.display = 'flex'
    imgDiv.style.flexDirection = 'column'
    imgDiv.style.gap = '4px'

    // 最初の1枚だけプレビュー表示
    const imgEl = document.createElement('img')
    setImageSrc(imgEl, tooltipImageUrls[0]!)
    imgEl.style.maxWidth = '280px'
    imgEl.style.maxHeight = '160px'
    imgEl.style.objectFit = 'contain'
    imgEl.style.borderRadius = '4px'
    imgEl.style.display = 'block'
    imgEl.draggable = false
    imgDiv.appendChild(imgEl)

    if (tooltipImageUrls.length > 1) {
      const moreDiv = document.createElement('div')
      moreDiv.style.fontSize = '10px'
      moreDiv.style.opacity = '0.6'
      moreDiv.style.textAlign = 'center'
      moreDiv.textContent = `🖼️ 他 ${tooltipImageUrls.length - 1} 枚の画像`
      imgDiv.appendChild(moreDiv)
    }
    container.appendChild(imgDiv)
  }

  return container
}

export const rowHeaderContent = (row: moguchart.GanttRow, barHeight: number = 38) => {
  const rowWithAttr = row as any
  const description = rowWithAttr.attribute?.description as string | undefined
  const commentCount = rowWithAttr.commentCount as number | undefined
  const labels = rowWithAttr.attribute?.labels as { name: string; color: string }[] | undefined
  const rowImageUrls = (rowWithAttr.attribute?.imageUrls as string[] | undefined)?.filter(Boolean)

  const container = document.createElement('div')
  container.style.display = 'flex'
  container.style.flexDirection = 'column'
  container.style.justifyContent = 'start'
  container.style.height = '100%'
  container.style.padding = '4px 8px'
  container.style.overflow = 'hidden'
  container.style.width = '100%'
  container.style.boxSizing = 'border-box'
  container.style.position = 'relative'
  container.style.zIndex = '1'
  container.style.pointerEvents = 'none'
  container.style.userSelect = 'none'

  const nameRow = document.createElement('div')
  nameRow.style.display = 'flex'
  nameRow.style.alignItems = 'center'
  nameRow.style.gap = '6px'
  nameRow.style.overflow = 'hidden'

  const nameDiv = document.createElement('div')
  nameDiv.style.fontWeight = 'bold'
  nameDiv.style.fontSize = '14px'
  nameDiv.style.whiteSpace = 'nowrap'
  nameDiv.style.overflow = 'hidden'
  nameDiv.style.textOverflow = 'ellipsis'
  nameDiv.style.color = 'rgb(var(--v-theme-on-surface))'

  const searchKeywords = (row as any)._searchKeywords as string[] | undefined
  if (searchKeywords && searchKeywords.length > 0) {
    highlightText(row.name, searchKeywords, nameDiv)
  } else {
    nameDiv.textContent = row.name
  }
  nameRow.appendChild(nameDiv)

  if (labels && labels.length > 0) {
    const labelsContainer = document.createElement('div')
    labelsContainer.style.display = 'flex'
    labelsContainer.style.gap = '3px'
    labelsContainer.style.flexShrink = '0'

    labels.forEach((l) => {
      const labelSpan = document.createElement('span')
      labelSpan.style.backgroundColor = l.color
      labelSpan.style.color = getContrastColor(l.color)
      labelSpan.style.padding = '0px 5px'
      labelSpan.style.borderRadius = '3px'
      labelSpan.style.fontSize = '10px'
      labelSpan.style.fontWeight = 'bold'
      labelSpan.style.lineHeight = '16px'
      labelSpan.style.flexShrink = '0'
      labelSpan.textContent = l.name
      labelsContainer.appendChild(labelSpan)
    })
    nameRow.appendChild(labelsContainer)
  }

  if (commentCount && commentCount > 0) {
    const rowId = Number(row.id)
    const badge = document.createElement('span')
    badge.style.display = 'inline-flex'
    badge.style.alignItems = 'center'
    badge.style.gap = '2px'
    badge.style.backgroundColor = 'rgba(var(--v-theme-on-surface), 0.1)'
    badge.style.color = 'rgb(var(--v-theme-on-surface))'
    badge.style.padding = '0px 5px'
    badge.style.borderRadius = '8px'
    badge.style.fontSize = '10px'
    badge.style.fontWeight = 'bold'
    badge.style.flexShrink = '0'
    badge.style.opacity = '0.7'
    badge.style.pointerEvents = 'auto'
    badge.style.cursor = 'default'
    badge.textContent = `💬 ${commentCount}`

    let tooltipEl: HTMLElement | null = null
    let hideTimeout: ReturnType<typeof setTimeout> | null = null

    const showTooltip = (e: MouseEvent) => {
      if (hideTimeout) {
        clearTimeout(hideTimeout)
        hideTimeout = null
      }
      if (tooltipEl) return

      const colors = getTooltipColors()
      tooltipEl = document.createElement('div')
      tooltipEl.style.position = 'fixed'
      tooltipEl.style.zIndex = '9999'
      tooltipEl.style.backgroundColor = colors.bg
      tooltipEl.style.color = colors.text
      tooltipEl.style.border = `1px solid ${colors.border}`
      tooltipEl.style.borderRadius = '8px'
      tooltipEl.style.padding = '8px 12px'
      tooltipEl.style.maxWidth = '320px'
      tooltipEl.style.fontSize = '12px'
      tooltipEl.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
      tooltipEl.style.pointerEvents = 'none'

      const rect = badge.getBoundingClientRect()
      tooltipEl.style.left = `${rect.left}px`
      tooltipEl.style.top = `${rect.bottom + 4}px`

      // キャッシュ or APIから取得
      const cached = rowCommentsCache.get(rowId)
      if (cached && Date.now() - cached.fetchedAt < 60000) {
        renderComments(tooltipEl, cached.data, commentCount)
      } else {
        tooltipEl.textContent = `コメント読み込み中... (${commentCount}件)`
        selectComments({ rowId })
          .then((comments) => {
            rowCommentsCache.set(rowId, { data: comments, fetchedAt: Date.now() })
            if (tooltipEl) {
              renderComments(tooltipEl, comments, commentCount)
              adjustTooltipPosition(tooltipEl, rect)
            }
          })
          .catch(() => {
            if (tooltipEl) tooltipEl.textContent = 'コメントの読み込みに失敗しました'
          })
      }
      document.body.appendChild(tooltipEl)
      adjustTooltipPosition(tooltipEl, rect)
    }

    const removeTooltip = () => {
      if (hideTimeout) {
        clearTimeout(hideTimeout)
        hideTimeout = null
      }
      if (tooltipEl) {
        tooltipEl.remove()
        tooltipEl = null
      }
    }

    const hideTooltip = () => {
      hideTimeout = setTimeout(removeTooltip, 100)
    }

    badge.addEventListener('mouseenter', showTooltip)
    badge.addEventListener('mouseleave', hideTooltip)
    badge.addEventListener('mousedown', removeTooltip)
    document.addEventListener('mousedown', (e) => {
      if (tooltipEl && e.target !== badge) removeTooltip()
    })

    nameRow.appendChild(badge)
  }

  container.appendChild(nameRow)

  // 行画像サムネイル（タスクバーと同じスタイルで右端に配置）
  if (rowImageUrls && rowImageUrls.length > 0) {
    const thumbSize = `${barHeight}px`
    const thumbWrapper = document.createElement('span')
    thumbWrapper.style.position = 'absolute'
    thumbWrapper.style.right = '8px'
    thumbWrapper.style.top = '4px'
    thumbWrapper.style.width = thumbSize
    thumbWrapper.style.height = thumbSize
    thumbWrapper.style.boxSizing = 'border-box'
    thumbWrapper.style.display = 'flex'
    thumbWrapper.style.alignItems = 'center'
    thumbWrapper.style.justifyContent = 'center'
    thumbWrapper.style.borderRadius = '3px'
    thumbWrapper.style.overflow = 'hidden'
    thumbWrapper.style.backgroundColor = 'rgba(var(--v-theme-on-surface), 0.08)'
    thumbWrapper.style.pointerEvents = 'auto'
    thumbWrapper.style.cursor = 'default'
    thumbWrapper.style.border = '1px solid rgba(var(--v-theme-on-surface), 0.15)'

    const thumbImg = document.createElement('img')
    setImageSrc(thumbImg, rowImageUrls[0]!)
    thumbImg.style.width = '100%'
    thumbImg.style.height = '100%'
    thumbImg.style.objectFit = 'cover'
    thumbImg.style.display = 'block'
    thumbImg.draggable = false
    thumbWrapper.appendChild(thumbImg)

    // 複数画像の場合、枚数バッジを表示
    if (rowImageUrls.length > 1) {
      const countBadge = document.createElement('span')
      countBadge.style.cssText =
        'position: absolute; bottom: -1px; right: -1px; background: rgba(0,0,0,0.7); color: white; font-size: 8px; font-weight: bold; padding: 0 3px; border-radius: 3px 0 3px 0; line-height: 14px;'
      countBadge.textContent = `${rowImageUrls.length}`
      thumbWrapper.appendChild(countBadge)
    }

    let popupEl: HTMLElement | null = null
    let popupHideTimeout: ReturnType<typeof setTimeout> | null = null

    const showImagePopup = () => {
      if (popupHideTimeout) {
        clearTimeout(popupHideTimeout)
        popupHideTimeout = null
      }
      if (popupEl) return

      // 行ヘッダーのツールチップを非表示にする（タイマーもキャンセル）
      thumbWrapper.dispatchEvent(new CustomEvent('row-header-mouseleave', { bubbles: true, composed: true }))

      // 既存のポップアップを削除
      document.querySelectorAll('[data-moguchart-row-image-popup]').forEach((el) => el.remove())

      const colors = getTooltipColors()
      popupEl = document.createElement('div')
      popupEl.setAttribute('data-moguchart-row-image-popup', 'true')
      popupEl.style.position = 'fixed'
      popupEl.style.zIndex = '9999'
      popupEl.style.backgroundColor = colors.bg
      popupEl.style.border = `1px solid ${colors.border}`
      popupEl.style.borderRadius = '8px'
      popupEl.style.padding = '6px'
      popupEl.style.boxShadow = '0 8px 24px rgba(0,0,0,0.25)'
      popupEl.style.pointerEvents = 'auto'
      popupEl.style.cursor = 'zoom-in'
      popupEl.style.maxWidth = '400px'
      popupEl.style.maxHeight = '320px'
      popupEl.style.overflowY = rowImageUrls.length > 1 ? 'auto' : 'hidden'
      popupEl.style.display = 'flex'
      popupEl.style.flexDirection = 'column'
      popupEl.style.gap = '4px'

      rowImageUrls.forEach((url, idx) => {
        const popupImg = document.createElement('img')
        setImageSrc(popupImg, url)
        popupImg.style.maxWidth = '388px'
        popupImg.style.maxHeight = rowImageUrls.length === 1 ? '296px' : '200px'
        popupImg.style.objectFit = 'contain'
        popupImg.style.display = 'block'
        popupImg.style.borderRadius = '4px'
        popupImg.style.cursor = 'zoom-in'
        popupImg.draggable = false

        popupImg.addEventListener('click', (e) => {
          e.stopPropagation()
          removeImagePopup()
          openImageLightbox(rowImageUrls, idx)
        })
        popupEl!.appendChild(popupImg)
      })

      popupEl.addEventListener('mouseenter', () => {
        if (popupHideTimeout) {
          clearTimeout(popupHideTimeout)
          popupHideTimeout = null
        }
      })
      popupEl.addEventListener('mouseleave', () => {
        popupHideTimeout = setTimeout(removeImagePopup, 100)
      })

      document.body.appendChild(popupEl)

      const rect = thumbWrapper.getBoundingClientRect()
      adjustTooltipPosition(popupEl, rect)
    }

    const removeImagePopup = () => {
      if (popupHideTimeout) {
        clearTimeout(popupHideTimeout)
        popupHideTimeout = null
      }
      if (popupEl) {
        popupEl.remove()
        popupEl = null
      }
    }

    const hideImagePopup = () => {
      popupHideTimeout = setTimeout(removeImagePopup, 100)
    }

    thumbWrapper.addEventListener('mouseenter', showImagePopup)
    thumbWrapper.addEventListener('mouseleave', hideImagePopup)
    thumbWrapper.addEventListener('mousedown', (e) => {
      e.stopPropagation()
    })
    document.addEventListener('mousedown', (e) => {
      if (
        popupEl &&
        e.target !== thumbWrapper &&
        !thumbWrapper.contains(e.target as Node) &&
        e.target !== popupEl &&
        !popupEl.contains(e.target as Node)
      )
        removeImagePopup()
    })

    container.appendChild(thumbWrapper)
  }

  if (description) {
    const descDiv = document.createElement('div')
    descDiv.style.fontSize = '11px'
    descDiv.style.color = 'rgba(var(--v-theme-on-surface), 0.6)'
    descDiv.style.marginTop = '2px'
    descDiv.style.whiteSpace = 'nowrap'
    descDiv.style.overflow = 'hidden'
    descDiv.style.textOverflow = 'ellipsis'
    if (searchKeywords && searchKeywords.length > 0) {
      highlightText(description, searchKeywords, descDiv)
    } else {
      descDiv.textContent = description
    }
    container.appendChild(descDiv)
  }

  return container
}

export const rowHeaderTooltip = (row: moguchart.GanttRow) => {
  const rowWithAttr = row as any
  const description = rowWithAttr.attribute?.description as string | undefined
  const labels = rowWithAttr.attribute?.labels as { name: string; color: string }[] | undefined
  const commentCount = rowWithAttr.commentCount as number | undefined
  const taskCount = row.tasks?.length ?? 0
  const rowImageUrls = (rowWithAttr.attribute?.imageUrls as string[] | undefined)?.filter(Boolean)
  const imageCount = rowImageUrls?.length ?? 0

  // 説明もラベルもコメントもタスクも画像もない場合はツールチップ不要
  if (!description && (!labels || labels.length === 0) && !commentCount && taskCount === 0 && imageCount === 0) {
    return null
  }

  const colors = getTooltipColors()

  const container = document.createElement('div')
  container.style.display = 'flex'
  container.style.flexDirection = 'column'
  container.style.gap = '6px'
  container.style.maxWidth = '320px'

  // 行名
  const nameDiv = document.createElement('div')
  nameDiv.style.fontWeight = 'bold'
  nameDiv.style.fontSize = '14px'
  nameDiv.style.color = colors.textStrong
  nameDiv.textContent = row.name || ''
  container.appendChild(nameDiv)

  // ラベル
  if (labels && labels.length > 0) {
    const labelsContainer = document.createElement('div')
    labelsContainer.style.display = 'flex'
    labelsContainer.style.flexWrap = 'wrap'
    labelsContainer.style.gap = '4px'

    labels.forEach((l) => {
      const labelSpan = document.createElement('span')
      labelSpan.style.backgroundColor = l.color
      labelSpan.style.color = getContrastColor(l.color)
      labelSpan.style.padding = '2px 6px'
      labelSpan.style.borderRadius = '4px'
      labelSpan.style.fontSize = '10px'
      labelSpan.style.fontWeight = 'bold'
      labelSpan.textContent = l.name
      labelsContainer.appendChild(labelSpan)
    })
    container.appendChild(labelsContainer)
  }

  // 説明
  if (description) {
    const descDiv = document.createElement('div')
    descDiv.style.fontSize = '12px'
    descDiv.style.whiteSpace = 'pre-wrap'
    descDiv.style.color = colors.text
    descDiv.style.borderTop = `1px solid ${colors.divider}`
    descDiv.style.paddingTop = '5px'
    // 150文字で制限
    descDiv.textContent = description.length > 150 ? description.slice(0, 150) + '...' : description
    container.appendChild(descDiv)
  }

  // 画像プレビュー
  if (rowImageUrls && rowImageUrls.length > 0) {
    const imgDiv = document.createElement('div')
    imgDiv.style.marginTop = '4px'
    imgDiv.style.paddingTop = '4px'
    imgDiv.style.borderTop = `1px solid ${colors.divider}`
    imgDiv.style.display = 'flex'
    imgDiv.style.flexDirection = 'column'
    imgDiv.style.gap = '4px'

    // 最初の1枚だけプレビュー表示
    const imgEl = document.createElement('img')
    setImageSrc(imgEl, rowImageUrls[0]!)
    imgEl.style.maxWidth = '280px'
    imgEl.style.maxHeight = '160px'
    imgEl.style.objectFit = 'contain'
    imgEl.style.borderRadius = '4px'
    imgEl.style.display = 'block'
    imgEl.draggable = false
    imgDiv.appendChild(imgEl)

    if (rowImageUrls.length > 1) {
      const moreDiv = document.createElement('div')
      moreDiv.style.fontSize = '10px'
      moreDiv.style.opacity = '0.6'
      moreDiv.style.textAlign = 'center'
      moreDiv.textContent = `🖼️ 他 ${rowImageUrls.length - 1} 枚の画像`
      imgDiv.appendChild(moreDiv)
    }
    container.appendChild(imgDiv)
  }

  // タスク数 & コメント数
  const metaItems: string[] = []
  if (taskCount > 0) {
    metaItems.push(`📋 タスク ${taskCount}件`)
  }
  if (commentCount && commentCount > 0) {
    metaItems.push(`💬 コメント ${commentCount}件`)
  }
  if (imageCount > 0) {
    metaItems.push(`🖼️ 画像 ${imageCount}枚`)
  }
  if (metaItems.length > 0) {
    const metaDiv = document.createElement('div')
    metaDiv.style.fontSize = '11px'
    metaDiv.style.color = colors.textMuted
    metaDiv.style.borderTop = `1px solid ${colors.divider}`
    metaDiv.style.paddingTop = '4px'
    metaDiv.textContent = metaItems.join('  ·  ')
    container.appendChild(metaDiv)
  }

  return container
}

/** ラベルフィルターのコーナーセルを生成するファクトリ関数のオプション */
export interface CornerContentOptions {
  /** 利用可能なラベルの一覧 */
  availableLabels: { name: string; color: string }[]
  /** 現在選択中のラベル名の配列 */
  selectedLabels: string[]
  /** 選択変更時のコールバック */
  onSelectionChange: (labels: string[]) => void
}

/**
 * ガントチャートの左上コーナーセルにラベルフィルタアイコンとポップアップを表示するコンテンツを生成する。
 * moguchart の customRendering.cornerContent に渡す関数を返す。
 */
export const createCornerContent = (getOptions: () => CornerContentOptions) => {
  return () => {
    const { selectedLabels: initSelectedLabels } = getOptions()
    const isDark = !!document.querySelector('.v-theme--dark')

    const hasFilter = initSelectedLabels.length > 0

    // --- フィルタアイコンボタン ---
    const btn = document.createElement('button')
    btn.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      width: 38px;
      height: 38px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      background: ${hasFilter ? (isDark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.15)') : 'transparent'};
      color: ${hasFilter ? (isDark ? '#a5b4fc' : '#4f46e5') : isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'};
      transition: background 0.15s, color 0.15s;
      position: relative;
    `
    btn.title = 'ラベル絞り込み'

    // フィルタアイコン（SVG）
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('width', '20')
    svg.setAttribute('height', '20')
    svg.setAttribute('viewBox', '0 0 24 24')
    svg.setAttribute('fill', 'currentColor')
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', 'M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z')
    svg.appendChild(path)
    btn.appendChild(svg)

    // アクティブバッジ（常時生成・フィルタ未使用時は非表示）
    const badge = document.createElement('span')
    badge.style.cssText = `
      position: absolute;
      top: 4px;
      right: 4px;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: ${isDark ? '#818cf8' : '#4f46e5'};
      display: ${hasFilter ? 'block' : 'none'};
    `
    btn.appendChild(badge)

    // ボタンの外観をフィルタ状態に合わせて更新する関数
    const updateBtnAppearance = () => {
      const { selectedLabels } = getOptions()
      const active = selectedLabels.length > 0
      btn.style.background = active ? (isDark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.15)') : 'transparent'
      btn.style.color = active ? (isDark ? '#a5b4fc' : '#4f46e5') : isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'
      badge.style.display = active ? 'block' : 'none'
    }

    btn.addEventListener('mouseenter', () => {
      const { selectedLabels } = getOptions()
      if (selectedLabels.length === 0) {
        btn.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
      }
    })
    btn.addEventListener('mouseleave', () => {
      const { selectedLabels } = getOptions()
      if (selectedLabels.length === 0) {
        btn.style.background = 'transparent'
      }
    })

    // --- ポップアップパネル ---
    let panel: HTMLElement | null = null

    const removePanel = () => {
      if (panel) {
        panel.remove()
        panel = null
      }
    }

    const createPanel = () => {
      const isDarkNow = !!document.querySelector('.v-theme--dark')
      const bg = isDarkNow ? '#1e1e2e' : '#ffffff'
      const text = isDarkNow ? 'rgba(255,255,255,0.87)' : 'rgba(0,0,0,0.87)'
      const border = isDarkNow ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'
      const hoverBg = isDarkNow ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'

      const p = document.createElement('div')
      p.style.cssText = `
        position: fixed;
        z-index: 9999;
        background: ${bg};
        color: ${text};
        border: 1px solid ${border};
        border-radius: 10px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.18);
        min-width: 220px;
        max-width: 280px;
        overflow: hidden;
        font-size: 13px;
        user-select: none;
      `

      // パネルの位置（ボタンの下）
      const rect = btn.getBoundingClientRect()
      p.style.left = `${rect.left}px`
      p.style.top = `${rect.bottom + 4}px`

      // --- ヘッダー ---
      const header = document.createElement('div')
      header.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 12px 6px;
        font-weight: bold;
        font-size: 12px;
        color: ${isDarkNow ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'};
        letter-spacing: 0.5px;
        text-transform: uppercase;
      `
      const headerTitle = document.createElement('span')
      headerTitle.textContent = 'ラベル絞り込み'
      header.appendChild(headerTitle)

      const clearBtn = document.createElement('button')
      clearBtn.textContent = 'クリア'
      clearBtn.style.cssText = `
        border: none;
        background: none;
        cursor: pointer;
        color: ${isDarkNow ? '#a5b4fc' : '#4f46e5'};
        font-size: 11px;
        font-weight: bold;
        padding: 2px 4px;
        border-radius: 4px;
        transition: opacity 0.15s;
      `
      clearBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        const { onSelectionChange: onChange } = getOptions()
        onChange([])
        removePanel()
      })
      header.appendChild(clearBtn)
      p.appendChild(header)

      const divider = document.createElement('div')
      divider.style.cssText = `height: 1px; background: ${border}; margin: 0 0 4px;`
      p.appendChild(divider)

      // --- アイテムコンテナ ---
      const itemsContainer = document.createElement('div')
      p.appendChild(itemsContainer)

      // アイテムを描画・再描画する関数
      const renderItems = () => {
        const { availableLabels: labels, selectedLabels: selected, onSelectionChange: onChange } = getOptions()

        const allItems = [
          { name: 'ラベルなし', color: '#9e9e9e', value: UNLABELED_VALUE },
          ...labels.map((l) => ({ name: l.name, color: l.color, value: l.name })),
        ]

        // 既存の行をクリアして再描画
        itemsContainer.innerHTML = ''

        allItems.forEach((item) => {
          const isChecked = selected.includes(item.value)
          const row = document.createElement('div')
          row.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 7px 12px;
            cursor: pointer;
            border-radius: 6px;
            margin: 0 4px;
            transition: background 0.12s;
          `

          row.addEventListener('mouseenter', () => {
            row.style.background = hoverBg
          })
          row.addEventListener('mouseleave', () => {
            row.style.background = 'transparent'
          })

          // チェックボックス
          const check = document.createElement('div')
          check.style.cssText = `
            width: 16px;
            height: 16px;
            border-radius: 4px;
            border: 2px solid ${isChecked ? item.color : isDarkNow ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)'};
            background: ${isChecked ? item.color : 'transparent'};
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            transition: all 0.12s;
          `
          if (isChecked) {
            const checkSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
            checkSvg.setAttribute('width', '10')
            checkSvg.setAttribute('height', '10')
            checkSvg.setAttribute('viewBox', '0 0 24 24')
            checkSvg.setAttribute('fill', getContrastColor(item.color))
            const checkPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
            checkPath.setAttribute('d', 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z')
            checkSvg.appendChild(checkPath)
            check.appendChild(checkSvg)
          }

          // ラベルチップ
          const chip = document.createElement('span')
          chip.textContent = item.name
          chip.style.cssText = `
            background: ${item.color};
            color: ${getContrastColor(item.color)};
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: bold;
            flex-shrink: 0;
          `

          row.appendChild(check)
          row.appendChild(chip)
          itemsContainer.appendChild(row)

          row.addEventListener('click', (e) => {
            e.stopPropagation()
            const { selectedLabels: currentSelected, onSelectionChange: currentOnChange } = getOptions()
            let next: string[]
            if (currentSelected.includes(item.value)) {
              next = currentSelected.filter((v) => v !== item.value)
            } else {
              next = [...currentSelected, item.value]
            }
            currentOnChange(next)
            // パネルは閉じず、チェック状態とボタン外観を更新する
            renderItems()
            updateBtnAppearance()
          })
        })
      }

      // 初回描画
      renderItems()

      // 全選択ボタン
      const footer = document.createElement('div')
      footer.style.cssText = `
        padding: 6px 8px 8px;
        border-top: 1px solid ${border};
        margin-top: 4px;
        display: flex;
        gap: 6px;
      `
      const selectAllBtn = document.createElement('button')
      selectAllBtn.textContent = 'すべて選択'
      selectAllBtn.style.cssText = `
        flex: 1;
        border: none;
        background: ${isDarkNow ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.1)'};
        color: ${isDarkNow ? '#a5b4fc' : '#4f46e5'};
        border-radius: 6px;
        padding: 5px 8px;
        font-size: 11px;
        font-weight: bold;
        cursor: pointer;
        transition: background 0.12s;
      `
      selectAllBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        const { availableLabels: latestLabels, onSelectionChange: latestOnChange } = getOptions()
        latestOnChange([...latestLabels.map((l) => l.name), UNLABELED_VALUE])
        removePanel()
      })
      footer.appendChild(selectAllBtn)
      p.appendChild(footer)

      return p
    }

    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      if (panel) {
        removePanel()
        return
      }
      panel = createPanel()
      document.body.appendChild(panel)

      // 外クリックで閉じる
      const onOutside = (ev: MouseEvent) => {
        if (panel && !panel.contains(ev.target as Node) && ev.target !== btn) {
          removePanel()
          document.removeEventListener('mousedown', onOutside)
        }
      }
      // 次のイベントループで登録（今回のクリックに反応しないよう）
      setTimeout(() => document.addEventListener('mousedown', onOutside), 0)
    })

    return btn
  }
}
