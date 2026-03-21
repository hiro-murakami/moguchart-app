import { PrismaClient } from '../generated/prisma/client'
import type { UpsertProject } from '../types/shared'
import { getCreateCommonColumns, getUpdateCommonColumns, prisma } from './common/commonFunctions'

type PrismaTransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>

export const _upsertProject = async (
  prismaClient: PrismaTransactionClient,
  project: Parameters<UpsertProject>[0],
  email?: string,
) => {
  // Prisma の update に渡せないフィールドを除外
  // _count: Prisma の集計フィールド、commentCount: フロントエンド用の仮想フィールド
  const { id, role, _count, commentCount, ...data } = project as any
  const isNew = !id

  if (isNew) {
    data.authority = {
      owners: [email!],
      editors: [],
      viewers: [],
    }
  }

  const dataForDb = {
    ...data,
    start: new Date(data.start),
    end: new Date(data.end),
    attribute: data.attribute,
    authority: data.authority,
  }

  if (isNew) {
    // 新規作成
    const result = await prismaClient.project.create({
      data: {
        ...dataForDb,
        ...getCreateCommonColumns(email),
      },
    })
    return result
  } else {
    // 更新
    const result = await prismaClient.project.update({
      where: { id },
      data: { ...dataForDb, ...getUpdateCommonColumns(email) },
    })
    return result
  }
}

const upsertProject: UpsertProject = async (project, email) => {
  const result = await _upsertProject(prisma, project, email)
  return result.id
}

export default upsertProject
