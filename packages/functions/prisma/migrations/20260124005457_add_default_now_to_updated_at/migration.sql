/*
  Warnings:

  - Made the column `updatedAt` on table `GanttChart` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updatedAt` on table `Row` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updatedAt` on table `Task` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `GanttChart` MODIFY `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `Row` MODIFY `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `Task` MODIFY `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
