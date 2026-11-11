import { Prisma } from '../generated/prisma/client'
import type { UpsertGanttRow, GanttRow } from '../types/shared'
import { checkProjectPermission, getCreateCommonColumns, getUpdateCommonColumns, prisma } from './common/commonFunctions'
import { fromGanttRow } from './common/converters'

const executeUpsert = async (
  tx: Prisma.TransactionClient,
  row: GanttRow,
  targetProjectId: string,
  email?: string,
) => {
  const data = fromGanttRow(row)
  const { id, projectId: _ignoredProjectId, ...rawData } = data
  const attribute = rawData.attribute as Prisma.InputJsonValue

  if (id === 0) {
    const orderForCreate = await tx.ganttRow.count({ where: { projectId: targetProjectId } })
    const created = await tx.ganttRow.create({
      data: {
        ...rawData,
        projectId: targetProjectId,
        order: orderForCreate,
        attribute,
        ...getCreateCommonColumns(email),
      },
    })
    return created.id
  }

  const updated = await tx.ganttRow.update({
    where: { id },
    data: {
      name: rawData.name,
      order: rawData.order,
      visible: rawData.visible,
      attribute,
      ...getUpdateCommonColumns(email),
    },
  })
  return updated.id
}

const upsertGanttRow: UpsertGanttRow = async (row, email?: string) => {
  const isBatch = Array.isArray(row)
  const rowsInput = isBatch ? row : [row]

  if (rowsInput.length === 0) {
    return []
  }

  for (const r of rowsInput) {
    if (!r || typeof r.projectId !== 'string' || !r.projectId.trim()) {
      throw new Error('Project ID is required')
    }
    const numericId = Number(r.id ?? 0)
    if (!Number.isInteger(numericId) || numericId < 0) {
      throw new Error('Invalid row ID')
    }
  }

  const projectIds = new Set(rowsInput.map((r) => r.projectId))
  if (projectIds.size !== 1) {
    throw new Error('All rows must belong to the same project')
  }
  const targetProjectId = rowsInput[0]!.projectId

  await checkProjectPermission(targetProjectId, email, 'editor')

  const existingIds = Array.from(
    new Set(rowsInput.map((r) => Number(r.id ?? 0)).filter((id) => id > 0)),
  )

  const results = await prisma.$transaction(async (tx) => {
    if (existingIds.length > 0) {
      const existingRows = await tx.ganttRow.findMany({
        where: { id: { in: existingIds } },
        select: { id: true, projectId: true },
      })
      if (
        existingRows.length !== existingIds.length ||
        existingRows.some((er) => er.projectId !== targetProjectId)
      ) {
        throw new Error('Permission denied')
      }
    }

    const ids: number[] = []
    for (const r of rowsInput) {
      ids.push(await executeUpsert(tx, r, targetProjectId, email))
    }
    return ids
  })

  return isBatch ? results : results[0]!
}

export default upsertGanttRow
