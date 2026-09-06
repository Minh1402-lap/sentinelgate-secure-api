-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `action` ENUM('LOGIN_SUCCEEDED', 'LOGIN_FAILED', 'ACCOUNT_LOCKED', 'PROFILE_UPDATED', 'ADMIN_USERS_LISTED', 'ADMIN_USER_VIEWED') NOT NULL,
    `outcome` ENUM('SUCCESS', 'FAILURE', 'DENIED') NOT NULL,
    `ipAddress` VARCHAR(45) NULL,
    `userAgent` VARCHAR(512) NULL,
    `details` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_actorId_createdAt_idx`(`actorId`, `createdAt`),
    INDEX `audit_logs_action_createdAt_idx`(`action`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
