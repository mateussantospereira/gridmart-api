CREATE TABLE `access_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cpf` text NOT NULL,
	`status` text NOT NULL,
	`createdAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `devices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`token` text NOT NULL,
	`createdAt` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `devices_token_unique` ON `devices` (`token`);--> statement-breakpoint
CREATE TABLE `door_commands` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`visitId` integer NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`createdAt` text NOT NULL,
	`expiresAt` text NOT NULL,
	`executedAt` text,
	FOREIGN KEY (`visitId`) REFERENCES `visits`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`barcode` text NOT NULL,
	`name` text NOT NULL,
	`priceInCents` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_barcode_unique` ON `products` (`barcode`);--> statement-breakpoint
CREATE TABLE `sale_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`saleId` integer NOT NULL,
	`productId` integer NOT NULL,
	`priceInCents` integer NOT NULL,
	`quantity` integer NOT NULL,
	FOREIGN KEY (`saleId`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sales` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`visitId` integer NOT NULL,
	`totalInCents` integer NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`pixTxid` text,
	`pixQrCode` text,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`visitId`) REFERENCES `visits`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cpf` text NOT NULL,
	`name` text NOT NULL,
	`isBlocked` integer DEFAULT false NOT NULL,
	`createdAt` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_cpf_unique` ON `users` (`cpf`);--> statement-breakpoint
CREATE TABLE `visits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`exitToken` text,
	`exitTokenExpiresAt` text,
	`enteredAt` text NOT NULL,
	`exitedAt` text,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
