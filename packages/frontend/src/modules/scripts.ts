import type {
  FunctionName,
  FunctionParam,
  FunctionResult,
  GanttRow,
  SelectGanttChart,
  UpsertGanttTask,
} from '@functions/types/shared'
import { initializeApp } from 'firebase/app'
import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from 'firebase/functions'

// Firebaseの設定
// 環境変数から設定を読み込むか、Firebaseコンソールで取得した値を直接設定してください
const firebaseConfig = {
  apiKey: 'AIzaSyDdC6B0eIi6m7eWIcd9eKC7a_a8gblnHX0',
  authDomain: 'firestore-sample-c7300.firebaseapp.com',
  projectId: 'firestore-sample-c7300',
  storageBucket: 'firestore-sample-c7300.appspot.com',
  messagingSenderId: '125422821530',
  appId: '1:125422821530:web:eeccb772fae7d0d6a1ff23',
}

const firebaseApp = initializeApp(firebaseConfig)

const functions = getFunctions(firebaseApp, 'asia-northeast1')
if (import.meta.env.VITE_APP_MODE === 'mock') {
  connectFunctionsEmulator(functions, 'localhost', 5001)
}

const callFunction = async <T>(name: FunctionName, param = {}) => {
  const callable = httpsCallable<FunctionParam, FunctionResult>(
    functions,
    'gantt-functions',
  )

  try {
    const result = await callable({
      name,
      email: 'test@example.com',
      param,
    })

    return result.data.data as T
  } catch (error: any) {
    console.error(`[FirebaseFunctions] Error calling ${name}:`, {
      code: error.code,
      message: error.message,
      details: error.details,
    })
    throw error
  }
}

export const selectGanttChart: SelectGanttChart = () => {
  return callFunction<GanttRow[]>('selectGanttChart')
}

export const upsertGanttTask: UpsertGanttTask = (param) => {
  return callFunction<void>('upsertGanttTask', param)
}
