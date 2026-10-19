ALTER TABLE `access_logs` ADD `publicId` text DEFAULT (
  lower(hex(randomblob(4))) || '-' ||
  lower(hex(randomblob(2))) || '-4' ||
  substr(lower(hex(randomblob(2))), 2) || '-' ||
  substr('89ab', abs(random()) % 4 + 1, 1) ||
  substr(lower(hex(randomblob(2))), 2) || '-' ||
  lower(hex(randomblob(6)))
) NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `access_logs_publicId_unique` ON `access_logs` (`publicId`);--> statement-breakpoint
ALTER TABLE `products` ADD `publicId` text DEFAULT (
  lower(hex(randomblob(4))) || '-' ||
  lower(hex(randomblob(2))) || '-4' ||
  substr(lower(hex(randomblob(2))), 2) || '-' ||
  substr('89ab', abs(random()) % 4 + 1, 1) ||
  substr(lower(hex(randomblob(2))), 2) || '-' ||
  lower(hex(randomblob(6)))
) NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `products_publicId_unique` ON `products` (`publicId`);--> statement-breakpoint
ALTER TABLE `sale_items` ADD `publicId` text DEFAULT (
  lower(hex(randomblob(4))) || '-' ||
  lower(hex(randomblob(2))) || '-4' ||
  substr(lower(hex(randomblob(2))), 2) || '-' ||
  substr('89ab', abs(random()) % 4 + 1, 1) ||
  substr(lower(hex(randomblob(2))), 2) || '-' ||
  lower(hex(randomblob(6)))
) NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `sale_items_publicId_unique` ON `sale_items` (`publicId`);--> statement-breakpoint
ALTER TABLE `sales` ADD `publicId` text DEFAULT (
  lower(hex(randomblob(4))) || '-' ||
  lower(hex(randomblob(2))) || '-4' ||
  substr(lower(hex(randomblob(2))), 2) || '-' ||
  substr('89ab', abs(random()) % 4 + 1, 1) ||
  substr(lower(hex(randomblob(2))), 2) || '-' ||
  lower(hex(randomblob(6)))
) NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `sales_publicId_unique` ON `sales` (`publicId`);--> statement-breakpoint
ALTER TABLE `users` ADD `publicId` text DEFAULT (
  lower(hex(randomblob(4))) || '-' ||
  lower(hex(randomblob(2))) || '-4' ||
  substr(lower(hex(randomblob(2))), 2) || '-' ||
  substr('89ab', abs(random()) % 4 + 1, 1) ||
  substr(lower(hex(randomblob(2))), 2) || '-' ||
  lower(hex(randomblob(6)))
) NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `users_publicId_unique` ON `users` (`publicId`);--> statement-breakpoint
ALTER TABLE `visits` ADD `publicId` text DEFAULT (
  lower(hex(randomblob(4))) || '-' ||
  lower(hex(randomblob(2))) || '-4' ||
  substr(lower(hex(randomblob(2))), 2) || '-' ||
  substr('89ab', abs(random()) % 4 + 1, 1) ||
  substr(lower(hex(randomblob(2))), 2) || '-' ||
  lower(hex(randomblob(6)))
) NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `visits_publicId_unique` ON `visits` (`publicId`);