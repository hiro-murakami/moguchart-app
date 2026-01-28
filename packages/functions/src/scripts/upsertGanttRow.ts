import type { UpsertGanttRow } from '../types/shared'
import { prisma } from './common/commonFunctions'
import { fromGanttRow } from './common/converters'

const upsertGanttRow: UpsertGanttRow = async (param) => {
  const data = fromGanttRow(param)
  const { id, ...createData } = data

  const result = await prisma.ganttRow.upsert({
    where: { id: data.id },
    update: data,
    create: createData,
  })

  return result.id
}

export default upsertGanttRow
