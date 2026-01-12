-- AlterTable
ALTER TABLE `GanttChart` ADD COLUMN `createdBy` VARCHAR(191) NOT NULL DEFAULT 'system',
    ADD COLUMN `updatedBy` VARCHAR(191) NOT NULL DEFAULT 'system';
