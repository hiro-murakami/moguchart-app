import * as functions from 'firebase-functions/v2'
import { FirebaseFunction } from '../../types'
import { PrismaClient } from '@prisma/client'
import { FunctionParam, FunctionResult } from '../../types/shared'
import dayjs from 'dayjs'

dayjs.extend(require('dayjs/plugin/utc'))
dayjs.extend(require('dayjs/plugin/timezone'))

export const prisma = new PrismaClient()

/**
 * Firebase公開用の関数を返す
 * @param {FirebaseFunction} targetFunctions 実行する関数情報
 * @return {Function} プロキシ関数
 */
export const setupFirebaseFunction = (
  targetFunctions: FirebaseFunction,
): Function => {
  // FYI:onCallを使うことで、Authorizationヘッダに認証済みのトークンが設定されていることが自動でチェックできる
  return functions.https.onCall(
    { region: 'asia-northeast1', cors: true },
    async (data) => {
      functions.logger.log('request:', data)

      // 認証チェック
      // Authorizationヘッダがない、または不正な値が設定されていた場合はエラーとする
      if (!data.auth) {
        throw new Error('認証されていません')
      }

      // メイン処理を実行する
      const result: FunctionResult = {
        status: 'succeeded',
      }

      const requestData = data.data as FunctionParam

      await targetFunctions[requestData.name](
        requestData.param,
        data.auth.token.email,
      )
        .then((resultData: any) => {
          result.data = resultData
        })
        .catch((e: Error) => {
          result.status = 'failed'
          result.message = e.message
        })

      functions.logger.log('response:', result)
      return result
    },
  )
}

export const toDateString = (
  value: Date | dayjs.Dayjs,
  format: string = 'YYYY-MM-DD',
): string => {
  return dayjs(value).format(format)
}

export const toDateTimeString = (value: Date | dayjs.Dayjs): string => {
  return toDateString(value, 'YYYY-MM-DDTHH:mm:ss')
}

export const getUpdateCommonColumns = (email?: string) => ({
  updatedBy: email,
  updatedAt: new Date(),
})

export const getCreateCommonColumns = (email?: string) => ({
  createdBy: email,
  createdAt: new Date(),
  updatedBy: email,
  updatedAt: new Date(),
})
