-- AlterTable
ALTER TABLE `TaskComment`
    ADD COLUMN `projectId` CHAR(36) NULL AFTER `taskId`,
    ADD COLUMN `rowId` INTEGER NULL AFTER `taskId`,
    MODIFY `taskId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `TaskComment` ADD CONSTRAINT `TaskComment_rowId_fkey` FOREIGN KEY (`rowId`) REFERENCES `GanttRow`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskComment` ADD CONSTRAINT `TaskComment_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
