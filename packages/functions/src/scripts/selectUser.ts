import { SelectUser, UserAttribute } from '../types/shared.js'
import { prisma } from './common/commonFunctions.js'

const selectUser: SelectUser = async (identifier: string) => {
  if (!identifier) return null

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

  const attribute = (user.attribute as UserAttribute) || {}

  return {
    id: user.id,
    email: user.email || undefined,
    displayName: user.displayName || undefined,
    attribute,
  }
}

export default selectUser

