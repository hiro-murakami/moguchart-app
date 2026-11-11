import * as functions from 'firebase-functions/v2'
import { FirebaseFunction } from '../../types'
import { PrismaClient } from '../../generated/prisma/client'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { type AuthContext, FunctionParam, FunctionResult, VERSION, type Role } from '../../types/shared'
import dayjs from 'dayjs'

dayjs.extend(require('dayjs/plugin/utc'))
dayjs.extend(require('dayjs/plugin/timezone'))

const isProductionRuntime =
  Boolean(process.env.K_SERVICE) && process.env.FUNCTIONS_EMULATOR !== 'true'

const dbHost = process.env.DATABASE_HOST?.trim()
const useDbSocket = Boolean(process.env.DATABASE_SOCKET_PATH)
const isLocalDbHost = !dbHost || ['localhost', '127.0.0.1', '::1'].includes(dbHost)

const adapter = new PrismaMariaDb({
  socketPath: process.env.DATABASE_SOCKET_PATH,
  host: dbHost,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  connectionLimit: 5,
  allowPublicKeyRetrieval: !useDbSocket && isLocalDbHost && !isProductionRuntime,
  ...(!useDbSocket && !isLocalDbHost && process.env.DATABASE_SSL !== 'false'
    ? {
        ssl: {
          rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
        },
      }
    : {}),
})
export const prisma = new PrismaClient({ adapter })

/**
 * Firebase Storage のバケットを取得する（バケット名が未設定の場合はエラーを送出）
 */
export const getStorageBucket = () => {
  if (getApps().length === 0) {
    initializeApp()
  }

  let bucketName =
    process.env.STORAGE_BUCKET ||
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.GCP_PROJECT_ID ||
    process.env.GCLOUD_PROJECT
  if (!bucketName && process.env.FIREBASE_CONFIG) {
    try {
      const config = JSON.parse(process.env.FIREBASE_CONFIG)
      bucketName = config.storageBucket || config.projectId
    } catch {
      // ignore
    }
  }
  if (!bucketName && process.env.FUNCTIONS_EMULATOR === 'true') {
    bucketName = 'demo-moguchart.appspot.com'
  }
  if (!bucketName) {
    throw new Error('Storage bucket is not configured (STORAGE_BUCKET or GCP_PROJECT_ID is required)')
  }
  if (!bucketName.includes('.')) {
    bucketName = `${bucketName}.appspot.com`
  }

  return getStorage().bucket(bucketName)
}

