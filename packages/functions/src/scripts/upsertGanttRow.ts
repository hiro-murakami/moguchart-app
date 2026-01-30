import type { UpsertGanttRow } from '../types/shared'
import { prisma } from './common/commonFunctions'
import { fromGanttRow } from './common/converters'

const upsertGanttRow: UpsertGanttRow = async (param) => {
  const data = fromGanttRow(param)
  // id はDB側で自動採番されるので入力データからは除外する
  const { id, ...createOrUpdateData } = data

  if (id === 0) {
    // 新規作成
    const count = await prisma.ganttRow.count()
    const result = await prisma.ganttRow.create({
      data: {
        ...createOrUpdateData,
        order: count,
      },
    })
    return result.id
  } else {
    // 更新
    const result = await prisma.ganttRow.update({
      where: { id },
      data: createOrUpdateData,
    })
    return result.id
  }
}

export default upsertGanttRow
