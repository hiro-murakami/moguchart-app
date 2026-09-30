# Relational Project Members & Task Assignees Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** プロジェクト権限（`Project.authority`）およびタスク担当者（`Task.attribute.assignees`）の管理を JSON 格納から `ProjectMember` および `TaskAssignee` の正規化テーブルへ移行し、整合性・パフォーマンス・クエリ性を向上させる。

**Architecture:** 
- `ProjectMember`（`id`, `projectId`, `userId?`, `email?`, `role`）と `TaskAssignee`（`id`, `taskId`, `userId?`, `email?`）の2つの中間テーブルを新設。未登録ユーザーは `email` で保持し、ログイン時に UID を自動補完。
- 移行期間中は Dual Write（中間テーブルと既存 JSON の両方へ書き込み）および Dual Read（中間テーブルを優先しつつ JSON をフォールバック）を維持し、既存 API およびフロントエンドとの完全な後方互換を確保。
- 外部キー制約（`onDelete: Cascade`）とインデックスにより、プロジェクトやタスクの削除に伴うクリーンアップと高速な権限判定を実現。

**Tech Stack:**
- Prisma ORM / MySQL (MariaDB)
- Firebase Auth / Cloud Functions (Node.js / TypeScript)
- Vue 3 / Pinia / Vuetify

---

## 全体フェーズ

- [x] **Task 1: ブランチ作成と Prisma スキーマ更新・マイグレーション生成**
- [x] **Task 2: 既存データ（JSON）から中間テーブルへの初期データ移行スクリプト**
- [x] **Task 3: プロジェクト権限チェック & API の中間テーブル対応 (`checkProjectPermission`, `selectProjects`, `upsertProject`)**
- [x] **Task 4: タスク担当者 API の中間テーブル対応 (`upsertGanttTasks`, `toGanttTask`, `selectGanttChart`)**
- [x] **Task 5: ユーザー初回ログイン時の未登録メンバー UID 自動紐付け (`upsertUser`)**
- [x] **Task 6: プロジェクト関係者取得 API (`selectProjectUsers`) のリファクタリング**
- [x] **Task 7: ビルド検証 & 総合テスト**

---

### Task 1: ブランチ作成と Prisma スキーマ更新・マイグレーション生成

**Files:**
- Modify: `packages/functions/prisma/schema.prisma`
- Create: `packages/functions/prisma/migrations/20261001000000_add_project_member_and_task_assignee/migration.sql`

**Step 1: 新ブランチ作成**
- `implement-user-id` から `implement-relational-members` を作成

**Step 2: `schema.prisma` にモデル追加**
```prisma
/// プロジェクトメンバー（権限管理）
model ProjectMember {
  /// ID
  id        String   @id @default(uuid()) @db.Char(36)
  /// プロジェクトID
  projectId String   @db.Char(36)
  /// ユーザーID（登録済みユーザーの場合）
  userId    String?  @db.VarChar(128)
  /// メールアドレス（未登録ユーザー招待時または識別用）
  email     String?  @db.VarChar(255)
  /// ロール ('owner' | 'editor' | 'viewer')
  role      String   @db.VarChar(20)
  /// 作成日時
  createdAt DateTime @default(now()) @db.Timestamp(3)
  /// 更新日時
  updatedAt DateTime @default(now()) @db.Timestamp(3)

  /// プロジェクト
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  /// ユーザー
  user      User?    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([projectId])
  @@index([userId])
  @@index([email])
}

/// タスク担当者
model TaskAssignee {
  /// ID
  id        String    @id @default(uuid()) @db.Char(36)
  /// タスクID
  taskId    Int
  /// ユーザーID（登録済みユーザーの場合）
  userId    String?   @db.VarChar(128)
  /// メールアドレス（未登録ユーザー時または識別用）
  email     String?   @db.VarChar(255)
  /// 作成日時
  createdAt DateTime  @default(now()) @db.Timestamp(3)

  /// タスク
  task      GanttTask @relation(fields: [taskId], references: [id], onDelete: Cascade)
  /// ユーザー
  user      User?     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([taskId])
  @@index([userId])
  @@index([email])
}
```

- `User`, `Project`, `GanttTask` モデルにリレーションフィールド（`members ProjectMember[]`, `assignees TaskAssignee[]`）を追加

**Step 3: Prisma Client 生成とマイグレーション SQL の作成**
- `pnpm --filter functions prisma:generate`

