CREATE TABLE `invoice_terminals` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `device_key` VARCHAR(80) NOT NULL,
  `kind` VARCHAR(10) NOT NULL,
  UNIQUE INDEX `invoice_terminals_device_key_key` (`device_key`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `invoice_counters` (
  `key` VARCHAR(80) NOT NULL,
  `last_number` INTEGER NOT NULL,
  PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `transactions`
  ADD COLUMN `gateway_token` VARCHAR(255) NULL,
  ADD COLUMN `gateway_url` TEXT NULL,
  ADD COLUMN `checkout_key` VARCHAR(100) NULL,
  ADD COLUMN `checkout_fingerprint` VARCHAR(64) NULL,
  ADD UNIQUE INDEX `transactions_checkout_key_key` (`checkout_key`);
