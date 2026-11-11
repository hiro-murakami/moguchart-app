import { AuthContext, SelectUser, UserAttribute } from '../types/shared.js'
import { prisma } from './common/commonFunctions.js'

const toPublicUserAttribute = (raw: UserAttribute | undefined): UserAttribute => {
  if (!raw?.photoURL) return {}
  return { photoURL: raw.photoURL }
}

const selectUser: SelectUser = async (
  identifier: string,
  authUid?: string,
  authContext?: AuthContext,
) => {
  if (!identifier) return null
  if (!authUid && !authContext?.uid) {
    throw new Error('Permission denied: authentication required')
  }

  // まず id (Firebase Auth UID) で検索
  let user = await prisma.user.findUnique({
    where: { id: identifier },
  })

  // なければ email でフォールバック検索（移行期のレガシーデータ、およびメールアドレスからのユーザー検索用）
  if (!user && identifier.includes('@')) {
    user = await prisma.user.findFirst({
      where: { email: identifier },
    })
  }

  if (!user) {
    return null
  }

  const callerUid = authContext?.uid ?? (authUid && !authUid.includes('@') ? authUid : undefined)
  const callerEmail =
    !authContext?.isAnonymous
      ? (authContext?.email ?? (authUid && authUid.includes('@') ? authUid : undefined))
      : undefined

  const isSelf =
    (Boolean(callerUid) && user.id === callerUid) ||
    (Boolean(callerEmail) &&
      Boolean(user.email) &&
      user.email!.toLowerCase() === callerEmail!.toLowerCase())

  const attribute = (user.attribute as UserAttribute) || {}

  if (isSelf) {
    return {
      id: user.id,
      email: user.email || undefined,
      displayName: user.displayName || undefined,
      attribute,
    }
  }

  // 他ユーザー照会時はプライベート属性・メールアドレスを除外した最小公開プロフィールのみ返却
  return {
    id: user.id,
    displayName: user.displayName || undefined,
    attribute: toPublicUserAttribute(attribute),
  }
}

export default selectUser

