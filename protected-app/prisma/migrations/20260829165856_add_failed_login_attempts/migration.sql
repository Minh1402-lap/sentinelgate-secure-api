-- AlterTable
ALTER TABLE `users` ADD COLUMN `failedLoginAttempts` INTEGER NOT NULL DEFAULT 0,
    MODIFY `name` VARCHAR(191) NULL;
