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

