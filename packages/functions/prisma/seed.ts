/// <reference types="node" />
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'

const adapter = new PrismaMariaDb(process.env.DATABASE_URL!)
const prisma = new PrismaClient({ adapter })

const projectId = '3f333df6-90a4-4fda-8dd3-9485d27cee36'

// ============================================================
// カラーパレット定義
// ============================================================
const colorPalettes = {
  blue: { color: '#ffffff', backgroundColor: '#2b6cb0' },
  green: { color: '#ffffff', backgroundColor: '#2f855a' },
  orange: { color: '#ffffff', backgroundColor: '#c05621' },
  purple: { color: '#ffffff', backgroundColor: '#805ad5' },
  red: { color: '#ffffff', backgroundColor: '#c53030' },
  teal: { color: '#ffffff', backgroundColor: '#2c7a7b' },
  pending: {
    color: '#ffffff',
    backgroundColor: '#718096',
    pattern: { type: 'diagonal-stripe', color: '#4a5568' },
  },
  onHold: {
    color: '#ffffff',
    backgroundColor: '#744210',
    pattern: { type: 'diagonal-stripe', color: '#542c0e' },
  },
}

// ============================================================
// ラベル定義
// ============================================================
const labels = {
  high: { name: '高優先', color: '#e53935' },
  medium: { name: '中優先', color: '#fb8c00' },
  low: { name: '低優先', color: '#43a047' },
  review: { name: 'レビュー待ち', color: '#8e24aa' },
  blocked: { name: 'ブロック中', color: '#d32f2f' },
  external: { name: '外部依存', color: '#1e88e5' },
}

// ============================================================
// プロジェクト
// ============================================================
const projects = [
  {
    id: projectId,
    name: 'サンプルプロジェクト',
    start: new Date('2025-12-01'),
    end: new Date('2026-04-30'),
    public: true,
    attribute: {
      description: 'カラーパレット・ラベル・タスクテンプレートの各パターンを網羅したデモプロジェクトです。',
      colorPalettes: Object.values(colorPalettes),
      labels: Object.values(labels),
      newTaskTemplates: [
        {
          name: '通常タスク',
          duration: 5,
          attribute: { colorPalette: colorPalettes.blue },
        },
        {
          name: 'レビュー',
          duration: 2,
          attribute: {
            colorPalette: colorPalettes.purple,
            labels: [labels.review],
          },
        },
        {
          name: 'マイルストーン',
          duration: 1,
          attribute: {
            colorPalette: colorPalettes.red,
            labels: [labels.high],
          },
        },
        {
          name: '長期タスク',
          duration: 14,
          attribute: { colorPalette: colorPalettes.green },
        },
        {
          name: '調査・検討',
          duration: 3,
          attribute: { colorPalette: colorPalettes.teal },
        },
      ],
    },
  },
]

// ============================================================
// ガント行
// ============================================================
const ganttRows = [
  {
    id: 1,
    projectId,
    name: '要件定義',
    order: 1,
    attribute: { description: 'プロジェクトの目的や機能要件を定義するフェーズです。' },
  },
  {
    id: 2,
    projectId,
    name: 'UI/UXデザイン',
    order: 2,
    attribute: { description: 'ユーザーインターフェースと体験を設計するフェーズです。' },
  },
  {
    id: 3,
    projectId,
    name: '基本設計',
    order: 3,
    attribute: { description: 'システムの構成やデータ構造を決定するフェーズです。' },
  },
  {
    id: 4,
    projectId,
    name: 'フロントエンド開発',
    order: 4,
    attribute: { description: 'ユーザーが直接目にする部分の実装を行うフェーズです。' },
  },
  {
    id: 5,
    projectId,
    name: 'バックエンド開発',
    order: 5,
    attribute: { description: 'サーバーサイドのロジックやデータベース処理を実装するフェーズです。' },
  },
  {
    id: 6,
    projectId,
    name: 'インフラ・CI/CD',
    order: 6,
    attribute: {},
  },
  {
    id: 7,
    projectId,
    name: 'テスト',
    order: 7,
    attribute: {},
  },
  {
    id: 8,
    projectId,
    name: 'リリース',
    order: 8,
    attribute: {},
  },
  {
    id: 9,
    projectId,
    name: '非表示行（テスト用）',
    order: 9,
    visible: false,
    attribute: { description: '画面上には表示されない行のデータです。' },
  },
]

