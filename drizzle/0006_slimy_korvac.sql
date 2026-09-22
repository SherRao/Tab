ALTER TABLE `line_item_shares` ADD `quantity` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `line_items` ADD `quantity` integer DEFAULT 0 NOT NULL;