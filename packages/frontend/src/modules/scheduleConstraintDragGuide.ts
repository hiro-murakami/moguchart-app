import { toLocalDate } from '@/modules/utils'
import type { ProjectGranularity, TaskAttribute, TaskConstraintType } from '@functions/types/shared'
import * as moguchart from '@mogura/moguchart-core'
import dayjs from 'dayjs'

interface TaskConstraintInfo {
  type: TaskConstraintType
  date: Date
  isMilestone: boolean
  taskName: string
}

interface ActiveBoundary {
  type: TaskConstraintType
  boundaryDate: Date
  labelText: string
  isViolating: boolean
}

interface ActiveConstraintDragState {
  snet?: ActiveBoundary
  fnlt?: ActiveBoundary
}

export interface ScheduleConstraintDragGuideDeps {
  getChartElement: () => moguchart.GanttChartElement | null | undefined
  getGranularity: () => ProjectGranularity | undefined
  getAutoScheduleOptions: () => moguchart.AutoScheduleOptions
  getPreserveWorkingDaysOnDrag: () => boolean
}

const isSummaryTask = (task: moguchart.GanttTask): boolean => {
  return task.type === 'summary' || String(task.id).endsWith('-summary') || Boolean((task as any).isSummary)
}

const extractTaskConstraint = (task: moguchart.GanttTask): TaskConstraintInfo | null => {
  if (!task || isSummaryTask(task)) return null
  const attr = (task as unknown as { attribute?: TaskAttribute }).attribute
  const type = (task.constraintType ?? attr?.constraintType) as TaskConstraintType | undefined
  if (type !== 'SNET' && type !== 'FNLT') return null

  const rawDate = task.constraintDate ?? attr?.constraintDate
  if (!rawDate) return null

  const parsed = rawDate instanceof Date ? new Date(rawDate.getTime()) : toLocalDate(String(rawDate))
  if (Number.isNaN(parsed.getTime())) return null

  const isMilestone = moguchart.isMilestoneTask(task) || attr?.type === 'milestone'
  return {
    type,
    date: parsed,
    isMilestone,
    taskName: task.name || '',
  }
}

const formatConstraintDateLabel = (
  constraintDate: Date,
  constraintType: TaskConstraintType,
  isMilestone: boolean,
  granularity?: ProjectGranularity,
): string => {
  const cDate = dayjs(constraintDate)
  if (granularity === 'monthly') {
    const display =
      constraintType === 'FNLT' && !isMilestone ? cDate.subtract(1, 'day').startOf('month') : cDate
    return display.format('YYYY/MM')
  }
  if (granularity === 'hourly') {
    return cDate.format('YYYY/MM/DD HH:mm')
  }
  const display =
    constraintType === 'FNLT' && !isMilestone && cDate.hour() === 0 && cDate.minute() === 0
      ? cDate.subtract(1, 'day')
      : cDate
  return display.format('YYYY/MM/DD')
}

const buildBadgeText = (
  constraint: TaskConstraintInfo,
  effectiveDate: Date,
  granularity: ProjectGranularity | undefined,
  includeTaskName: boolean,
  isViolating: boolean,
): string => {
  const dateStr = formatConstraintDateLabel(effectiveDate, constraint.type, constraint.isMilestone, granularity)
  const prefixName =
    includeTaskName && constraint.taskName
      ? `${constraint.taskName.length > 14 ? `${constraint.taskName.slice(0, 14)}…` : constraint.taskName}: `
      : ''
  if (constraint.type === 'SNET') {
    return `${isViolating ? '⚠' : '⇥'} ${prefixName}${dateStr} 以降に開始 (SNET)`
  }
  return `${isViolating ? '⚠ ' : ''}${prefixName}${dateStr} までに終了 (FNLT)${isViolating ? '' : ' ⇥'}`
}

