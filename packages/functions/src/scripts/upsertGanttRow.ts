import { Prisma } from '../generated/prisma/client'
import type { UpsertGanttRow, GanttRow } from '../types/shared'
import { checkProjectPermission, getCreateCommonColumns, getUpdateCommonColumns, prisma } from './common/commonFunctions'
import { fromGanttRow } from './common/converters'

const executeUpsert = async (tx: Prisma.TransactionClient, row: GanttRow, email?: string) => {
  const data = fromGanttRow(row)
  // id はDB側で自動採番されるので入力データからは除外する
  const { id, ...rawData } = data
  const createOrUpdateData = {
    ...rawData,
    attribute: rawData.attribute as Prisma.InputJsonValue,
  }

  const orderForCreate =
    id === 0
      ? await tx.ganttRow.count({ where: { projectId: createOrUpdateData.projectId } })
      : rawData.order

  const result = await tx.ganttRow.upsert({
    where: { id },
    update: { ...createOrUpdateData, ...getUpdateCommonColumns(email) },
    create: {
      ...createOrUpdateData,
      ...(id !== 0 ? { id } : {}),
      order: orderForCreate,
      ...getCreateCommonColumns(email),
    },
  })
  return result.id
}

const upsertGanttRow: UpsertGanttRow = async (row, email?: string) => {
  if (Array.isArray(row)) {
    // 一括更新: 最初の行のprojectIdでチェック
    if (row.length > 0) {
      await checkProjectPermission(row[0]!.projectId, email, 'editor')
    }
    return await prisma.$transaction(async (tx) => {
      const results = []
      for (const r of row) {
        results.push(await executeUpsert(tx, r, email))
      }
      return results
    })
  }

  // 単一更新
  await checkProjectPermission(row.projectId, email, 'editor')
  return await executeUpsert(prisma as unknown as Prisma.TransactionClient, row, email)
}

export default upsertGanttRow
