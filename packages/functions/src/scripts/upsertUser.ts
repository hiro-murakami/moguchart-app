import { UpsertUser } from '../types/shared'
import { getCreateCommonColumns, getUpdateCommonColumns, prisma } from './common/commonFunctions'

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
