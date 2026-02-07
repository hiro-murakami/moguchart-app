import { Prisma } from '@prisma/client'
import type { UpsertGanttRow, GanttRow } from '../types/shared'
import {
  getCreateCommonColumns,
  getUpdateCommonColumns,
  prisma,
} from './common/commonFunctions'
import { fromGanttRow } from './common/converters'

const executeUpsert = async (
  tx: Prisma.TransactionClient,
  row: GanttRow,
  email?: string,
) => {
  const data = fromGanttRow(row)
  // id はDB側で自動採番されるので入力データからは除外する
  const { id, ...createOrUpdateData } = data

  if (id === 0) {
    // 新規作成
    const order = await tx.ganttRow.count({
      where: { projectId: createOrUpdateData.projectId },
    })
    const result = await tx.ganttRow.create({
      data: {
        ...createOrUpdateData,
        order,
        ...getCreateCommonColumns(email),
      },
    })
    return result.id
  } else {
    // 更新
    const result = await tx.ganttRow.update({
      where: { id },
      data: { ...createOrUpdateData, ...getUpdateCommonColumns(email) },
    })
    return result.id
  }
}

const upsertGanttRow: UpsertGanttRow = async (row, email?: string) => {
  if (Array.isArray(row)) {
    // 一括更新
    return await prisma.$transaction(async (tx) => {
      const results = []
      for (const r of row) {
        results.push(await executeUpsert(tx, r, email))
      }
      return results
    })
  }

  // 単一更新
  return await executeUpsert(
    prisma as unknown as Prisma.TransactionClient,
    row,
    email,
  )
}

export default upsertGanttRow
