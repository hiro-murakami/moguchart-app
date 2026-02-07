-- AlterTable
ALTER TABLE `GanttRow` ADD COLUMN `attribute` JSON NOT NULL;

-- AlterTable
ALTER TABLE `GanttTask` ADD COLUMN `attribute` JSON NOT NULL;
