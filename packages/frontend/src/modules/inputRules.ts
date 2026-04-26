import message from '@/modules/message'

export type ComponentRule = (value: any) => string | boolean

const inputRules = {
  none: () => true,
  required: (value: string | any[]) => {
    if (Array.isArray(value)) {
      return !!value.length || message.ERROR_INPUT_REQUIRE
    }
    return !!value || message.ERROR_INPUT_REQUIRE
  },
  within: (max: number) => (value: string) => !value || value.length <= max || message.ERROR_INPUT_WITHIN(max),
  length: (length: number) => (value: string) =>
    !value || value.length === length || message.ERROR_INPUT_LENGTH(length),
  minNumber: (min: number) => (value: any) => {
    if (value === null || value === undefined || value === '') return true
    const num = Number(value)
    return (!isNaN(num) && num >= min) || message.ERROR_INPUT_MIN(min)
  },
  isMailAddress: (value: string) =>
    !value || /^[\w\-._]+@[\w\-._]+\.[A-Za-z]+$/.test(value) || message.ERROR_INVALID_MAIL_ADDRESS,
  areMailAddresses: (values: (string | { value: string })[]) => {
    if (!values || values.length === 0) return true
    const emails = values.map((v) => (typeof v === 'string' ? v : v?.value ?? ''))
    const hasInvalid = emails.some((value) => !/^[\w\-._]+@[\w\-._]+\.[A-Za-z]+$/.test(value))
    return !hasInvalid || message.ERROR_INVALID_MAIL_ADDRESS
  },
  /** 改行区切りテキスト内の各行がメールアドレス形式であることを検証する */
  areMailAddressLines: (value: string) => {
    if (!value) return true
    const lines = value.split('\n')
    const invalidLines: number[] = []
    lines.forEach((line, i) => {
      const trimmed = line.trim()
      if (trimmed && !/^[\w\-._]+@[\w\-._]+\.[A-Za-z]+$/.test(trimmed)) {
        invalidLines.push(i + 1)
      }
    })
    if (invalidLines.length === 0) return true
    return `${invalidLines.join(', ')} 行目: ${message.ERROR_INVALID_MAIL_ADDRESS}`
  },
  dateBefore: (target: string) => (value: string) => {
    if (!value || !target) return true
    return value <= target || message.ERROR_DATE_BEFORE
  },
  dateAfter: (target: string) => (value: string) => {
    if (!value || !target) return true
    return value >= target || message.ERROR_DATE_AFTER
  },
}

export default inputRules
