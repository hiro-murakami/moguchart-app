import { PrismaClient } from '@prisma/client'
import { SelectUser, UserAttribute } from '../types/shared.js'

const prisma = new PrismaClient()

const selectUser: SelectUser = async (email: string) => {
  const user = await prisma.user.findUnique({
    where: { email },
  })

  if (!user) {
    return null
  }

  const attribute = (user.attribute as UserAttribute) || {}

  return {
    email: user.email,
    displayName: user.displayName || undefined,
    attribute,
  }
}

export default selectUser
