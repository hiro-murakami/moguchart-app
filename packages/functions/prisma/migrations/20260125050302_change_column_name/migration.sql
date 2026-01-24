/*
  Warnings:

  - You are about to drop the column `label` on the `GanttRow` table. All the data in the column will be lost.
  - Added the required column `name` to the `GanttRow` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `GanttRow`
  RENAME COLUMN `label` TO `name`;
