/*
  Warnings:

  - You are about to drop the `TaskComment` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `TaskComment` DROP FOREIGN KEY `TaskComment_projectId_fkey`;

-- DropForeignKey
ALTER TABLE `TaskComment` DROP FOREIGN KEY `TaskComment_rowId_fkey`;

-- DropForeignKey
ALTER TABLE `TaskComment` DROP FOREIGN KEY `TaskComment_taskId_fkey`;

-- DropTable
DROP TABLE `TaskComment`;

-- CreateTable
CREATE TABLE `Comment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `taskId` INTEGER NULL,
    `rowId` INTEGER NULL,
    `projectId` CHAR(36) NULL,
    `content` TEXT NOT NULL,
    `createdBy` VARCHAR(191) NULL DEFAULT 'system',
    `createdAt` TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedBy` VARCHAR(191) NULL DEFAULT 'system',
    `updatedAt` TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Comment` ADD CONSTRAINT `Comment_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `GanttTask`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comment` ADD CONSTRAINT `Comment_rowId_fkey` FOREIGN KEY (`rowId`) REFERENCES `GanttRow`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comment` ADD CONSTRAINT `Comment_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
