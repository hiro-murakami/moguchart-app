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
