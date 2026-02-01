import type { UpsertProject } from '../types/shared'
import {
  getCreateCommonColumns,
  getUpdateCommonColumns,
  prisma,
} from './common/commonFunctions'
import { Prisma } from '@prisma/client'

const upsertProject: UpsertProject = async (project, email?: string) => {
  const { id, ...data } = project

  const dataForDb = {
    ...data,
    start: new Date(data.start),
    end: new Date(data.end),
    attribute: data.attribute as Prisma.InputJsonValue,
  }

  if (!id) {
    // 新規作成
    const result = await prisma.project.create({
      data: {
        ...dataForDb,
        ...getCreateCommonColumns(email),
      },
    })
    return result.id
  } else {
    // 更新
    const result = await prisma.project.update({
      where: { id },
      data: { ...dataForDb, ...getUpdateCommonColumns(email) },
    })
    return result.id
  }
}

export default upsertProject