const buildAllowedCallableOrigins = (): string[] => {
  const projectId = process.env.GCP_PROJECT_ID || process.env.GCLOUD_PROJECT
  const origins = [
    ...(projectId
      ? [`https://${projectId}.web.app`, `https://${projectId}.firebaseapp.com`]
      : []),
    'https://moguchart.jp',
  ]
  if (!isProductionRuntime) {
    origins.push(
      'http://localhost:5173',
      'http://localhost:4173',
      'http://localhost:5174',
      'http://localhost:4174',
    )
  }
  return origins
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
      cors: buildAllowedCallableOrigins(),
    },
    async (data) => {
      const startedAt = Date.now()

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
      const functionName = typeof requestData?.name === 'string' ? requestData.name : 'unknown'

      const signInProvider = data.auth.token.firebase?.sign_in_provider
      const isAnonymous = signInProvider === 'anonymous'
      const emailVerified = data.auth.token.email_verified === true
      const verifiedEmail =
        !isAnonymous && emailVerified && data.auth.token.email ? data.auth.token.email : undefined

      // ユーザー識別子: 検証済みメールアドレスが存在する場合はメールアドレス、匿名ユーザー等はuidを使用
      const userIdentifier = verifiedEmail || data.auth.uid
      const authContext: AuthContext = {
        uid: data.auth.uid,
        email: verifiedEmail,
        emailVerified,
        isAnonymous,
      }

      const targetFn = requestData?.name ? targetFunctions[requestData.name] : undefined
      if (typeof targetFn !== 'function') {
        result.status = 'failed'
        result.message = 'Invalid function name'
        functions.logger.warn('[Callable] Invalid function name', {
          functionName,
          uid: data.auth.uid,
          durationMs: Date.now() - startedAt,
        })
        return result
      }

      await targetFn(requestData.param, userIdentifier, authContext)
        .then((resultData: any) => {
          result.data = resultData
        })
        .catch((e: Error) => {
          result.status = 'failed'
          result.message = e.message
          functions.logger.warn('[Callable] Function execution failed', {
            functionName,
            uid: data.auth?.uid,
            error: e.message,
            durationMs: Date.now() - startedAt,
          })
        })

      if (result.status === 'succeeded') {
        functions.logger.info('[Callable] Function executed', {
          functionName,
          uid: data.auth.uid,
          status: result.status,
          durationMs: Date.now() - startedAt,
        })
      }
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
  userIdentifier: string | undefined,
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

  if (!userIdentifier) {
    throw new Error('Permission denied')
  }

  // 1. まず ProjectMember テーブルをチェック
  let authUid: string | undefined
  let authEmail: string | undefined
  if (userIdentifier.includes('@')) {
    authEmail = userIdentifier
    const user = await prisma.user.findFirst({
      where: { email: userIdentifier },
      select: { id: true },
    })
    authUid = user?.id
  } else {
    authUid = userIdentifier
    const user = await prisma.user.findUnique({
      where: { id: userIdentifier },
      select: { email: true },
    })
    authEmail = user?.email || undefined
  }

  const member = await prisma.projectMember.findFirst({
    where: {
      projectId,
      OR: [
        ...(authUid ? [{ userId: authUid }] : []),
        ...(authEmail ? [{ email: authEmail }] : []),
        { userId: userIdentifier },
        { email: userIdentifier },
      ],
    },
  })

  let isOwner = false
  let isEditor = false
  let isViewer = false

  if (member) {
    isOwner = member.role === 'owner'
    isEditor = member.role === 'editor'
    isViewer = member.role === 'viewer'
  } else {
    // 2. フォールバック: 既存 authority (JSON) のチェック
    const authority = (project.authority as any) || {}
    const owners: string[] = authority.owners || []
    const editors: string[] = authority.editors || []
    const viewers: string[] = authority.viewers || []

    const identifiers = [userIdentifier, authUid, authEmail].filter(Boolean) as string[]
    isOwner = identifiers.some((id) => owners.includes(id))
    isEditor = identifiers.some((id) => editors.includes(id))
    isViewer = identifiers.some((id) => viewers.includes(id))
  }

  let hasAccess = false
  switch (requiredRole) {
    case 'owner':
      hasAccess = isOwner
      break
    case 'editor':
      hasAccess = isOwner || isEditor
      break
    case 'viewer':
      hasAccess = isOwner || isEditor || isViewer
      break
  }

  if (!hasAccess) {
    throw new Error('Permission denied')
  }
}

/**
 * 指定ユーザーが対象プロジェクトの明示的なメンバー（owner / editor / viewer）かどうかを判定する。
 * 公開プロジェクトを非メンバーが閲覧しているケースとメンバー閲覧を区別するために使用する。
 */
