-- AlterTable
ALTER TABLE `Project`
    MODIFY COLUMN `attribute` JSON NOT NULL DEFAULT ('{}'),
    ADD COLUMN `authority` JSON NOT NULL DEFAULT ('{}'),
    ADD COLUMN `public` BOOLEAN NOT NULL DEFAULT false;
