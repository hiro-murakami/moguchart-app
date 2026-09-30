-- CreateTable ProjectMember
CREATE TABLE `ProjectMember` (
    `id` CHAR(36) NOT NULL,
    `projectId` CHAR(36) NOT NULL,
    `userId` VARCHAR(128) NULL,
    `email` VARCHAR(255) NULL,
    `role` VARCHAR(20) NOT NULL,
    `createdAt` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    INDEX `ProjectMember_projectId_idx`(`projectId`),
    INDEX `ProjectMember_userId_idx`(`userId`),
    INDEX `ProjectMember_email_idx`(`email`),
    PRIMARY KEY (`id`),
    CONSTRAINT `ProjectMember_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `ProjectMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable TaskAssignee
CREATE TABLE `TaskAssignee` (
    `id` CHAR(36) NOT NULL,
    `taskId` INTEGER NOT NULL,
    `userId` VARCHAR(128) NULL,
    `email` VARCHAR(255) NULL,
    `createdAt` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TaskAssignee_taskId_idx`(`taskId`),
    INDEX `TaskAssignee_userId_idx`(`userId`),
    INDEX `TaskAssignee_email_idx`(`email`),
    PRIMARY KEY (`id`),
    CONSTRAINT `TaskAssignee_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `GanttTask`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `TaskAssignee_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
