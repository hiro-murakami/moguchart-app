-- DropForeignKey
ALTER TABLE `GanttTask` DROP FOREIGN KEY `GanttTask_rowId_fkey`;

-- DropIndex
DROP INDEX `GanttTask_rowId_fkey` ON `GanttTask`;

-- AddForeignKey
ALTER TABLE `GanttTask` ADD CONSTRAINT `GanttTask_rowId_fkey` FOREIGN KEY (`rowId`) REFERENCES `GanttRow`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
