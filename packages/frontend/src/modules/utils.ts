import type { DependencyType, ProjectGranularity, TaskDependency, TaskDependencyLink } from '@functions/types/shared'
import dayjs from 'dayjs'

export const toDateString = (value?: string | Date | dayjs.Dayjs, format: string = 'YYYY-MM-DD'): string => {
  return dayjs(value).format(format)
}

export const toDateTimeString = (value?: string | Date | dayjs.Dayjs): string => {
  return toDateString(value, 'YYYY-MM-DDTHH:mm:ss')
}

/**
 * 日付文字列をローカルタイムゾーンのDateオブジェクトに変換する。
 * new Date("YYYY-MM-DD") はUTCとして解釈されるが、dayjsはローカルタイムゾーンでパースする。
 */
export const toLocalDate = (value: string | Date): Date => {
  return dayjs(value).toDate()
}

export const getContrastColor = (hex: string): string => {
  if (!hex || hex.length !== 7) return '#000000'
  const r = parseInt(hex.substring(1, 3), 16)
  const g = parseInt(hex.substring(3, 5), 16)
  const b = parseInt(hex.substring(5, 7), 16)
  const yiq = (r * 299 + g * 587 + b * 114) / 1000
  return yiq >= 128 ? '#000000' : '#ffffff'
}

export const granularityToInputType = (granularity?: string): 'month' | 'datetime-local' | 'date' => {
  return granularity === 'monthly' ? 'month' : granularity === 'hourly' ? 'datetime-local' : 'date'
}

/** メールアドレス形式かどうかを判定する */
export const isEmailFormat = (value: string): boolean => {
  return /^[\w\-._]+@[\w\-._]+\.[A-Za-z]+$/.test(value)
}

/**
 * 匿名ユーザーの識別子（uid）かどうかを判定する。
 * メールアドレス形式でなければ匿名ユーザーのuidとみなす。
 */
export const isAnonymousIdentifier = (value: string): boolean => {
  return !!value && !isEmailFormat(value)
}

/** 匿名ユーザーの識別子を表示用のラベルに変換する */
export const toDisplayIdentifier = (value: string): string => {
  return isAnonymousIdentifier(value) ? '匿名ユーザー' : value
}

/** ラグ入力用の時間単位 */
export type LagUnit = 'days' | 'hours' | 'minutes'

/** 依存関係種別の選択肢 */
export const DEPENDENCY_TYPE_OPTIONS: {
  value: DependencyType
  title: string
  subtitle: string
  shortTitle: string
}[] = [
  {
    value: 'FS',
    title: 'FS（終了 → 開始）',
    subtitle: '先行タスクの終了後に後続タスクを開始',
    shortTitle: 'FS (終了→開始)',
  },
  {
    value: 'SS',
    title: 'SS（開始 → 開始）',
    subtitle: '先行タスクの開始と同時に後続タスクを開始',
    shortTitle: 'SS (開始→開始)',
  },
  {
    value: 'FF',
    title: 'FF（終了 → 終了）',
    subtitle: '先行タスクの終了と同時に後続タスクを終了',
    shortTitle: 'FF (終了→終了)',
  },
  {
    value: 'SF',
    title: 'SF（開始 → 終了）',
    subtitle: '先行タスクの開始後に後続タスクを終了',
    shortTitle: 'SF (開始→終了)',
  },
]

/** ラグ単位の選択肢 */
export const LAG_UNIT_OPTIONS: { value: LagUnit; title: string }[] = [
  { value: 'days', title: '日' },
  { value: 'hours', title: '時間' },
  { value: 'minutes', title: '分' },
]

/**
 * 分単位のラグ値を、プロジェクトの表示粒度に応じた数値と単位に分解する
 */
export const minutesToLagValueAndUnit = (
  lagMinutes: number | undefined,
  granularity?: ProjectGranularity,
): { value: number; unit: LagUnit } => {
  const defaultUnit: LagUnit = granularity === 'hourly' ? 'hours' : 'days'
  if (!lagMinutes || lagMinutes === 0 || Number.isNaN(lagMinutes)) {
    return { value: 0, unit: defaultUnit }
  }
  if (granularity === 'hourly') {
    if (lagMinutes % 60 === 0) {
      return { value: lagMinutes / 60, unit: 'hours' }
    }
    return { value: lagMinutes, unit: 'minutes' }
  }
  if (lagMinutes % 1440 === 0) {
    return { value: lagMinutes / 1440, unit: 'days' }
  }
  if (lagMinutes % 60 === 0) {
    return { value: lagMinutes / 60, unit: 'hours' }
  }
  return { value: lagMinutes, unit: 'minutes' }
}

/**
 * 数値と単位から分単位のラグ値に変換する
 */
export const lagValueAndUnitToMinutes = (value: number | null | undefined, unit: LagUnit): number => {
  if (value == null || Number.isNaN(Number(value))) return 0
  const num = Number(value)
  if (unit === 'days') return Math.round(num * 1440)
  if (unit === 'hours') return Math.round(num * 60)
  return Math.round(num)
}

/**
 * TaskDependency（文字列またはオブジェクト）を正規化された TaskDependencyLink に変換する
 */
export const normalizeTaskDependency = (dep: TaskDependency): Required<TaskDependencyLink> => {
  if (typeof dep === 'string') {
    return { taskId: dep, type: 'FS', lag: 0 }
  }
  return {
    taskId: String(dep.taskId),
    type: dep.type ?? 'FS',
    lag: typeof dep.lag === 'number' && !Number.isNaN(dep.lag) ? dep.lag : 0,
  }
}

/**
 * 後方互換性を保ちつつ TaskDependency エントリを生成する
 * ('FS' かつ lag === 0 の場合は文字列、それ以外はオブジェクト)
 */
export const toTaskDependencyEntry = (
  taskId: string,
  type: DependencyType = 'FS',
  lagMinutes: number = 0,
): TaskDependency => {
  const normalizedType: DependencyType = type || 'FS'
  const normalizedLag = typeof lagMinutes === 'number' && !Number.isNaN(lagMinutes) ? Math.round(lagMinutes) : 0
  if (normalizedType === 'FS' && normalizedLag === 0) {
    return String(taskId)
  }
  const entry: TaskDependencyLink = {
    taskId: String(taskId),
    type: normalizedType,
  }
  if (normalizedLag !== 0) {
    entry.lag = normalizedLag
  }
  return entry
}


