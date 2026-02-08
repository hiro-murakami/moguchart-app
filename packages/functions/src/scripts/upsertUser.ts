import { PrismaClient } from '@prisma/client'
import { UpsertUser } from '../types/shared'
import { getCreateCommonColumns, getUpdateCommonColumns } from './common/commonFunctions'

const prisma = new PrismaClient()

const upsertUser: UpsertUser = async (user, email) => {
  await prisma.user.upsert({
    where: { email: user.email },
    update: {
      ...user,
      ...getUpdateCommonColumns(email),
    },
    create: {
      ...user,
      ...getCreateCommonColumns(email),
    },
  })
}

export default upsertUser
