import * as functions from 'firebase-functions/v2'
import { FirebaseFunction } from '../../types'
import { PrismaClient } from '../../generated/prisma/client'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getStorage } from 'firebase-admin/storage'
import { FunctionParam, FunctionResult, VERSION, type Role } from '../../types/shared'
import dayjs from 'dayjs'

dayjs.extend(require('dayjs/plugin/utc'))
dayjs.extend(require('dayjs/plugin/timezone'))

const adapter = new PrismaMariaDb({
  socketPath: process.env.DATABASE_SOCKET_PATH,
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  connectionLimit: 5,
  allowPublicKeyRetrieval: true,
})
export const prisma = new PrismaClient({ adapter })

/**
 * Firebase Storage のバケットを取得する（バケット名が未設定の場合でも適切に解決）
 */
export const getStorageBucket = () => {
  if (getApps().length === 0) {
    initializeApp()
  }

  let bucketName = process.env.STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || process.env.GCP_PROJECT_ID
  if (!bucketName && process.env.FIREBASE_CONFIG) {
    try {
      const config = JSON.parse(process.env.FIREBASE_CONFIG)
      bucketName = config.storageBucket || config.projectId
    } catch {
      // ignore
    }
  }
  if (!bucketName) {
    bucketName = 'firestore-sample-c7300.appspot.com'
  }
  if (bucketName && !bucketName.includes('.')) {
    bucketName = `${bucketName}.appspot.com`
  }

  return getStorage().bucket(bucketName)
}


/**
 * Firebase公開用の関数を返す
 * @param {FirebaseFunction} targetFunctions 実行する関数情報
 * @return {Function} プロキシ関数
 */
export const setupFirebaseFunction = (targetFunctions: FirebaseFunction): Function => {
  // FYI:onCallを使うことで、Authorizationヘッダに認証済みのトークンが設定されていることが自動でチェックできる
  return functions.https.onCall(
    {
      region: 'asia-northeast1',
      cors: [
        `https://${process.env.GCP_PROJECT_ID}.web.app`,
        `https://${process.env.GCP_PROJECT_ID}.firebaseapp.com`,
        'https://moguchart.jp',
        // 開発環境用
        'http://localhost:5173',
        'http://localhost:4173',
        'http://localhost:5174',
        'http://localhost:4174',
      ],
    },
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
        version: VERSION,
      }

      const requestData = data.data as FunctionParam

      // 匿名ログインユーザーはemailを持たないため、uidをフォールバック識別子として使用
      const userIdentifier = data.auth.token.email || data.auth.uid

      await targetFunctions[requestData.name](requestData.param, userIdentifier)
        .then((resultData: any) => {
          result.data = resultData
        })
        .catch((e: Error) => {
          result.status = 'failed'
          result.message = e.message
        })

      functions.logger.log('response: ' + JSON.stringify(result))
      return result
    })
}

export const toDateString = (value: Date | dayjs.Dayjs, format: string = 'YYYY-MM-DD'): string => {
  return dayjs(value).format(format)
}

/**
 * DB から取得した Date を "YYYY-MM-DDTHH:mm:ss" 形式のウォールクロック文字列に変換する。
 * フロントエンドは TZなし文字列を UTC として扱い保存しているため、
 * サーバーのローカルTZに依存しないよう dayjs.utc() でUTCのままフォーマットする。
 */
export const toDateTimeString = (value: Date | dayjs.Dayjs): string => {
  return (dayjs as any).utc(value).format('YYYY-MM-DDTHH:mm:ss')
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

// ==================== 認可チェック関数群 ====================

/**
 * プロジェクトに対するアクセス権限をチェックする。
 * 権限がない場合は例外をスローする。
 *
 * @param projectId 対象プロジェクトID
 * @param email リクエストユーザーの識別子
 * @param requiredRole 必要なロール ('owner' | 'editor' | 'viewer')
 *   - owner: owners に含まれている必要がある
 *   - editor: owners または editors に含まれている必要がある
 *   - viewer: owners, editors, または viewers に含まれている必要がある
 *            （公開プロジェクトの場合は誰でも閲覧可能）
 */
export const checkProjectPermission = async (
  projectId: string,
  email: string | undefined,
  requiredRole: Role,
): Promise<void> => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { public: true, authority: true },
  })

  if (!project) {
    throw new Error('Project not found')
  }

  // 公開プロジェクトの場合、viewer ロールのみ無条件で許可
  if (project.public && requiredRole === 'viewer') {
    return
  }

  if (!email) {
    throw new Error('Permission denied')
  }

  const authority = (project.authority as any) || {}
  const owners: string[] = authority.owners || []
  const editors: string[] = authority.editors || []
  const viewers: string[] = authority.viewers || []

  let hasAccess = false
  switch (requiredRole) {
    case 'owner':
      hasAccess = owners.includes(email)
      break
    case 'editor':
      hasAccess = owners.includes(email) || editors.includes(email)
      break
    case 'viewer':
      hasAccess = owners.includes(email) || editors.includes(email) || viewers.includes(email)
      break
  }

  if (!hasAccess) {
    throw new Error('Permission denied')
  }
}

/**
 * 行IDの配列からプロジェクトIDを取得する。
 * すべての行が同一プロジェクトに属していることを検証する。
 */
export const getProjectIdFromRowIds = async (rowIds: number[]): Promise<string> => {
  if (rowIds.length === 0) {
    throw new Error('Row IDs are required')
  }

  const rows = await prisma.ganttRow.findMany({
    where: { id: { in: rowIds } },
    select: { projectId: true },
  })

  if (rows.length === 0) {
    throw new Error('Rows not found')
  }

  const projectIds = new Set(rows.map((r) => r.projectId))
  if (projectIds.size !== 1) {
    throw new Error('All rows must belong to the same project')
  }

  return rows[0]!.projectId
}

/**
 * タスクIDの配列からプロジェクトIDを取得する。
 * すべてのタスクが同一プロジェクトに属していることを検証する。
 */
export const getProjectIdFromTaskIds = async (taskIds: number[]): Promise<string> => {
  if (taskIds.length === 0) {
    throw new Error('Task IDs are required')
  }

  const tasks = await prisma.ganttTask.findMany({
    where: { id: { in: taskIds } },
    select: { row: { select: { projectId: true } } },
  })

  if (tasks.length === 0) {
    throw new Error('Tasks not found')
  }

  const projectIds = new Set(tasks.map((t) => t.row.projectId))
  if (projectIds.size !== 1) {
    throw new Error('All tasks must belong to the same project')
  }

  return tasks[0]!.row.projectId
}

/**
 * コメントIDからプロジェクトIDを取得する。
 * コメントが紐づくタスク → 行 → プロジェクト、または行 → プロジェクト、
 * またはプロジェクト直接の紐づきを辿る。
 */
export const getProjectIdFromCommentId = async (commentId: number): Promise<string> => {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: {
      projectId: true,
      rowId: true,
      taskId: true,
    },
  })

  if (!comment) {
    throw new Error('Comment not found')
  }

  if (comment.projectId) {
    return comment.projectId
  }

  if (comment.rowId) {
    const row = await prisma.ganttRow.findUnique({
      where: { id: comment.rowId },
      select: { projectId: true },
    })
    if (!row) throw new Error('Row not found')
    return row.projectId
  }

  if (comment.taskId) {
    const task = await prisma.ganttTask.findUnique({
      where: { id: comment.taskId },
      select: { row: { select: { projectId: true } } },
    })
    if (!task) throw new Error('Task not found')
    return task.row.projectId
  }

  throw new Error('Comment has no associated resource')
}