// ============================================================
// ガントタスク
// ============================================================
const ganttTasks = [
  // ── 要件定義 ──
  {
    rowId: 1,
    name: 'ヒアリング・要望整理',
    start: new Date('2025-12-01'),
    end: new Date('2025-12-05'),
    attribute: {
      description: 'ステークホルダーへのヒアリングを実施し、要望を整理する。',
      colorPalette: colorPalettes.blue,
      labels: [labels.high],
    },
  },
  {
    rowId: 1,
    name: '要件定義書作成',
    start: new Date('2025-12-08'),
    end: new Date('2025-12-16'),
    attribute: {
      colorPalette: colorPalettes.blue,
      labels: [labels.medium],
    },
  },
  {
    rowId: 1,
    name: '要件レビュー',
    start: new Date('2025-12-17'),
    end: new Date('2025-12-19'),
    attribute: {
      colorPalette: colorPalettes.purple,
      labels: [labels.review],
    },
  },

  // ── UI/UXデザイン ──
  {
    rowId: 2,
    name: 'ワイヤーフレーム作成',
    start: new Date('2025-12-15'),
    end: new Date('2025-12-26'),
    attribute: {
      description: '主要画面のワイヤーフレームを作成する。',
      colorPalette: colorPalettes.teal,
    },
  },
  {
    rowId: 2,
    name: 'デザインモックアップ',
    start: new Date('2025-12-29'),
    end: new Date('2026-01-09'),
    attribute: {
      colorPalette: colorPalettes.teal,
      labels: [labels.external],
    },
  },

  // ── 基本設計 ──
  {
    rowId: 3,
    name: 'アーキテクチャ設計',
    start: new Date('2026-01-05'),
    end: new Date('2026-01-16'),
    attribute: {
      description: 'システム全体のアーキテクチャを設計し、技術選定を行う。',
      colorPalette: colorPalettes.green,
      labels: [labels.high],
    },
  },
  {
    rowId: 3,
    name: 'DB設計',
    start: new Date('2026-01-12'),
    end: new Date('2026-01-23'),
    attribute: {
      colorPalette: colorPalettes.green,
    },
  },
  {
    rowId: 3,
    name: 'API設計レビュー',
    start: new Date('2026-01-26'),
    end: new Date('2026-01-28'),
    attribute: {
      colorPalette: colorPalettes.purple,
      labels: [labels.review, labels.blocked],
    },
  },

  // ── フロントエンド開発 ──
  {
    rowId: 4,
    name: '共通コンポーネント実装',
    start: new Date('2026-01-26'),
    end: new Date('2026-02-13'),
    attribute: {
      colorPalette: colorPalettes.blue,
      labels: [labels.medium],
    },
  },
  {
    rowId: 4,
    name: '画面実装（一覧・詳細）',
    start: new Date('2026-02-16'),
    end: new Date('2026-03-06'),
    attribute: {
      colorPalette: colorPalettes.blue,
    },
  },

  // ── バックエンド開発 ──
  {
    rowId: 5,
    name: 'API実装',
    start: new Date('2026-01-26'),
    end: new Date('2026-02-20'),
    attribute: {
      description: 'REST API のエンドポイントを実装する。',
      colorPalette: colorPalettes.orange,
      labels: [labels.high],
    },
  },
  {
    rowId: 5,
    name: '認証・認可実装',
    start: new Date('2026-02-23'),
    end: new Date('2026-03-06'),
    attribute: {
      colorPalette: colorPalettes.orange,
      labels: [labels.high, labels.external],
    },
  },

  // ── インフラ・CI/CD ──
  {
    rowId: 6,
    name: 'CI/CDパイプライン構築',
    start: new Date('2026-01-12'),
    end: new Date('2026-01-23'),
    attribute: {
      colorPalette: colorPalettes.teal,
      labels: [labels.low],
    },
  },
  {
    rowId: 6,
    name: 'ステージング環境構築',
    start: new Date('2026-02-02'),
    end: new Date('2026-02-06'),
    attribute: {
      colorPalette: colorPalettes.pending,
      description: 'クラウド基盤のセットアップが未完了のため保留中。',
    },
  },

  // ── テスト ──
  {
    rowId: 7,
    name: '単体テスト',
    start: new Date('2026-03-09'),
    end: new Date('2026-03-20'),
    attribute: {
      colorPalette: colorPalettes.green,
    },
  },
  {
    rowId: 7,
    name: '結合テスト',
    start: new Date('2026-03-23'),
    end: new Date('2026-04-03'),
    attribute: {
      colorPalette: colorPalettes.green,
      labels: [labels.medium],
    },
  },
  {
    rowId: 7,
    name: 'UAT（ユーザー受入テスト）',
    start: new Date('2026-04-06'),
    end: new Date('2026-04-10'),
    attribute: {
      colorPalette: colorPalettes.onHold,
      labels: [labels.blocked],
      description: 'クライアント側のスケジュール調整中のため保留。',
    },
  },

  // ── リリース ──
  {
    rowId: 8,
    name: 'リリース準備',
    start: new Date('2026-04-13'),
    end: new Date('2026-04-17'),
    attribute: {
      colorPalette: colorPalettes.red,
      labels: [labels.high],
    },
  },
  {
    rowId: 8,
    name: '本番リリース',
    start: new Date('2026-04-20'),
    end: new Date('2026-04-20'),
    attribute: {
      description: 'v1.0 本番リリース（マイルストーン）',
      colorPalette: colorPalettes.red,
      labels: [labels.high],
    },
  },

  // ── 非表示行（テスト用） ──
  {
    rowId: 9,
    name: 'アーカイブ済みタスク',
    start: new Date('2025-12-01'),
    end: new Date('2025-12-05'),
    attribute: {
      description: '不要になった過去のタスクです。',
      colorPalette: colorPalettes.pending,
    },
  },
]

// ============================================================
// Seed 実行
// ============================================================
const main = async () => {
  console.log('Start seeding ...')

  // 既存のデータをクリア
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
