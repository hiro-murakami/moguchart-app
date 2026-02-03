const message = {
  ERROR_INPUT_REQUIRE: '入力必須です',
  ERROR_INPUT_WITHIN: (max: number) => `${max}文字以内で入力してください`,
  ERROR_INPUT_LENGTH: (length: number) => `${length}文字で入力してください`,
  ERROR_INVALID_MAIL_ADDRESS: 'メールアドレス形式で入力してください',
  ERROR_DATE_BEFORE: '終了日より前の日付にしてください',
  ERROR_DATE_AFTER: '開始日より後の日付にしてください',
}

export default message
