CREATE TABLE `expense_shares` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`expense_id` integer NOT NULL,
	`participant_id` integer,
	`group_id` integer,
	`line_item_id` integer,
	`weight_type` text NOT NULL,
	`weight_value` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`expense_id`) REFERENCES `expenses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`line_item_id`) REFERENCES `line_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `expense_shares_expense_idx` ON `expense_shares` (`expense_id`);--> statement-breakpoint
CREATE INDEX `expense_shares_line_item_idx` ON `expense_shares` (`line_item_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `expense_shares_unique_idx` ON `expense_shares` (`expense_id`,`line_item_id`,`participant_id`,`group_id`);