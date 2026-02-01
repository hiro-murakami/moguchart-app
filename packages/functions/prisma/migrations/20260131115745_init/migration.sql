-- CreateTable
CREATE TABLE `Project` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `start` DATETIME(3) NOT NULL,
    `end` DATETIME(3) NOT NULL,
    `attribute` JSON NOT NULL,
    `createdBy` VARCHAR(191) NULL DEFAULT 'system',
    `createdAt` TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedBy` VARCHAR(191) NULL DEFAULT 'system',
    `updatedAt` TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GanttRow` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `projectId` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdBy` VARCHAR(191) NULL DEFAULT 'system',
    `createdAt` TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedBy` VARCHAR(191) NULL DEFAULT 'system',
    `updatedAt` TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GanttTask` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rowId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `start` DATETIME(3) NOT NULL,
    `end` DATETIME(3) NOT NULL,
    `createdBy` VARCHAR(191) NULL DEFAULT 'system',
    `createdAt` TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedBy` VARCHAR(191) NULL DEFAULT 'system',
    `updatedAt` TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `GanttRow` ADD CONSTRAINT `GanttRow_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GanttTask` ADD CONSTRAINT `GanttTask_rowId_fkey` FOREIGN KEY (`rowId`) REFERENCES `GanttRow`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
