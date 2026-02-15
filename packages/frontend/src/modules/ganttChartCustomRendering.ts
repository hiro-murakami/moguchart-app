import dayjs from 'dayjs'
import { getContrastColor, toDateString } from '@/modules/utils'
import * as moguchart from '@mogura/moguchart'

export const barContent = (task: moguchart.GanttTask) => {
  const taskWithAttr = task as any
  const labels = taskWithAttr.attribute?.labels as { name: string; color: string }[] | undefined
  const description = taskWithAttr.attribute?.description as string | undefined

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
  container.style.userSelect = 'none'

  const headerContainer = document.createElement('div')
  headerContainer.style.display = 'flex'
  headerContainer.style.alignItems = 'center'
  headerContainer.style.gap = '6px'
  headerContainer.style.width = '100%'
  headerContainer.style.overflow = 'hidden'

  const nameSpan = document.createElement('span')
  nameSpan.style.cssText = `font-weight: bold; font-size: 12px; text-shadow: 1px 1px 2px rgba(0,0,0,0.5); color: white; white-space: nowrap; ${task.labelStyle || ''}`
  nameSpan.textContent = task.name || ''
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
  container.appendChild(headerContainer)

  if (description) {
    const descSpan = document.createElement('span')
    descSpan.style.cssText = `font-size: 10px; opacity: 0.9; text-shadow: 1px 1px 2px rgba(0,0,0,0.5); color: white; overflow: hidden; text-overflow: ellipsis; width: 100%; display: block; ${task.labelStyle || ''}`
    descSpan.textContent = description
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
    descDiv.style.borderTop = '1px solid #eee'
    descDiv.textContent = description
    container.appendChild(descDiv)
  }

  return container
}

export const rowHeaderContent = (row: moguchart.GanttRow) => {
  const rowWithAttr = row as any
  const description = rowWithAttr.attribute?.description as string | undefined

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

  const nameDiv = document.createElement('div')
  nameDiv.style.fontWeight = 'bold'
  nameDiv.style.fontSize = '14px'
  nameDiv.style.whiteSpace = 'nowrap'
  nameDiv.style.overflow = 'hidden'
  nameDiv.style.textOverflow = 'ellipsis'
  nameDiv.style.color = 'rgb(var(--v-theme-on-surface))'
  nameDiv.textContent = row.name
  container.appendChild(nameDiv)

  if (description) {
    const descDiv = document.createElement('div')
    descDiv.style.fontSize = '11px'
    descDiv.style.color = 'rgba(var(--v-theme-on-surface), 0.6)'
    descDiv.style.marginTop = '2px'
    descDiv.style.whiteSpace = 'nowrap'
    descDiv.style.overflow = 'hidden'
    descDiv.style.textOverflow = 'ellipsis'
    descDiv.textContent = description
    container.appendChild(descDiv)
  }

  return container
}
