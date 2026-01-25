-- CreateTable
CREATE TABLE `GanttRow` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '行ID',
    `name` VARCHAR(191) NOT NULL COMMENT '行ラベル',
    `createdBy` VARCHAR(191) NULL DEFAULT 'system' COMMENT '作成者email',
    `createdAt` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '作成日時',
    `updatedBy` VARCHAR(191) NULL DEFAULT 'system' COMMENT '更新者email',
    `updatedAt` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '更新日時',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GanttTask` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT 'タスクID',
    `rowId` INTEGER NOT NULL COMMENT '行ID',
    `name` VARCHAR(191) NOT NULL COMMENT 'タスク名',
    `start` DATETIME(3) NOT NULL COMMENT '開始日時',
    `end` DATETIME(3) NOT NULL COMMENT '終了日時',
    `createdBy` VARCHAR(191) NULL DEFAULT 'system' COMMENT '作成者email',
    `createdAt` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '作成日時',
    `updatedBy` VARCHAR(191) NULL DEFAULT 'system' COMMENT '更新者email',
    `updatedAt` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '更新日時',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `GanttTask` ADD CONSTRAINT `GanttTask_rowId_fkey` FOREIGN KEY (`rowId`) REFERENCES `GanttRow`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
