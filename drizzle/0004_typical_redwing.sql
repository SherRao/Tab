DROP INDEX `participants_user_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `participants_user_unique` ON `participants` (`event_id`,`user_id`) WHERE user_id is not null;