---

### Task 2: 既存データ（JSON）から中間テーブルへの初期データ移行スクリプト

**Files:**
- Create: `packages/functions/src/scripts/migrateJsonToRelational.ts`

**Step 1: 移行スクリプトの作成**
- 全 `Project` の `authority` (JSON) から `owners`, `editors`, `viewers` を抽出し、`ProjectMember` レコードを作成。
  - 値が `@` を含むなら `email`、含まないなら `userId`。`User` テーブルと突き合わせて補完。
- 全 `GanttTask` の `attribute.assignees` (JSON) から `TaskAssignee` レコードを作成。
- 重複チェックを行い安全に投入。

---

### Task 3: プロジェクト権限チェック & API の中間テーブル対応

**Files:**
- Modify: `packages/functions/src/scripts/common/commonFunctions.ts` (`checkProjectPermission`)
- Modify: `packages/functions/src/scripts/selectProjects.ts`
- Modify: `packages/functions/src/scripts/selectProject.ts`
- Modify: `packages/functions/src/scripts/upsertProject.ts`

**Step 1: `checkProjectPermission` の更新**
- `ProjectMember` テーブルから `projectId` と `userId / email` でメンバーレコードを取得。
- レコードが存在すればその `role` で権限チェック。
- レコードが存在しない場合、後方互換として既存の `project.authority` (JSON) をフォールバックチェック。

**Step 2: `selectProjects.ts` のクエリ更新**
- `ProjectMember` の `userId == authUid` または `email == authEmail`、または既存 `authority` JSON に合致するプロジェクトを OR 検索。

**Step 3: `upsertProject.ts` の Dual Write 実装**
- プロジェクト作成・更新時に `ProjectMember` レコードを同期（既存メンバーを差分更新または再作成）。
- 既存の `authority` (JSON) にも同時に保存。

---

### Task 4: タスク担当者 API の中間テーブル対応

**Files:**
- Modify: `packages/functions/src/scripts/upsertGanttTasks.ts`
- Modify: `packages/functions/src/scripts/common/converters.ts` (`toGanttTask`)
- Modify: `packages/functions/src/scripts/selectGanttChart.ts`
- Modify: `packages/functions/src/scripts/selectGanttRows.ts`

**Step 1: `upsertGanttTasks.ts` の Dual Write 実装**
- タスク保存時、`TaskAssignee` テーブルのレコードを同期（DELETE & INSERT）。
- 閲覧権限者の進捗率変更時の担当者判定を、`TaskAssignee` テーブルクエリで行えるように最適化。

**Step 2: `selectGanttChart.ts` / `selectGanttRows.ts` の include 追加**
- `tasks` 取得時に `assignees: true` を include。
- `toGanttTask` で `task.assignees`（中間テーブル）から UID/Email の配列を取り出し、`attribute.assignees` にマッピングして返却（フロントエンドとの完全互換）。

---

### Task 5: ユーザー初回ログイン時の未登録メンバー UID 自動紐付け

**Files:**
- Modify: `packages/functions/src/scripts/upsertUser.ts`

**Step 1: 初回ログイン時の UID 補完**
- ユーザーがログインして `upsertUser` が実行された際、そのユーザーの `email` を持つ `ProjectMember` および `TaskAssignee` のレコードのうち `userId == null` のものを検索し、自身の `user.id` (UID) で一括更新。

---

### Task 6: プロジェクト関係者取得 API (`selectProjectUsers`) のリファクタリング

**Files:**
- Modify: `packages/functions/src/scripts/selectProjectUsers.ts`

**Step 1: リレーションクエリへの刷新**
- JSON の探索ではなく、`ProjectMember` および `TaskAssignee`（経由の `User`）を直接 JOIN/include して取得する効率的なクエリへリファクタリング。

---

### Task 7: ビルド検証 & 総合テスト

**Step 1: ビルドチェック**
- `pnpm --filter functions build`
- `pnpm --filter frontend build`
- `pnpm run build`

**Step 2: 動作検証**
- 新規プロジェクト作成で `ProjectMember` に owner が登録されること
- プロジェクト権限更新で `ProjectMember` が同期されること
- タスク作成・更新で `TaskAssignee` が同期されること
- ガントチャート画面で担当者チップが正しく表示されること
- 閲覧権限ユーザーが自分の担当タスクの進捗率を変更できること
