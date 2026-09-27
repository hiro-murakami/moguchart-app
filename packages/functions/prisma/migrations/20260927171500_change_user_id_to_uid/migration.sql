-- User テーブルの主キーを email から id (Firebase Auth UID) に変更
-- 既存レコードが存在する場合の安全なステップ移行

-- 1. id カラムを一時的に NULL 許容で追加
ALTER TABLE `User` ADD COLUMN `id` VARCHAR(128) NULL;

-- 2. 既存レコードの id に email を初期値として設定
UPDATE `User` SET `id` = `email` WHERE `id` IS NULL;

-- 3. id を NOT NULL 化、PRIMARY KEY の切り替え、email の NULL 許容化
ALTER TABLE `User`
    MODIFY `id` VARCHAR(128) NOT NULL,
    DROP PRIMARY KEY,
    MODIFY `email` VARCHAR(191) NULL,
    ADD PRIMARY KEY (`id`);

-- 4. email を一意インデックスに設定
CREATE UNIQUE INDEX `User_email_key` ON `User`(`email`);
