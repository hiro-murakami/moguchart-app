import { PrismaClient } from '@prisma/client'
import { UpsertUser } from '../types/shared'
import { getCreateCommonColumns, getUpdateCommonColumns } from './common/commonFunctions'

const prisma = new PrismaClient()

const upsertUser: UpsertUser = async (user, email) => {
  await prisma.user.upsert({
    where: { email: user.email },
    update: {
      displayName: user.displayName,
      attribute: user.attribute,
      ...getUpdateCommonColumns(email),
    },
    create: {
      email: user.email,
      displayName: user.displayName,
      ...getCreateCommonColumns(email),
    },
  })
}

export default upsertUser