export const isExplicitProjectMember = async (
  projectId: string,
  userIdentifier: string | undefined,
): Promise<boolean> => {
  if (!userIdentifier) return false

  let authUid: string | undefined
  let authEmail: string | undefined
  if (userIdentifier.includes('@')) {
    authEmail = userIdentifier
    const user = await prisma.user.findFirst({
      where: { email: userIdentifier },
      select: { id: true },
    })
    authUid = user?.id
  } else {
    authUid = userIdentifier
    const user = await prisma.user.findUnique({
      where: { id: userIdentifier },
      select: { email: true },
    })
    authEmail = user?.email || undefined
  }

  const member = await prisma.projectMember.findFirst({
    where: {
      projectId,
      OR: [
        ...(authUid ? [{ userId: authUid }] : []),
        ...(authEmail ? [{ email: authEmail }] : []),
        { userId: userIdentifier },
        { email: userIdentifier },
      ],
    },
    select: { id: true },
  })
  if (member) return true

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { authority: true },
  })
  if (!project) return false

  const authority = (project.authority as any) || {}
  const allAuthIds = [
    ...(Array.isArray(authority.owners) ? authority.owners : []),
    ...(Array.isArray(authority.editors) ? authority.editors : []),
    ...(Array.isArray(authority.viewers) ? authority.viewers : []),
  ]
  const identifiers = [userIdentifier, authUid, authEmail].filter(Boolean) as string[]
  return identifiers.some((id) => allAuthIds.includes(id))
}

/**
 * 行IDの配列からプロジェクトIDを取得する。
 * すべての行が存在し、かつ同一プロジェクトに属していることを検証する。
 */
export const getProjectIdFromRowIds = async (rowIds: number[]): Promise<string> => {
  if (!Array.isArray(rowIds) || rowIds.length === 0) {
    throw new Error('Row IDs are required')
  }
  if (!rowIds.every((id) => Number.isInteger(id) && id > 0)) {
    throw new Error('Invalid row ID')
  }

  const uniqueRowIds = Array.from(new Set(rowIds))
  const rows = await prisma.ganttRow.findMany({
    where: { id: { in: uniqueRowIds } },
    select: { id: true, projectId: true },
  })

  if (rows.length === 0 || rows.length !== uniqueRowIds.length) {
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
 * すべてのタスクが存在し、かつ同一プロジェクトに属していることを検証する。
 */
export const getProjectIdFromTaskIds = async (taskIds: number[]): Promise<string> => {
  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    throw new Error('Task IDs are required')
  }
  if (!taskIds.every((id) => Number.isInteger(id) && id > 0)) {
    throw new Error('Invalid task ID')
  }

  const uniqueTaskIds = Array.from(new Set(taskIds))
  const tasks = await prisma.ganttTask.findMany({
    where: { id: { in: uniqueTaskIds } },
    select: { id: true, row: { select: { projectId: true } } },
  })

  if (tasks.length === 0 || tasks.length !== uniqueTaskIds.length) {
    throw new Error('Tasks not found')
  }

  const projectIds = new Set(tasks.map((t) => t.row.projectId))
  if (projectIds.size !== 1) {
    throw new Error('All tasks must belong to the same project')
  }

  return tasks[0]!.row.projectId
}

/**
 * スナップショット名のパストラバーサル等を防ぐバリデーション
 */
export function assertSafeSnapshotName(snapshotName: unknown): asserts snapshotName is string {
  if (typeof snapshotName !== 'string' || !snapshotName.trim() || snapshotName.length > 128) {
    throw new Error('Invalid snapshot name')
  }
  if (
    snapshotName.includes('/') ||
    snapshotName.includes('\\') ||
    snapshotName.includes('..') ||
    snapshotName.includes('\0') ||
    snapshotName === '.'
  ) {
    throw new Error('Invalid snapshot name')
  }
}

export interface ProjectAclSource {
  id: string
  public: boolean
  authority: unknown
  members?: Array<{ role: string; userId: string | null; email: string | null }>
}

export const buildFirestoreProjectAcl = (project: ProjectAclSource) => {
  const memberSet = new Set<string>()
  const writerSet = new Set<string>()

  const addIdentifier = (set: Set<string>, id: unknown) => {
    if (typeof id === 'string' && id.trim()) {
      set.add(id.trim())
    }
  }

  if (Array.isArray(project.members)) {
    for (const m of project.members) {
      addIdentifier(memberSet, m.userId)
      addIdentifier(memberSet, m.email)
      if (m.role === 'owner' || m.role === 'editor') {
        addIdentifier(writerSet, m.userId)
        addIdentifier(writerSet, m.email)
      }
    }
  }

  const auth = (project.authority && typeof project.authority === 'object' ? project.authority : {}) as {
    owners?: unknown[]
    editors?: unknown[]
    viewers?: unknown[]
  }
  for (const id of Array.isArray(auth.owners) ? auth.owners : []) {
    addIdentifier(memberSet, id)
    addIdentifier(writerSet, id)
  }
  for (const id of Array.isArray(auth.editors) ? auth.editors : []) {
    addIdentifier(memberSet, id)
    addIdentifier(writerSet, id)
  }
  for (const id of Array.isArray(auth.viewers) ? auth.viewers : []) {
    addIdentifier(memberSet, id)
  }

  return {
    public: Boolean(project.public),
    memberIds: Array.from(memberSet),
    writerIds: Array.from(writerSet),
  }
}

const withFirestoreTimeout = async <T>(promise: Promise<T>, timeoutMs = 2000): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Firestore operation timed out')), timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * Cloud SQL の Project / ProjectMember 権限情報を Firestore `projects/{projectId}` の `acl` に同期する。
 * Firestore ルールによるプレゼンス・編集イベント認可に使用する。
 */
export const syncProjectAclToFirestore = async (projectId: string): Promise<void> => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        public: true,
        authority: true,
        members: {
          select: { role: true, userId: true, email: true },
        },
      },
    })
    if (!project) return

    if (getApps().length === 0) {
      initializeApp()
    }
    const db = getFirestore()
    const acl = buildFirestoreProjectAcl(project)
    await withFirestoreTimeout(
      db.collection('projects').doc(projectId).set({ acl }, { merge: true }),
    )
  } catch (err) {
    functions.logger.warn(`[FirestoreACL] Failed to sync ACL for project ${projectId}:`, err)
  }
}

