# Member Management UI & Task Assignee UX Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** プロジェクト詳細ダイアログの権限設定を「メンバー一覧テーブル＋ロール変更＋新規メンバー追加」のモダンな管理 UI に刷新し、タスク担当者の選択体験（プロジェクトメンバーからのスムーズな選択）を大幅に向上させる。

**Architecture:** 
- `ProjectDetailDialog.vue` の「権限」タブに、プロジェクトメンバーを統合管理する専用コンポーネント `ProjectMembersTable.vue` を導入。
- メンバー一覧ではアバター、表示名、メールアドレス、ロール選択ドロップダウン（オーナー / 編集者 / 閲覧者）、削除ボタンを提供。
- 新規追加エリアではメールアドレス/名前の入力補完とロール指定で1クリック追加できる直感的な操作感を実現。
- タスク詳細ダイアログ（`TaskDetailDialog.vue`）でも、プロジェクトメンバー情報（`props.users`）を活用し、アバター・名前付きで直感的に担当者を選択できる UX に向上。
- データ構造は既存の `authority: { owners, editors, viewers }` を維持・同期し、バックエンドの `ProjectMember` テーブルとシームレスに連携。

**Tech Stack:**
- Vue 3 / Composition API / TypeScript
- Vuetify 3 (v-table, v-avatar, v-select, v-chip, v-btn, v-text-field)
- Pinia (`useUserStore`)

---

## 全体フェーズ

- [x] **Task 1: ブランチ作成とメンバー管理コンポーネント (`ProjectMembersTable.vue`) の新設**
- [x] **Task 2: `useProjectDetailDialog.ts` と `ProjectDetailDialog.vue` への統合**
- [x] **Task 3: タスク詳細ダイアログ (`TaskDetailDialog.vue`) の担当者選択 UX 強化**
- [x] **Task 4: フロントエンドビルド検証 & 動作テスト**