export const createScheduleConstraintDragGuide = (deps: ScheduleConstraintDragGuideDeps) => {
  let activeState: ActiveConstraintDragState | null = null
  let lastOverlayCtx: {
    theme: 'light' | 'dark'
    contentWidth: number
    totalHeight: number
    calendarHeight: number
    rowHeaderWidth: number
    viewportWidth: number
    viewportHeight: number
    scrollLeft: number
    scrollTop: number
    getDateX: (d: Date) => number
  } | null = null

  // 再利用するオーバーレイDOM要素群
  let rootEl: HTMLDivElement | null = null
  let snetShadeEl: HTMLDivElement | null = null
  let snetLineEl: HTMLDivElement | null = null
  let snetBadgeEl: HTMLDivElement | null = null
  let fnltShadeEl: HTMLDivElement | null = null
  let fnltLineEl: HTMLDivElement | null = null
  let fnltBadgeEl: HTMLDivElement | null = null

  const ensureDOMElements = () => {
    if (rootEl || typeof document === 'undefined') return
    rootEl = document.createElement('div')
    rootEl.className = 'schedule-constraint-drag-guide'
    rootEl.style.cssText = 'position: absolute; inset: 0; pointer-events: none; overflow: visible;'

    const createShade = () => {
      const el = document.createElement('div')
      el.style.cssText =
        'position: absolute; top: 0; pointer-events: none; display: none; transition: background-color 0.12s ease;'
      return el
    }

    const createLine = () => {
      const el = document.createElement('div')
      el.style.cssText =
        'position: absolute; top: 0; width: 0; pointer-events: none; display: none; box-sizing: border-box;'
      return el
    }

    const createBadge = () => {
      const el = document.createElement('div')
      el.style.cssText = [
        'position: absolute',
        'pointer-events: none',
        'display: none',
        'padding: 3px 8px',
        'border-radius: 4px',
        'font-size: 11px',
        'font-weight: 600',
        'line-height: 1.3',
        'white-space: nowrap',
        'box-shadow: 0 2px 6px rgba(0, 0, 0, 0.28)',
        'z-index: 2',
        'letter-spacing: 0.01em',
      ].join('; ')
      return el
    }

    snetShadeEl = createShade()
    snetLineEl = createLine()
    snetBadgeEl = createBadge()
    fnltShadeEl = createShade()
    fnltLineEl = createLine()
    fnltBadgeEl = createBadge()

    rootEl.appendChild(snetShadeEl)
    rootEl.appendChild(fnltShadeEl)
    rootEl.appendChild(snetLineEl)
    rootEl.appendChild(fnltLineEl)
    rootEl.appendChild(snetBadgeEl)
    rootEl.appendChild(fnltBadgeEl)
  }

  const getNonWorkingDayChecker = (): ((ms: number) => boolean) | undefined => {
    if (!deps.getPreserveWorkingDaysOnDrag()) return undefined
    const opts = deps.getAutoScheduleOptions()
    const effectiveMode =
      opts.calendarMode && opts.calendarMode !== 'calendar'
        ? opts.calendarMode
        : opts.isHoliday
          ? 'weekends-holidays'
          : 'weekends'
    return moguchart.createNonWorkingDayChecker(effectiveMode, opts.isHoliday, opts.nonWorkingDays) ?? undefined
  }

  const resolveEffectiveSnetDate = (
    constraint: TaskConstraintInfo,
    isMoveOperation: boolean,
    checker?: (ms: number) => boolean,
  ): Date => {
    if (isMoveOperation && !constraint.isMilestone && checker) {
      return new Date(moguchart.snapToWorkingStartMs(constraint.date.getTime(), checker))
    }
    return constraint.date
  }

  const applyBoundaryStyles = (
    shadeEl: HTMLDivElement,
    lineEl: HTMLDivElement,
    badgeEl: HTMLDivElement,
    boundary: ActiveBoundary | undefined,
    ctx: NonNullable<typeof lastOverlayCtx>,
    badgeVerticalOffsetPx: number,
  ) => {
    if (!boundary) {
      shadeEl.style.display = 'none'
      lineEl.style.display = 'none'
      badgeEl.style.display = 'none'
      return
    }

    const isDark = ctx.theme === 'dark'
    const isViolating = boundary.isViolating
    const timelineViewportWidth = Math.max(0, ctx.viewportWidth - ctx.rowHeaderWidth)
    const viewLeft = ctx.scrollLeft
    const viewRight = ctx.scrollLeft + timelineViewportWidth
    const renderClipMinX = Math.max(0, viewLeft - 400)
    const renderClipMaxX = Math.min(ctx.contentWidth, viewRight + 400)

    const timelineAvailableHeight = Math.max(0, ctx.viewportHeight - ctx.calendarHeight - 18)
    const overlayHeight =
      ctx.totalHeight >= timelineAvailableHeight
        ? ctx.totalHeight
        : Math.max(ctx.totalHeight, timelineAvailableHeight)

    const rawBoundaryX = ctx.getDateX(boundary.boundaryDate)
    const clampedLineX = Math.max(0, Math.min(ctx.contentWidth, rawBoundaryX))

    // シェード範囲計算（SNET: 0 .. boundaryX, FNLT: boundaryX .. contentWidth）
    const rawShadeStart = boundary.type === 'SNET' ? 0 : clampedLineX
    const rawShadeEnd = boundary.type === 'SNET' ? clampedLineX : ctx.contentWidth
    const shadeLeft = Math.max(rawShadeStart, renderClipMinX)
    const shadeRight = Math.min(rawShadeEnd, renderClipMaxX)
    const shadeWidth = Math.max(0, shadeRight - shadeLeft)

    if (shadeWidth > 0) {
      const baseBg = isViolating
        ? isDark
          ? 'rgba(69, 10, 10, 0.50)'
          : 'rgba(220, 38, 38, 0.14)'
        : isDark
          ? 'rgba(2, 6, 23, 0.48)'
          : 'rgba(15, 23, 42, 0.20)'
      const stripeColor = isViolating
        ? isDark
          ? 'rgba(248, 113, 113, 0.16)'
          : 'rgba(220, 38, 38, 0.11)'
        : isDark
          ? 'rgba(148, 163, 184, 0.11)'
          : 'rgba(15, 23, 42, 0.08)'

      shadeEl.style.display = 'block'
      shadeEl.style.left = `${shadeLeft}px`
      shadeEl.style.width = `${shadeWidth}px`
      shadeEl.style.height = `${overlayHeight}px`
      shadeEl.style.backgroundColor = baseBg
      shadeEl.style.backgroundImage = `repeating-linear-gradient(-45deg, ${stripeColor} 0px, ${stripeColor} 6px, transparent 6px, transparent 14px)`
    } else {
      shadeEl.style.display = 'none'
    }

    // 境界ライン（画面付近にある場合のみ表示）
    if (rawBoundaryX >= renderClipMinX && rawBoundaryX <= renderClipMaxX) {
      const lineColor = isViolating ? '#ef4444' : '#3b82f6'
      lineEl.style.display = 'block'
      lineEl.style.left = `${clampedLineX}px`
      lineEl.style.height = `${overlayHeight}px`
      lineEl.style.borderLeft = isViolating ? `2px solid ${lineColor}` : `2px dashed ${lineColor}`
      lineEl.style.boxShadow = isViolating ? '0 0 8px rgba(239, 68, 68, 0.65)' : 'none'
    } else {
      lineEl.style.display = 'none'
    }

    // ラベルバッジ（境界線またはシェード領域が可視範囲にかかっている場合に表示）
    const isRegionVisible =
      (rawBoundaryX >= viewLeft - 20 && rawBoundaryX <= viewRight + 20) ||
      (rawShadeEnd > viewLeft && rawShadeStart < viewRight)

    if (isRegionVisible && timelineViewportWidth > 80) {
      badgeEl.style.display = 'block'
      badgeEl.textContent = boundary.labelText
      if (isViolating) {
        badgeEl.style.backgroundColor = '#dc2626'
        badgeEl.style.color = '#ffffff'
        badgeEl.style.border = '1px solid rgba(255, 255, 255, 0.35)'
      } else {
        badgeEl.style.backgroundColor = isDark ? 'rgba(30, 58, 138, 0.94)' : 'rgba(37, 99, 235, 0.94)'
        badgeEl.style.color = '#ffffff'
        badgeEl.style.border = '1px solid rgba(147, 197, 253, 0.45)'
      }

      badgeEl.style.top = `${Math.max(4, ctx.scrollTop + badgeVerticalOffsetPx)}px`

      // 境界位置に寄せて配置し、タイムライン可視領域の左右端でクランプ
      const estimatedWidth = Math.max(160, boundary.labelText.length * 9 + 20)
      const minBadgeLeft = viewLeft + 8
      const maxBadgeLeft = Math.max(minBadgeLeft, viewRight - estimatedWidth - 12)
      const preferredLeft =
        boundary.type === 'SNET' ? clampedLineX + 6 : Math.max(0, clampedLineX - estimatedWidth - 6)
      const finalBadgeLeft = Math.max(minBadgeLeft, Math.min(maxBadgeLeft, preferredLeft))
      badgeEl.style.left = `${finalBadgeLeft}px`
    } else {
      badgeEl.style.display = 'none'
    }
  }

  const syncOverlayDOM = () => {
    if (!activeState || !lastOverlayCtx || !rootEl) return
    if (!snetShadeEl || !snetLineEl || !snetBadgeEl || !fnltShadeEl || !fnltLineEl || !fnltBadgeEl) return

    applyBoundaryStyles(snetShadeEl, snetLineEl, snetBadgeEl, activeState.snet, lastOverlayCtx, 8)
    const fnltOffset = activeState.snet ? 36 : 8
    applyBoundaryStyles(fnltShadeEl, fnltLineEl, fnltBadgeEl, activeState.fnlt, lastOverlayCtx, fnltOffset)
  }

  let globalCleanupAttached = false

  const detachGlobalSafetyListeners = () => {
    if (!globalCleanupAttached || typeof window === 'undefined') return
    globalCleanupAttached = false
    window.removeEventListener('pointerup', handleGlobalDragTerminate, true)
    window.removeEventListener('pointercancel', handleGlobalDragTerminate, true)
    window.removeEventListener('blur', handleGlobalDragTerminate)
  }

  const clearGuide = () => {
    const hadActive = activeState !== null
    activeState = null
    detachGlobalSafetyListeners()
    if (hadActive) {
      deps.getChartElement()?.requestUpdate()
    }
  }

  function handleGlobalDragTerminate() {
    if (!activeState) return
    // ドロップイベント処理の完了後に残存していれば確実に消去するセーフティネット
    requestAnimationFrame(() => {
      if (activeState) {
        clearGuide()
      }
    })
  }

  const attachGlobalSafetyListeners = () => {
    if (globalCleanupAttached || typeof window === 'undefined') return
    globalCleanupAttached = true
    window.addEventListener('pointerup', handleGlobalDragTerminate, true)
    window.addEventListener('pointercancel', handleGlobalDragTerminate, true)
    window.addEventListener('blur', handleGlobalDragTerminate)
  }

  const findTaskById = (
    rows: moguchart.GanttRow[],
    taskId: string,
  ): { row: moguchart.GanttRow; rowIndex: number; task: moguchart.GanttTask; taskIndex: number } | null => {
    const idStr = String(taskId)
    for (let rIdx = 0; rIdx < rows.length; rIdx++) {
      const row = rows[rIdx]!
      const tIdx = row.tasks.findIndex((t) => String(t.id) === idStr)
      if (tIdx !== -1) {
        return { row, rowIndex: rIdx, task: row.tasks[tIdx]!, taskIndex: tIdx }
      }
    }
    return null
  }

  /**
   * ドラッグ中・ドロップ時の task-update イベントを受け取り、移動可能範囲オーバーレイの状態を更新する
   */
  const handleTaskUpdateEvent = (detail: moguchart.TaskUpdateEventDetail & { mode?: string }) => {
    if (!detail.isDragging || detail.isCancel || detail.isOutside || detail.mode === 'copy') {
      clearGuide()
      return
    }

    const chartEl = deps.getChartElement()
    if (!chartEl) {
      clearGuide()
      return
    }

    const granularity = deps.getGranularity()
    const isMoveOperation = detail.dx !== undefined
    const checker = isMoveOperation ? getNonWorkingDayChecker() : undefined
    const selectedIds = detail.selectedTaskIds

    // 複数タスク一括移動時
    if (isMoveOperation && selectedIds && selectedIds.length >= 2) {
      const selectedSet = new Set(selectedIds.map(String))
      let strictestSnet: {
        constraint: TaskConstraintInfo
        effectiveDate: Date
        minAllowedDx: number
      } | null = null
      let strictestFnlt: {
        constraint: TaskConstraintInfo
        effectiveDate: Date
        maxAllowedDx: number
      } | null = null

      for (const row of chartEl.rows) {
        for (const task of row.tasks) {
          if (!selectedSet.has(String(task.id))) continue
          const constraint = extractTaskConstraint(task)
          if (!constraint) continue

          const origStart = new Date(task.start)
          const origEnd = new Date(task.end)

          if (constraint.type === 'SNET') {
            const effectiveDate = resolveEffectiveSnetDate(constraint, true, checker)
            const minAllowedDx = chartEl.getDateX(effectiveDate) - chartEl.getDateX(origStart)
            if (!strictestSnet || minAllowedDx > strictestSnet.minAllowedDx) {
              strictestSnet = { constraint, effectiveDate, minAllowedDx }
            }
          } else if (constraint.type === 'FNLT') {
            const effectiveDate = constraint.date
            const refEdge = constraint.isMilestone ? origStart : origEnd
            const maxAllowedDx = chartEl.getDateX(effectiveDate) - chartEl.getDateX(refEdge)
            if (!strictestFnlt || maxAllowedDx < strictestFnlt.maxAllowedDx) {
              strictestFnlt = { constraint, effectiveDate, maxAllowedDx }
            }
          }
        }
      }

      if (!strictestSnet && !strictestFnlt) {
        clearGuide()
        return
      }

      const dx = detail.dx ?? 0
      const nextState: ActiveConstraintDragState = {}

      if (strictestSnet) {
        const isViolating = dx < strictestSnet.minAllowedDx - 0.5
        nextState.snet = {
          type: 'SNET',
          boundaryDate: strictestSnet.effectiveDate,
          labelText: buildBadgeText(
            strictestSnet.constraint,
            strictestSnet.effectiveDate,
            granularity,
            true,
            isViolating,
          ),
          isViolating,
        }
      }

      if (strictestFnlt) {
        const isViolating = dx > strictestFnlt.maxAllowedDx + 0.5
        nextState.fnlt = {
          type: 'FNLT',
          boundaryDate: strictestFnlt.effectiveDate,
          labelText: buildBadgeText(
            strictestFnlt.constraint,
            strictestFnlt.effectiveDate,
            granularity,
            true,
            isViolating,
          ),
          isViolating,
        }
      }

      activeState = nextState
      attachGlobalSafetyListeners()
      syncOverlayDOM()
      return
    }

    // 単一タスクの移動またはリサイズ時
    const found = findTaskById(chartEl.rows, detail.id)
    if (!found) {
      clearGuide()
      return
    }

    const constraint = extractTaskConstraint(found.task)
    if (!constraint) {
      clearGuide()
      return
    }

    const currentStartMs = new Date(detail.start).getTime()
    const currentEndMs = new Date(detail.end).getTime()

    if (constraint.type === 'SNET') {
      const effectiveDate = resolveEffectiveSnetDate(constraint, isMoveOperation, checker)
      const isViolating = currentStartMs < effectiveDate.getTime()
      activeState = {
        snet: {
          type: 'SNET',
          boundaryDate: effectiveDate,
          labelText: buildBadgeText(constraint, constraint.date, granularity, false, isViolating),
          isViolating,
        },
      }
    } else {
      const effectiveDate = constraint.date
      const checkEdgeMs = constraint.isMilestone ? currentStartMs : currentEndMs
      const isViolating = checkEdgeMs > effectiveDate.getTime()
      activeState = {
        fnlt: {
          type: 'FNLT',
          boundaryDate: effectiveDate,
          labelText: buildBadgeText(constraint, effectiveDate, granularity, false, isViolating),
          isViolating,
        },
      }
    }

    attachGlobalSafetyListeners()
    syncOverlayDOM()
  }

  /**
   * 単一タスクの移動後の期間をスケジュール制約境界内にクランプする
   */
  const clampMovedTaskDates = (
    origTask: moguchart.GanttTask,
    proposedStart: Date,
    proposedEnd: Date,
    checker?: (ms: number) => boolean,
  ): { start: Date; end: Date; clamped: boolean } => {
    const constraint = extractTaskConstraint(origTask)
    if (!constraint) {
      return { start: proposedStart, end: proposedEnd, clamped: false }
    }

    const origStart = new Date(origTask.start)
    const origEnd = new Date(origTask.end)
    const granularity = deps.getGranularity()
    const isMonthly = granularity === 'monthly'

    if (constraint.isMilestone) {
      const cMs = constraint.date.getTime()
      if (constraint.type === 'SNET' && proposedStart.getTime() < cMs) {
        return { start: new Date(cMs), end: new Date(cMs), clamped: true }
      }
      if (constraint.type === 'FNLT' && proposedStart.getTime() > cMs) {
        return { start: new Date(cMs), end: new Date(cMs), clamped: true }
      }
      return { start: proposedStart, end: proposedEnd, clamped: false }
    }

    if (isMonthly) {
      const monthsCount = Math.max(
        1,
        (origEnd.getFullYear() - origStart.getFullYear()) * 12 + (origEnd.getMonth() - origStart.getMonth()),
      )
      if (constraint.type === 'SNET') {
        const minStart = dayjs(constraint.date).startOf('month').toDate()
        if (proposedStart.getTime() < minStart.getTime()) {
          const clampedEnd = dayjs(minStart).add(monthsCount, 'month').toDate()
          return { start: minStart, end: clampedEnd, clamped: true }
        }
      } else {
        const maxEnd = dayjs(constraint.date).startOf('month').toDate()
        if (proposedEnd.getTime() > maxEnd.getTime()) {
          const clampedStart = dayjs(maxEnd).subtract(monthsCount, 'month').toDate()
          return { start: clampedStart, end: maxEnd, clamped: true }
        }
      }
      return { start: proposedStart, end: proposedEnd, clamped: false }
    }

    if (checker && origEnd.getTime() > origStart.getTime()) {
      const workingDurationMs = moguchart.computeWorkingDurationMs(
        origStart.getTime(),
        origEnd.getTime(),
        checker,
      )
      if (constraint.type === 'SNET') {
        const minStartMs = moguchart.snapToWorkingStartMs(constraint.date.getTime(), checker)
        if (proposedStart.getTime() < minStartMs) {
          const clampedEndMs =
            workingDurationMs > 0
              ? moguchart.addWorkingTimeMs(minStartMs, workingDurationMs, checker)
              : minStartMs
          return { start: new Date(minStartMs), end: new Date(clampedEndMs), clamped: true }
        }
      } else {
        const maxEndMs = constraint.date.getTime()
        if (proposedEnd.getTime() > maxEndMs) {
          const clampedStartMs =
            workingDurationMs > 0
              ? moguchart.addWorkingTimeMs(maxEndMs, -workingDurationMs, checker)
              : maxEndMs
          const clampedEndMs =
            workingDurationMs > 0
              ? moguchart.addWorkingTimeMs(clampedStartMs, workingDurationMs, checker)
              : clampedStartMs
          return { start: new Date(clampedStartMs), end: new Date(clampedEndMs), clamped: true }
        }
      }
      return { start: proposedStart, end: proposedEnd, clamped: false }
    }

    const durationMs = Math.max(0, origEnd.getTime() - origStart.getTime())
    if (constraint.type === 'SNET') {
      const minStartMs = constraint.date.getTime()
      if (proposedStart.getTime() < minStartMs) {
        return { start: new Date(minStartMs), end: new Date(minStartMs + durationMs), clamped: true }
      }
    } else {
      const maxEndMs = constraint.date.getTime()
      if (proposedEnd.getTime() > maxEndMs) {
        return { start: new Date(maxEndMs - durationMs), end: new Date(maxEndMs), clamped: true }
      }
    }

    return { start: proposedStart, end: proposedEnd, clamped: false }
  }

  /**
   * 単一タスクのリサイズ後の期間をスケジュール制約境界内にクランプする
   */
  const clampResizedTaskDates = (
    origTask: moguchart.GanttTask,
    proposedStart: Date,
    proposedEnd: Date,
    chartEl: moguchart.GanttChartElement,
  ): { start: Date; end: Date; clamped: boolean } => {
    const constraint = extractTaskConstraint(origTask)
    if (!constraint || constraint.isMilestone) {
      return { start: proposedStart, end: proposedEnd, clamped: false }
    }

    const origStartMs = new Date(origTask.start).getTime()
    const origEndMs = new Date(origTask.end).getTime()
    const isMonthly = deps.getGranularity() === 'monthly'
    const snapMinutes = Math.max(1, chartEl.option?.snapDuration ?? (deps.getGranularity() === 'hourly' ? 60 : 1440))
    const minSnapMs = snapMinutes * 60 * 1000

    // 左端リサイズかつ SNET 違反
    if (
      constraint.type === 'SNET' &&
      proposedStart.getTime() !== origStartMs &&
      proposedStart.getTime() < constraint.date.getTime()
    ) {
      const clampedStart = isMonthly
        ? dayjs(constraint.date).startOf('month').toDate()
        : new Date(constraint.date.getTime())
      let clampedEnd = proposedEnd
      if (clampedEnd.getTime() <= clampedStart.getTime()) {
        clampedEnd = isMonthly
          ? dayjs(clampedStart).add(1, 'month').toDate()
          : new Date(clampedStart.getTime() + minSnapMs)
      }
      return { start: clampedStart, end: clampedEnd, clamped: true }
    }

    // 右端リサイズかつ FNLT 違反
    if (
      constraint.type === 'FNLT' &&
      proposedEnd.getTime() !== origEndMs &&
      proposedEnd.getTime() > constraint.date.getTime()
    ) {
      const clampedEnd = isMonthly
        ? dayjs(constraint.date).startOf('month').toDate()
        : new Date(constraint.date.getTime())
      let clampedStart = proposedStart
      if (clampedStart.getTime() >= clampedEnd.getTime()) {
        clampedStart = isMonthly
          ? dayjs(clampedEnd).subtract(1, 'month').toDate()
          : new Date(clampedEnd.getTime() - minSnapMs)
      }
      return { start: clampedStart, end: clampedEnd, clamped: true }
    }

    return { start: proposedStart, end: proposedEnd, clamped: false }
  }

  /**
   * dx（ピクセル差）からタスクの新しい開始・終了日時を算出する（複数選択移動用）
   */
  const computeTaskShiftedDatesFromDx = (
    task: moguchart.GanttTask,
    dx: number,
    chartEl: moguchart.GanttChartElement,
    checker?: (ms: number) => boolean,
  ): { start: Date; end: Date } => {
    const origStart = new Date(task.start)
    const origEnd = new Date(task.end)
    const isMilestone = moguchart.isMilestoneTask(task) || (task as any).attribute?.type === 'milestone'

    if (chartEl.effectivePxPerMonth) {
      const diffMonths = Math.round(dx / chartEl.effectivePxPerMonth)
      const ns = dayjs(origStart).add(diffMonths, 'month').startOf('month').toDate()
      const ne = isMilestone ? new Date(ns.getTime()) : dayjs(origEnd).add(diffMonths, 'month').startOf('month').toDate()
      return { start: ns, end: ne }
    }

    const pxPerDay = chartEl.effectivePxPerDay || 50
    const snapMinutes = Math.max(1, chartEl.option?.snapDuration ?? 1440)
    const rawMinutes = (dx / pxPerDay) * 1440
    const snappedMinutes = Math.round(rawMinutes / snapMinutes) * snapMinutes

    if (snapMinutes >= 43200) {
      const approxMonths = Math.round(snappedMinutes / 43200)
      const ns = dayjs(origStart).add(approxMonths, 'month').startOf('month').toDate()
      const ne = isMilestone ? new Date(ns.getTime()) : dayjs(origEnd).add(approxMonths, 'month').startOf('month').toDate()
      return { start: ns, end: ne }
    }

    const shiftMs = snappedMinutes * 60 * 1000
    const rawStart = new Date(origStart.getTime() + shiftMs)
    const rawEnd = isMilestone ? new Date(rawStart.getTime()) : new Date(origEnd.getTime() + shiftMs)

    if (!isMilestone && checker && origEnd.getTime() > origStart.getTime()) {
      const workingDurationMs = moguchart.computeWorkingDurationMs(
        origStart.getTime(),
        origEnd.getTime(),
        checker,
      )
      const snappedStartMs = moguchart.snapToWorkingStartMs(rawStart.getTime(), checker)
      const adjustedEndMs =
        workingDurationMs > 0
          ? moguchart.addWorkingTimeMs(snappedStartMs, workingDurationMs, checker)
          : snappedStartMs
      return { start: new Date(snappedStartMs), end: new Date(adjustedEndMs) }
    }

    return { start: rawStart, end: rawEnd }
  }

  /**
   * ドロップ確定直前のフック: スケジュール制約の移動不可領域にはみ出している場合は境界にクランプする
   */
  const handleBeforeTaskUpdate = (
    detail: moguchart.TaskUpdateEventDetail & { mode?: string },
  ): boolean => {
    clearGuide()

    if (detail.mode === 'copy') {
      return true
    }

    const chartEl = deps.getChartElement()
    if (!chartEl) return true

    const previousRows = chartEl.rows
    const isMoveOperation = detail.dx !== undefined
    const checker = isMoveOperation ? getNonWorkingDayChecker() : undefined
    const selectedIds = detail.selectedTaskIds

    // 1. 複数タスク一括移動時のクランプ判定
    if (isMoveOperation && selectedIds && selectedIds.length >= 2 && detail.dx !== undefined) {
      const selectedSet = new Set(selectedIds.map(String))
      const dx = detail.dx
      let clampedDx = dx
      let needsClamp = false

      for (const row of previousRows) {
        for (const task of row.tasks) {
          if (!selectedSet.has(String(task.id))) continue
          const constraint = extractTaskConstraint(task)
          if (!constraint) continue

          const origStart = new Date(task.start)
          const origEnd = new Date(task.end)

          if (constraint.type === 'SNET' && dx < 0) {
            const effectiveDate = resolveEffectiveSnetDate(constraint, true, checker)
            // 元々制約内だった場合は境界まで、元々違反していた場合は左方向への追加移動を0に抑える
            const minAllowedDx = Math.min(0, chartEl.getDateX(effectiveDate) - chartEl.getDateX(origStart))
            if (clampedDx < minAllowedDx - 0.5) {
              clampedDx = minAllowedDx
              needsClamp = true
            }
          } else if (constraint.type === 'FNLT' && dx > 0) {
            const refEdge = constraint.isMilestone ? origStart : origEnd
            const maxAllowedDx = Math.max(0, chartEl.getDateX(constraint.date) - chartEl.getDateX(refEdge))
            if (clampedDx > maxAllowedDx + 0.5) {
              clampedDx = maxAllowedDx
              needsClamp = true
            }
          }
        }
      }

      if (!needsClamp) {
        return true
      }

      const foundMain = findTaskById(previousRows, detail.id)
      if (!foundMain) return true

      // 全選択タスクが同一行にあるかの確認（行跨ぎ移動の可否）
      let commonRowId: string | null = null
      let allSameRow = true
      for (const row of previousRows) {
        for (const task of row.tasks) {
          if (selectedSet.has(String(task.id))) {
            if (commonRowId === null) commonRowId = String(row.id)
            else if (commonRowId !== String(row.id)) allSameRow = false
          }
        }
      }

      const allowCrossRowMove = chartEl.option?.enableCrossRowMove !== false
      const targetRowIndex =
        allowCrossRowMove && detail.targetRowId != null
          ? previousRows.findIndex((r) => String(r.id) === String(detail.targetRowId))
          : -1
      const needsRowMove =
        allowCrossRowMove && allSameRow && targetRowIndex !== -1 && targetRowIndex !== foundMain.rowIndex

      if (Math.abs(clampedDx) < 0.5 && !needsRowMove) {
        // 移動量が0にクランプされ行移動もない場合はそのままキャンセル（元の位置へ復帰）
        return false
      }

      let newRows: moguchart.GanttRow[]
      let minDroppedStart = new Date(8640000000000000)
      let maxDroppedEnd = new Date(-8640000000000000)
      let hasAnyActualDiff = needsRowMove

      if (needsRowMove) {
        newRows = [...previousRows]
        const sourceRow = { ...newRows[foundMain.rowIndex]!, tasks: [...newRows[foundMain.rowIndex]!.tasks] }
        const targetRow = { ...newRows[targetRowIndex]!, tasks: [...newRows[targetRowIndex]!.tasks] }
        const movedTasks: moguchart.GanttTask[] = []

        sourceRow.tasks = sourceRow.tasks.filter((t) => {
          if (!selectedSet.has(String(t.id))) return true
          const shifted = computeTaskShiftedDatesFromDx(t, clampedDx, chartEl, checker)
          const clamped = clampMovedTaskDates(t, shifted.start, shifted.end, checker)
          if (clamped.start < minDroppedStart) minDroppedStart = clamped.start
          if (clamped.end > maxDroppedEnd) maxDroppedEnd = clamped.end
          movedTasks.push({ ...t, start: clamped.start, end: clamped.end })
          return false
        })
        targetRow.tasks.push(...movedTasks)
        newRows[foundMain.rowIndex] = sourceRow
        newRows[targetRowIndex] = targetRow
      } else {
        newRows = previousRows.map((row) => {
          if (!row.tasks.some((t) => selectedSet.has(String(t.id)))) return row
          return {
            ...row,
            tasks: row.tasks.map((t) => {
              if (!selectedSet.has(String(t.id))) return t
              const shifted = computeTaskShiftedDatesFromDx(t, clampedDx, chartEl, checker)
              const clamped = clampMovedTaskDates(t, shifted.start, shifted.end, checker)
              if (
                clamped.start.getTime() !== new Date(t.start).getTime() ||
                clamped.end.getTime() !== new Date(t.end).getTime()
              ) {
                hasAnyActualDiff = true
              }
              if (clamped.start < minDroppedStart) minDroppedStart = clamped.start
              if (clamped.end > maxDroppedEnd) maxDroppedEnd = clamped.end
              return { ...t, start: clamped.start, end: clamped.end }
            }),
          }
        })
      }

      if (!hasAnyActualDiff) {
        return false
      }

      if (chartEl.option?.dependency?.autoSchedule) {
        const scheduleResult = moguchart.propagateAutoSchedule(
          newRows,
          selectedSet,
          deps.getAutoScheduleOptions(),
        )
        if (scheduleResult.hasChanges) {
          newRows = scheduleResult.rows
        }
      }

      ;(chartEl as any).maybeAutoExtendCalendar?.(minDroppedStart, maxDroppedEnd, false)

      queueMicrotask(() => {
        chartEl.applyRowsChangeWithCommand(previousRows, newRows, {
          type: 'task-move',
          description: '複数タスクの移動',
        })
        chartEl.pluginManager?.executeAfterTaskUpdate(detail)
      })

      return false
    }

    // 2. 単一タスクの移動・リサイズ時のクランプ判定
    const found = findTaskById(previousRows, detail.id)
    if (!found) return true

    const origTask = found.task
    const origStart = new Date(origTask.start)
    const origEnd = new Date(origTask.end)
    const proposedStart = new Date(detail.start)
    const proposedEnd = new Date(detail.end)

    const clampResult = isMoveOperation
      ? clampMovedTaskDates(origTask, proposedStart, proposedEnd, checker)
      : clampResizedTaskDates(origTask, proposedStart, proposedEnd, chartEl)

    if (!clampResult.clamped) {
      return true
    }

    const allowCrossRowMove = chartEl.option?.enableCrossRowMove !== false
    const targetRowIndex =
      allowCrossRowMove && isMoveOperation && detail.targetRowId != null
        ? previousRows.findIndex((r) => String(r.id) === String(detail.targetRowId))
        : found.rowIndex
    const effectiveTargetRowIndex = targetRowIndex !== -1 ? targetRowIndex : found.rowIndex
    const isSameRow = effectiveTargetRowIndex === found.rowIndex
    const isSameDates =
      clampResult.start.getTime() === origStart.getTime() &&
      clampResult.end.getTime() === origEnd.getTime()

    if (isSameRow && isSameDates) {
      // 既に境界位置にあり実質的な変更がない場合はキャンセル扱いで元の位置へ戻す
      return false
    }

    let newRows = [...previousRows]
    const sourceRow = { ...newRows[found.rowIndex]!, tasks: [...newRows[found.rowIndex]!.tasks] }
    newRows[found.rowIndex] = sourceRow

    if (!isSameRow) {
      const targetRow = {
        ...newRows[effectiveTargetRowIndex]!,
        tasks: [...newRows[effectiveTargetRowIndex]!.tasks],
      }
      newRows[effectiveTargetRowIndex] = targetRow
      const [movedTask] = sourceRow.tasks.splice(found.taskIndex, 1)
      if (movedTask) {
        targetRow.tasks.push({ ...movedTask, start: clampResult.start, end: clampResult.end })
      }
    } else {
      sourceRow.tasks[found.taskIndex] = {
        ...origTask,
        start: clampResult.start,
        end: clampResult.end,
      }
    }

    if (chartEl.option?.dependency?.autoSchedule) {
      const scheduleResult = moguchart.propagateAutoSchedule(
        newRows,
        [String(detail.id)],
        deps.getAutoScheduleOptions(),
      )
      if (scheduleResult.hasChanges) {
        newRows = scheduleResult.rows
      }
    }

    ;(chartEl as any).maybeAutoExtendCalendar?.(clampResult.start, clampResult.end, false)

    const clampedDetail: moguchart.TaskUpdateEventDetail = {
      ...detail,
      start: clampResult.start,
      end: clampResult.end,
    }

    queueMicrotask(() => {
      chartEl.applyRowsChangeWithCommand(previousRows, newRows, {
        type: isMoveOperation ? 'task-move' : 'task-resize',
        description: isMoveOperation ? 'タスクの移動' : 'タスク期間の変更',
      })
      chartEl.pluginManager?.executeAfterTaskUpdate(clampedDetail)
    })

    return false
  }

  const plugin: moguchart.GanttPlugin = {
    name: 'schedule-constraint-drag-guide',
    renderOverlay: (ctx) => {
      if (ctx.isExporting) return null
      lastOverlayCtx = {
        theme: ctx.theme,
        contentWidth: ctx.contentWidth,
        totalHeight: ctx.totalHeight,
        calendarHeight: ctx.calendarHeight,
        rowHeaderWidth: ctx.rowHeaderWidth,
        viewportWidth: ctx.viewportWidth,
        viewportHeight: ctx.viewportHeight,
        scrollLeft: ctx.scrollLeft,
        scrollTop: ctx.scrollTop,
        getDateX: ctx.getDateX,
      }
      if (!activeState) return null
      ensureDOMElements()
      syncOverlayDOM()
      return rootEl
    },
    hooks: {
      beforeTaskUpdate: handleBeforeTaskUpdate,
      onViewportChange: (vp) => {
        if (!lastOverlayCtx) return
        lastOverlayCtx.scrollLeft = vp.scrollLeft
        lastOverlayCtx.scrollTop = vp.scrollTop
        lastOverlayCtx.viewportWidth = vp.viewportWidth
        lastOverlayCtx.viewportHeight = vp.viewportHeight
        if (activeState) {
          syncOverlayDOM()
        }
      },
    },
  }

  return {
    plugin,
    handleTaskUpdateEvent,
    clearGuide,
  }
}
