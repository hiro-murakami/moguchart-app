import dayjs from 'dayjs'
import { getContrastColor, toDateString } from '@/modules/utils'
import * as moguchart from '@mogura/moguchart'
import { selectTaskComments, selectComments } from '@/modules/scripts'
import type { Comment, TaskComment } from '@functions/types/shared'

const commentsCache = new Map<number, { data: TaskComment[]; fetchedAt: number }>()
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

/**
 * スナップショットモードなどAPI不要の場面で、コメントデータをキャッシュに事前ロードする。
 * fetchedAt を Infinity にすることでキャッシュ有効期限が切れないようにする。
 */
export const preloadCommentsCache = (entries: { taskId: number; comments: TaskComment[] }[]) => {
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

const renderComments = (container: HTMLElement, comments: TaskComment[], count: number) => {
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

export const barContent = (task: moguchart.GanttTask) => {
  const taskWithAttr = task as any
  const labels = taskWithAttr.attribute?.labels as { name: string; color: string }[] | undefined
  const description = taskWithAttr.attribute?.description as string | undefined
  const commentCount = taskWithAttr.commentCount as number | undefined

  const container = document.createElement('div')
  container.style.display = 'flex'
  container.style.flexDirection = 'column'
  container.style.justifyContent = 'flex-start'
  container.style.alignItems = 'flex-start'
  container.style.height = '100%'
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
      if (hideTimeout) { clearTimeout(hideTimeout); hideTimeout = null }
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
        selectTaskComments(taskId).then((comments) => {
          commentsCache.set(taskId, { data: comments, fetchedAt: Date.now() })
          if (tooltipEl) renderComments(tooltipEl, comments, commentCount)
        }).catch(() => {
          if (tooltipEl) tooltipEl.textContent = 'コメントの読み込みに失敗しました'
        })
      }
      document.body.appendChild(tooltipEl)
    }

    const removeTooltip = () => {
      if (hideTimeout) { clearTimeout(hideTimeout); hideTimeout = null }
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

export const tooltip = (task: moguchart.GanttTask) => {
  const taskWithAttr = task as any
  const labels = taskWithAttr.attribute?.labels as { name: string; color: string }[] | undefined
  const description = taskWithAttr.attribute?.description as string | undefined

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
  const days = end.diff(start, 'day') + 1
  dateSpan.textContent = `${toDateString(task.start, 'YYYY/MM/DD')} - ${toDateString(task.end, 'YYYY/MM/DD')} (${days}日)`
  container.appendChild(dateSpan)

  // タスク名
  const nameSpan = document.createElement('div')
  nameSpan.style.fontWeight = 'bold'
  nameSpan.style.fontSize = '14px'
  nameSpan.style.marginBottom = '4px'
  nameSpan.textContent = task.name || ''
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



  return container
}

export const rowHeaderContent = (row: moguchart.GanttRow) => {
  const rowWithAttr = row as any
  const description = rowWithAttr.attribute?.description as string | undefined
  const commentCount = rowWithAttr.commentCount as number | undefined

  const container = document.createElement('div')
  container.style.display = 'flex'
  container.style.flexDirection = 'column'
  container.style.justifyContent = 'start'
  container.style.height = '100%'
  container.style.padding = '4px 8px'
  container.style.overflow = 'hidden'
  container.style.width = '100%'
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
      if (hideTimeout) { clearTimeout(hideTimeout); hideTimeout = null }
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
        selectComments({ rowId }).then((comments) => {
          rowCommentsCache.set(rowId, { data: comments, fetchedAt: Date.now() })
          if (tooltipEl) renderComments(tooltipEl, comments, commentCount)
        }).catch(() => {
          if (tooltipEl) tooltipEl.textContent = 'コメントの読み込みに失敗しました'
        })
      }
      document.body.appendChild(tooltipEl)
    }

    const removeTooltip = () => {
      if (hideTimeout) { clearTimeout(hideTimeout); hideTimeout = null }
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
