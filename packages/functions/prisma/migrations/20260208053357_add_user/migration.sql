-- CreateTable
CREATE TABLE `User` (
    `email` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NULL,
    `attribute` JSON NOT NULL,
    `createdBy` VARCHAR(191) NULL DEFAULT 'system',
    `createdAt` TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedBy` VARCHAR(191) NULL DEFAULT 'system',
    `updatedAt` TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`email`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
