import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const projectId = '3f333df6-90a4-4fda-8dd3-9485d27cee36'

const projects = [
  {
    id: projectId,
    name: 'サンプルプロジェクト',
    start: new Date('2025-12-01'),
    end: new Date('2026-03-31'),
    attribute: {},
  },
]

const ganttRows = [
  { id: 1, projectId, name: '要件定義' },
  { id: 2, projectId, name: '設計' },
  { id: 3, projectId, name: '実装' },
  { id: 4, projectId, name: 'テスト' },
  { id: 5, projectId, name: 'リリース' },
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
  {
    rowId: 2,
    name: '詳細設計',
    start: new Date('2026-01-05'),
    end: new Date('2026-01-16'),
  },
  {
    rowId: 3,
    name: 'フロントエンド実装',
    start: new Date('2026-01-19'),
    end: new Date('2026-02-13'),
  },
  {
    rowId: 3,
    name: 'バックエンド実装',
    start: new Date('2026-01-19'),
    end: new Date('2026-02-13'),
  },
  {
    rowId: 4,
    name: '単体テスト',
    start: new Date('2026-02-16'),
    end: new Date('2026-02-27'),
  },
  {
    rowId: 4,
    name: '結合テスト',
    start: new Date('2026-03-02'),
    end: new Date('2026-03-13'),
  },
  {
    rowId: 5,
    name: 'リリース準備',
    start: new Date('2026-03-16'),
    end: new Date('2026-03-20'),
  },
  {
    rowId: 5,
    name: '本番リリース',
    start: new Date('2026-03-23'),
    end: new Date('2026-03-23'),
  },
]

const main = async () => {
  console.log('Start seeding ...')

  // 既存のデータをクリアする場合（必要に応じて）
  await prisma.ganttTask.deleteMany()
  await prisma.ganttRow.deleteMany()
  await prisma.project.deleteMany()

  await prisma.project.createMany({
    data: projects,
  })
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
