import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const ganttRows = [
  { id: 1, name: '要件定義' },
  { id: 2, name: '設計' },
]

const ganttTasks = [
  {
    rowId: 1,
    name: 'ヒヤリング',
    start: new Date('2025-12-15'),
    end: new Date('2025-12-18'),
  },
  {
    rowId: 1,
    name: '要件定義書作成',
    start: new Date('2025-12-19'),
    end: new Date('2025-12-24'),
  },
  {
    rowId: 2,
    name: '基本設計',
    start: new Date('2025-12-22'),
    end: new Date('2025-12-30'),
  },
]

const main = async () => {
  console.log('Start seeding ...')

  // 既存のデータをクリアする場合（必要に応じて）
  await prisma.ganttTask.deleteMany()
  await prisma.ganttRow.deleteMany()

  await prisma.ganttRow.createMany({
    data: ganttRows,
  })
  await prisma.ganttTask.createMany({
    data: ganttTasks,
  })

  console.log('Seeding finished.')
}

main()
  .catch((e) => {
    console.error(e)
    throw e
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