/**
 * 既存プロジェクト一覧のうち、Firestore 上にまだ `acl` が未設定のものがあれば補完同期する。
 */
export const ensureProjectsAclSynced = async (projects: ProjectAclSource[]): Promise<void> => {
  if (projects.length === 0) return
  try {
    if (getApps().length === 0) {
      initializeApp()
    }
    const db = getFirestore()
    const docRefs = projects.map((p) => db.collection('projects').doc(p.id))
    const snapshots = await withFirestoreTimeout(db.getAll(...docRefs))

    const batch = db.batch()
    let needsCommit = false
    snapshots.forEach((snap, idx) => {
      const data = snap.data()
      if (!data || !data.acl || !Array.isArray(data.acl.memberIds)) {
        const project = projects[idx]!
        batch.set(snap.ref, { acl: buildFirestoreProjectAcl(project) }, { merge: true })
        needsCommit = true
      }
    })

    if (needsCommit) {
      await withFirestoreTimeout(batch.commit())
    }
  } catch (err) {
    functions.logger.warn('[FirestoreACL] Failed to ensure projects ACL synced:', err)
  }
}

/**
 * プロジェクト削除時に Firestore 上の `projects/{projectId}` ドキュメントと配下のコラボ情報を削除する。
 */
export const deleteProjectAclFromFirestore = async (projectId: string): Promise<void> => {
  try {
    if (getApps().length === 0) {
      initializeApp()
    }
    const db = getFirestore()
    const projectRef = db.collection('projects').doc(projectId)
    await withFirestoreTimeout(
      (async () => {
        for (const subName of ['presence', 'editEvents']) {
          const subSnap = await projectRef.collection(subName).limit(500).get()
          if (!subSnap.empty) {
            const batch = db.batch()
            subSnap.docs.forEach((d) => batch.delete(d.ref))
            await batch.commit()
          }
        }
        await projectRef.delete()
      })(),
    )
  } catch (err) {
    functions.logger.warn(`[FirestoreACL] Failed to delete Firestore project doc ${projectId}:`, err)
  }
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

