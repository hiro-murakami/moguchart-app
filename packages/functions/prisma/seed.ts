/// <reference types="node" />
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'

const adapter = new PrismaMariaDb(process.env.DATABASE_URL!)
const prisma = new PrismaClient({ adapter })

const projectId = '3f333df6-90a4-4fda-8dd3-9485d27cee36'
const monthlyProjectId = 'b7e4a2f1-c8d3-4e5a-9b0c-1f2e3d4a5b6c'

import { DEFAULT_COLOR_PALETTES } from '../src/types/shared'

// ============================================================
// カラーパレット定義
// ============================================================
const colorPalettes: Record<string, any> = {
  ...DEFAULT_COLOR_PALETTES.reduce((acc, p) => {
    const key = p.name!.replace(/\s+(.)/g, (_, c) => c.toUpperCase()).replace(/^(.)/, (_, c) => c.toLowerCase())
    acc[key] = p
    return acc
  }, {} as Record<string, any>),
  pending: {
    name: 'Pending',
    color: '#ffffff',
    backgroundColor: '#718096',
    pattern: { type: 'diagonal-stripe', color: '#4a5568' },
  },
  onHold: {
    name: 'On Hold',
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
    name: 'サンプルプロジェクト（日単位）',
    start: new Date('2025-12-01'),
    end: new Date('2026-04-30'),
    public: true,
    authority: { owners: ['h.murakami@esm.co.jp'] },
    attribute: {
      granularity: 'daily',
      description: 'カラーパレット・ラベル・タスクテンプレートの各パターンを網羅したデモプロジェクトです。',
      colorPalettes: Object.values(colorPalettes),
      labels: Object.values(labels),
      milestones: [
        { name: '要件定義完了', date: '2025-12-19', color: '#1e88e5' },
        { name: 'デザインFix', date: '2026-01-09', color: '#8e24aa' },
        { name: '開発完了', date: '2026-03-06', color: '#43a047' },
        { name: 'リリース', date: '2026-04-20', color: '#e53935' },
      ],
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

const monthlyProject = {
  id: monthlyProjectId,
  name: 'サンプルプロジェクト（月単位）',
  start: new Date('2025-01-01'),
  end: new Date('2034-12-31'),
  public: true,
  authority: { owners: ['h.murakami@esm.co.jp'] },
  attribute: {
    granularity: 'monthly',
    description: '10年スパンの大規模システム刷新プロジェクト。月単位ガントチャートのサンプルです。',
    colorPalettes: Object.values(colorPalettes),
    labels: Object.values(labels),
    milestones: [
      { name: 'フェーズ1完了', date: '2026-12-31', color: '#1e88e5' },
      { name: 'MVPリリース', date: '2028-06-30', color: '#43a047' },
      { name: 'グローバル展開', date: '2031-03-31', color: '#8e24aa' },
      { name: 'プロジェクト完了', date: '2034-12-31', color: '#e53935' },
    ],
  },
}

// ============================================================
// 月単位ガント行（20行）
// ============================================================
const monthlyGanttRows = [
  { id: 101, projectId: monthlyProjectId, name: '企画・戦略立案', order: 1, attribute: {} },
  { id: 102, projectId: monthlyProjectId, name: '市場調査・競合分析', order: 2, attribute: {} },
  { id: 103, projectId: monthlyProjectId, name: '要件定義', order: 3, attribute: {} },
  { id: 104, projectId: monthlyProjectId, name: 'UI/UXデザイン', order: 4, attribute: {} },
  { id: 105, projectId: monthlyProjectId, name: 'アーキテクチャ設計', order: 5, attribute: {} },
  { id: 106, projectId: monthlyProjectId, name: 'データ基盤構築', order: 6, attribute: {} },
  { id: 107, projectId: monthlyProjectId, name: 'フロントエンド開発', order: 7, attribute: {} },
  { id: 108, projectId: monthlyProjectId, name: 'バックエンド開発', order: 8, attribute: {} },
  { id: 109, projectId: monthlyProjectId, name: 'API・インテグレーション', order: 9, attribute: {} },
  { id: 110, projectId: monthlyProjectId, name: 'インフラ・クラウド', order: 10, attribute: {} },
  { id: 111, projectId: monthlyProjectId, name: 'セキュリティ対策', order: 11, attribute: {} },
  { id: 112, projectId: monthlyProjectId, name: 'QA・テスト', order: 12, attribute: {} },
  { id: 113, projectId: monthlyProjectId, name: 'CI/CD・DevOps', order: 13, attribute: {} },
  { id: 114, projectId: monthlyProjectId, name: 'ドキュメント整備', order: 14, attribute: {} },
  { id: 115, projectId: monthlyProjectId, name: 'マーケティング', order: 15, attribute: {} },
  { id: 116, projectId: monthlyProjectId, name: '営業・パートナー開拓', order: 16, attribute: {} },
  { id: 117, projectId: monthlyProjectId, name: 'カスタマーサポート体制', order: 17, attribute: {} },
  { id: 118, projectId: monthlyProjectId, name: '法務・コンプライアンス', order: 18, attribute: {} },
  { id: 119, projectId: monthlyProjectId, name: 'グローバル展開', order: 19, attribute: {} },
  { id: 120, projectId: monthlyProjectId, name: '保守・運用', order: 20, attribute: {} },
]

// ============================================================
// 月単位ガントタスク
// ============================================================
const monthlyGanttTasks = [
  // 101 企画・戦略立案
  {
    rowId: 101,
    name: '中期戦略策定',
    start: new Date('2025-01-01'),
    end: new Date('2025-06-30'),
    attribute: { colorPalette: colorPalettes.blue, labels: [labels.high] },
  },
  {
    rowId: 101,
    name: '事業計画立案',
    start: new Date('2025-07-01'),
    end: new Date('2025-12-31'),
    attribute: { colorPalette: colorPalettes.blue },
  },
  {
    rowId: 101,
    name: '第2フェーズ戦略',
    start: new Date('2027-01-01'),
    end: new Date('2027-06-30'),
    attribute: { colorPalette: colorPalettes.blue, labels: [labels.medium] },
  },
  {
    rowId: 101,
    name: '長期ビジョン策定',
    start: new Date('2030-01-01'),
    end: new Date('2030-09-30'),
    attribute: { colorPalette: colorPalettes.blue },
  },
  // 102 市場調査・競合分析
  {
    rowId: 102,
    name: '初期市場調査',
    start: new Date('2025-01-01'),
    end: new Date('2025-04-30'),
    attribute: { colorPalette: colorPalettes.teal, labels: [labels.high] },
  },
  {
    rowId: 102,
    name: '競合分析',
    start: new Date('2025-05-01'),
    end: new Date('2025-09-30'),
    attribute: { colorPalette: colorPalettes.teal },
  },
  {
    rowId: 102,
    name: 'トレンド再調査',
    start: new Date('2028-01-01'),
    end: new Date('2028-06-30'),
    attribute: { colorPalette: colorPalettes.teal, labels: [labels.external] },
  },
  // 103 要件定義
  {
    rowId: 103,
    name: 'ユーザーヒアリング',
    start: new Date('2025-03-01'),
    end: new Date('2025-06-30'),
    attribute: { colorPalette: colorPalettes.purple, labels: [labels.high] },
  },
  {
    rowId: 103,
    name: '要件定義書作成',
    start: new Date('2025-07-01'),
    end: new Date('2025-12-31'),
    attribute: { colorPalette: colorPalettes.purple },
  },
  {
    rowId: 103,
    name: '第2フェーズ要件定義',
    start: new Date('2027-07-01'),
    end: new Date('2027-12-31'),
    attribute: { colorPalette: colorPalettes.purple, labels: [labels.medium] },
  },
  // 104 UI/UXデザイン
  {
    rowId: 104,
    name: 'UXリサーチ',
    start: new Date('2025-06-01'),
    end: new Date('2025-09-30'),
    attribute: { colorPalette: colorPalettes.teal },
  },
  {
    rowId: 104,
    name: 'デザインシステム構築',
    start: new Date('2025-10-01'),
    end: new Date('2026-03-31'),
    attribute: { colorPalette: colorPalettes.teal, labels: [labels.medium] },
  },
  {
    rowId: 104,
    name: 'UI全面刷新',
    start: new Date('2029-01-01'),
    end: new Date('2029-06-30'),
    attribute: { colorPalette: colorPalettes.teal },
  },
  // 105 アーキテクチャ設計
  {
    rowId: 105,
    name: 'システム方式設計',
    start: new Date('2025-07-01'),
    end: new Date('2025-12-31'),
    attribute: { colorPalette: colorPalettes.green, labels: [labels.high] },
  },
  {
    rowId: 105,
    name: 'マイクロサービス化',
    start: new Date('2026-01-01'),
    end: new Date('2026-06-30'),
    attribute: { colorPalette: colorPalettes.green },
  },
  {
    rowId: 105,
    name: 'アーキテクチャ見直し',
    start: new Date('2030-01-01'),
    end: new Date('2030-06-30'),
    attribute: { colorPalette: colorPalettes.green, labels: [labels.medium] },
  },
  // 106 データ基盤構築
  {
    rowId: 106,
    name: 'DWH構築',
    start: new Date('2025-10-01'),
    end: new Date('2026-06-30'),
    attribute: { colorPalette: colorPalettes.orange, labels: [labels.high] },
  },
  {
    rowId: 106,
    name: 'データパイプライン整備',
    start: new Date('2026-07-01'),
    end: new Date('2026-12-31'),
    attribute: { colorPalette: colorPalettes.orange },
  },
  {
    rowId: 106,
    name: 'データレイク拡張',
    start: new Date('2029-07-01'),
    end: new Date('2030-06-30'),
    attribute: { colorPalette: colorPalettes.orange, labels: [labels.medium] },
  },
  // 107 フロントエンド開発
  {
    rowId: 107,
    name: 'MVP開発',
    start: new Date('2026-01-01'),
    end: new Date('2026-12-31'),
    attribute: { colorPalette: colorPalettes.blue, labels: [labels.high] },
  },
  {
    rowId: 107,
    name: 'v2.0開発',
    start: new Date('2028-01-01'),
    end: new Date('2028-12-31'),
    attribute: { colorPalette: colorPalettes.blue },
  },
  {
    rowId: 107,
    name: 'v3.0開発',
    start: new Date('2031-01-01'),
    end: new Date('2031-12-31'),
    attribute: { colorPalette: colorPalettes.blue, labels: [labels.medium] },
  },
  // 108 バックエンド開発
  {
    rowId: 108,
    name: 'コアAPI開発',
    start: new Date('2026-01-01'),
    end: new Date('2026-12-31'),
    attribute: { colorPalette: colorPalettes.orange, labels: [labels.high] },
  },
  {
    rowId: 108,
    name: 'スケールアップ対応',
    start: new Date('2028-07-01'),
    end: new Date('2029-06-30'),
    attribute: { colorPalette: colorPalettes.orange },
  },
  {
    rowId: 108,
    name: 'レガシー移行',
    start: new Date('2031-07-01'),
    end: new Date('2032-12-31'),
    attribute: { colorPalette: colorPalettes.orange, labels: [labels.medium] },
  },
  // 109 API・インテグレーション
  {
    rowId: 109,
    name: '外部API連携',
    start: new Date('2026-07-01'),
    end: new Date('2027-03-31'),
    attribute: { colorPalette: colorPalettes.teal, labels: [labels.external] },
  },
  {
    rowId: 109,
    name: 'パートナーAPI連携',
    start: new Date('2029-01-01'),
    end: new Date('2029-12-31'),
    attribute: { colorPalette: colorPalettes.teal },
  },
  {
    rowId: 109,
    name: 'グローバルAPI整備',
    start: new Date('2031-07-01'),
    end: new Date('2032-06-30'),
    attribute: { colorPalette: colorPalettes.teal, labels: [labels.external] },
  },
  // 110 インフラ・クラウド
  {
    rowId: 110,
    name: 'クラウド移行',
    start: new Date('2025-10-01'),
    end: new Date('2026-09-30'),
    attribute: { colorPalette: colorPalettes.green, labels: [labels.high] },
  },
  {
    rowId: 110,
    name: 'マルチクラウド化',
    start: new Date('2029-01-01'),
    end: new Date('2029-12-31'),
    attribute: { colorPalette: colorPalettes.green },
  },
  {
    rowId: 110,
    name: 'インフラ最適化',
    start: new Date('2032-01-01'),
    end: new Date('2032-12-31'),
    attribute: { colorPalette: colorPalettes.green, labels: [labels.medium] },
  },
  // 111 セキュリティ対策
  {
    rowId: 111,
    name: 'セキュリティ基盤整備',
    start: new Date('2025-07-01'),
    end: new Date('2026-06-30'),
    attribute: { colorPalette: colorPalettes.red, labels: [labels.high] },
  },
  {
    rowId: 111,
    name: 'ペネトレーションテスト',
    start: new Date('2027-07-01'),
    end: new Date('2027-12-31'),
    attribute: { colorPalette: colorPalettes.red },
  },
  {
    rowId: 111,
    name: 'セキュリティ強化v3',
    start: new Date('2031-01-01'),
    end: new Date('2031-12-31'),
    attribute: { colorPalette: colorPalettes.red, labels: [labels.high] },
  },
  // 112 QA・テスト
  {
    rowId: 112,
    name: 'テスト基盤整備',
    start: new Date('2026-10-01'),
    end: new Date('2027-03-31'),
    attribute: { colorPalette: colorPalettes.green },
  },
  {
    rowId: 112,
    name: 'パフォーマンステスト',
    start: new Date('2028-10-01'),
    end: new Date('2028-12-31'),
    attribute: { colorPalette: colorPalettes.green, labels: [labels.medium] },
  },
  {
    rowId: 112,
    name: 'E2Eテスト自動化',
    start: new Date('2031-07-01'),
    end: new Date('2032-06-30'),
    attribute: { colorPalette: colorPalettes.green },
  },
  // 113 CI/CD・DevOps
  {
    rowId: 113,
    name: 'CI/CDパイプライン構築',
    start: new Date('2025-10-01'),
    end: new Date('2026-03-31'),
    attribute: { colorPalette: colorPalettes.teal, labels: [labels.medium] },
  },
  {
    rowId: 113,
    name: 'DevOps文化推進',
    start: new Date('2027-01-01'),
    end: new Date('2027-12-31'),
    attribute: { colorPalette: colorPalettes.teal },
  },
  {
    rowId: 113,
    name: 'GitOps移行',
    start: new Date('2030-07-01'),
    end: new Date('2031-03-31'),
    attribute: { colorPalette: colorPalettes.teal, labels: [labels.medium] },
  },
  // 114 ドキュメント整備
  {
    rowId: 114,
    name: '技術仕様書作成',
    start: new Date('2026-07-01'),
    end: new Date('2026-12-31'),
    attribute: { colorPalette: colorPalettes.purple },
  },
  {
    rowId: 114,
    name: 'APIドキュメント整備',
    start: new Date('2028-01-01'),
    end: new Date('2028-06-30'),
    attribute: { colorPalette: colorPalettes.purple, labels: [labels.low] },
  },
  {
    rowId: 114,
    name: 'ナレッジベース構築',
    start: new Date('2031-01-01'),
    end: new Date('2031-12-31'),
    attribute: { colorPalette: colorPalettes.purple },
  },
  // 115 マーケティング
  {
    rowId: 115,
    name: 'ブランド戦略立案',
    start: new Date('2026-07-01'),
    end: new Date('2026-12-31'),
    attribute: { colorPalette: colorPalettes.orange, labels: [labels.medium] },
  },
  {
    rowId: 115,
    name: 'ローンチキャンペーン',
    start: new Date('2028-04-01'),
    end: new Date('2028-09-30'),
    attribute: { colorPalette: colorPalettes.orange },
  },
  {
    rowId: 115,
    name: 'グローバルマーケティング',
    start: new Date('2031-04-01'),
    end: new Date('2032-03-31'),
    attribute: { colorPalette: colorPalettes.orange, labels: [labels.external] },
  },
  // 116 営業・パートナー開拓
  {
    rowId: 116,
    name: '国内営業体制構築',
    start: new Date('2027-01-01'),
    end: new Date('2027-09-30'),
    attribute: { colorPalette: colorPalettes.blue, labels: [labels.medium] },
  },
  {
    rowId: 116,
    name: 'パートナーシップ締結',
    start: new Date('2028-10-01'),
    end: new Date('2029-06-30'),
    attribute: { colorPalette: colorPalettes.blue, labels: [labels.external] },
  },
  {
    rowId: 116,
    name: '海外販路開拓',
    start: new Date('2031-07-01'),
    end: new Date('2032-12-31'),
    attribute: { colorPalette: colorPalettes.blue },
  },
  // 117 カスタマーサポート体制
  {
    rowId: 117,
    name: 'サポート体制整備',
    start: new Date('2027-10-01'),
    end: new Date('2028-06-30'),
    attribute: { colorPalette: colorPalettes.teal },
  },
  {
    rowId: 117,
    name: 'サポートツール導入',
    start: new Date('2029-07-01'),
    end: new Date('2029-12-31'),
    attribute: { colorPalette: colorPalettes.teal, labels: [labels.medium] },
  },
  {
    rowId: 117,
    name: 'グローバルサポート対応',
    start: new Date('2032-01-01'),
    end: new Date('2032-12-31'),
    attribute: { colorPalette: colorPalettes.teal, labels: [labels.external] },
  },
  // 118 法務・コンプライアンス
  {
    rowId: 118,
    name: '規約・ポリシー整備',
    start: new Date('2026-10-01'),
    end: new Date('2027-03-31'),
    attribute: { colorPalette: colorPalettes.red, labels: [labels.high] },
  },
  {
    rowId: 118,
    name: 'GDPR/個人情報対応',
    start: new Date('2030-01-01'),
    end: new Date('2030-09-30'),
    attribute: { colorPalette: colorPalettes.red, labels: [labels.high] },
  },
  {
    rowId: 118,
    name: 'グローバル法規制対応',
    start: new Date('2032-07-01'),
    end: new Date('2033-06-30'),
    attribute: { colorPalette: colorPalettes.red, labels: [labels.high] },
  },
  // 119 グローバル展開
  {
    rowId: 119,
    name: 'アジア展開',
    start: new Date('2030-01-01'),
    end: new Date('2030-12-31'),
    attribute: { colorPalette: colorPalettes.green, labels: [labels.external] },
  },
  {
    rowId: 119,
    name: '北米展開',
    start: new Date('2031-07-01'),
    end: new Date('2032-06-30'),
    attribute: { colorPalette: colorPalettes.green, labels: [labels.external] },
  },
  {
    rowId: 119,
    name: '欧州展開',
    start: new Date('2033-01-01'),
    end: new Date('2034-06-30'),
    attribute: { colorPalette: colorPalettes.green, labels: [labels.external] },
  },

  // 120 保守・運用
  {
    rowId: 120,
    name: '運用体制構築',
    start: new Date('2028-01-01'),
    end: new Date('2028-06-30'),
    attribute: { colorPalette: colorPalettes.pending },
  },
  {
    rowId: 120,
    name: 'SLA管理・監視強化',
    start: new Date('2030-07-01'),
    end: new Date('2031-06-30'),
    attribute: { colorPalette: colorPalettes.pending, labels: [labels.medium] },
  },
  {
    rowId: 120,
    name: '次世代システム検討',
    start: new Date('2033-07-01'),
    end: new Date('2034-12-31'),
    attribute: { colorPalette: colorPalettes.pending },
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
    attribute: {
      description: 'プロジェクトの目的や機能要件を定義するフェーズです。',
      labels: [labels.high],
    },
  },
  {
    id: 2,
    projectId,
    name: 'UI/UXデザイン',
    order: 2,
    attribute: {
      description: 'ユーザーインターフェースと体験を設計するフェーズです。',
      labels: [labels.external],
    },
  },
  {
    id: 3,
    projectId,
    name: '基本設計',
    order: 3,
    attribute: {
      description: 'システムの構成やデータ構造を決定するフェーズです。',
      labels: [labels.high],
    },
  },
  {
    id: 4,
    projectId,
    name: 'フロントエンド開発',
    order: 4,
    attribute: {
      description: 'ユーザーが直接目にする部分の実装を行うフェーズです。',
      labels: [labels.medium],
    },
  },
  {
    id: 5,
    projectId,
    name: 'バックエンド開発',
    order: 5,
    attribute: {
      description: 'サーバーサイドのロジックやデータベース処理を実装するフェーズです。',
      labels: [labels.medium],
    },
  },
  {
    id: 6,
    projectId,
    name: 'インフラ・CI/CD',
    order: 6,
    attribute: { labels: [labels.low] },
  },
  {
    id: 7,
    projectId,
    name: 'テスト',
    order: 7,
    attribute: { labels: [labels.review] },
  },
  {
    id: 8,
    projectId,
    name: 'リリース',
    order: 8,
    attribute: { labels: [labels.high] },
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
// ガントタスク（日単位プロジェクト）
// ※ 依存関係を設定するため、各タスクに一時的なキー名を付けて管理する
// ============================================================

type TaskDef = {
  rowId: number
  name: string
  start: Date
  end: Date
  attribute: Record<string, any>
  /** 先行タスクのキー名一覧（seedデータ内での参照用） */
  dependsOn?: string[]
}

const ganttTaskDefs: TaskDef[] = [
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
    dependsOn: ['ヒアリング・要望整理'],
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
    dependsOn: ['要件定義書作成'],
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
    dependsOn: ['要件レビュー'],
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
    dependsOn: ['ワイヤーフレーム作成'],
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
    dependsOn: ['要件レビュー'],
  },
  {
    rowId: 3,
    name: 'DB設計',
    start: new Date('2026-01-12'),
    end: new Date('2026-01-23'),
    attribute: {
      colorPalette: colorPalettes.green,
    },
    dependsOn: ['アーキテクチャ設計'],
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
    dependsOn: ['DB設計'],
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
    dependsOn: ['API設計レビュー', 'デザインモックアップ'],
  },
  {
    rowId: 4,
    name: '画面実装（一覧・詳細）',
    start: new Date('2026-02-16'),
    end: new Date('2026-03-06'),
    attribute: {
      colorPalette: colorPalettes.blue,
    },
    dependsOn: ['共通コンポーネント実装'],
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
    dependsOn: ['API設計レビュー'],
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
    data: [...projects, monthlyProject],
  })
  await prisma.ganttRow.createMany({
    data: [...ganttRows, ...monthlyGanttRows],
  })
  // ── 日単位プロジェクト：タスクを順番に create してIDを取得し、依存関係を設定 ──
  const taskIdMap = new Map<string, number>()

  for (const { dependsOn, ...taskData } of ganttTaskDefs) {
    // dependsOn を先行タスクのID（string[]）に変換して attribute に含める
    const depIds =
      dependsOn
        ?.map((name) => taskIdMap.get(name))
        .filter((id): id is number => id !== undefined)
        .map(String) ?? []

    const attribute = depIds.length > 0
      ? { ...taskData.attribute, dependencies: depIds }
      : taskData.attribute

    const created = await prisma.ganttTask.create({
      data: { ...taskData, attribute },
    })
    taskIdMap.set(taskData.name, created.id)
  }

  // 月単位プロジェクトのタスクは依存関係なしで一括挿入
  await prisma.ganttTask.createMany({
    data: monthlyGanttTasks,
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
