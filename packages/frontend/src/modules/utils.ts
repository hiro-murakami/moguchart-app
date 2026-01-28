import dayjs from 'dayjs'

export const toDateString = (
  value: Date | dayjs.Dayjs,
  format: string = 'YYYY-MM-DDTHH:mm:ss',
): string => {
  return dayjs(value).format(format)
}
