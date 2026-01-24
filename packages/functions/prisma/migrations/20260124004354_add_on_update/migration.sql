-- AlterTable
ALTER TABLE `GanttChart` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `Row` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `Task` ALTER COLUMN `updatedAt` DROP DEFAULT;
