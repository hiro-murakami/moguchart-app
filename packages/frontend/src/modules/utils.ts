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
