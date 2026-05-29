import { PrismaClient } from '../generated/prisma/client'
import type { UpsertProject } from '../types/shared'
import { checkProjectPermission, getCreateCommonColumns, getUpdateCommonColumns, prisma } from './common/commonFunctions'

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

  /**
   * TZなし文字列（"YYYY-MM-DDTHH:mm:ss"）をUTCのDateとして解釈する。
   * new Date("2025-05-03T03:00:00") はサーバーのローカルTZで解釈されるため、
   * 末尾に "Z" を付けてUTCとして明示的にパースする。
   */
  const toUtcDate = (dateStr: string): Date => {
    // 既にTZ情報が含まれている場合はそのまま使う
    if (/[Z+\-]\d{2}:?\d{2}$/.test(dateStr) || dateStr.endsWith('Z')) {
      return new Date(dateStr)
    }
    // TZなし → UTC として扱う（末尾に "Z" を追加）
    return new Date(`${dateStr}Z`)
  }

  const dataForDb = {
    ...data,
    start: toUtcDate(data.start),
    end: toUtcDate(data.end),
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
  // 更新時はownerのみ許可
  if (project.id) {
    await checkProjectPermission(project.id, email, 'owner')
  }

  const result = await _upsertProject(prisma, project, email)
  return result.id
}

export default upsertProject
