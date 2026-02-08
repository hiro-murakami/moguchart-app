import dayjs from 'dayjs'

export const toDateString = (value?: string | Date | dayjs.Dayjs, format: string = 'YYYY-MM-DDTHH:mm:ss'): string => {
  return dayjs(value).format(format)
}

export const toDateTimeString = (value?: string | Date | dayjs.Dayjs): string => {
  return toDateString(value, 'YYYY-MM-DDTHH:mm:ss')
}
