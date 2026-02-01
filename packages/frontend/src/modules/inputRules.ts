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
  within: (max: number) => (value: string) =>
    !value || value.length <= max || message.ERROR_INPUT_WITHIN(max),
  length: (length: number) => (value: string) =>
    !value || value.length === length || message.ERROR_INPUT_LENGTH(length),
  isMailAddress: (value: string) =>
    !value ||
    /^[\w\-._]+@[\w\-._]+\.[A-Za-z]+$/.test(value) ||
    message.ERROR_INVALID_MAIL_ADDRESS,
  areMailAddresses: (values: string[]) => {
    if (!values || values.length === 0) return true
    const hasInvalid = values.some(
      (value) => !/^[\w\-._]+@[\w\-._]+\.[A-Za-z]+$/.test(value),
    )
    return !hasInvalid || message.ERROR_INVALID_MAIL_ADDRESS
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
