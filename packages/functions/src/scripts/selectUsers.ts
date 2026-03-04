import type { SelectUsers } from '../types/shared.js'
import { prisma } from './common/commonFunctions.js'

const selectUsers: SelectUsers = async () => {
  const users = await prisma.user.findMany({
    orderBy: { email: 'asc' },
  })

  return users.map((user) => ({
    email: user.email,
    displayName: user.displayName || undefined,
    attribute: (user.attribute as any) || {},
  }))
}

export default selectUsers
