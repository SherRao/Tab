CREATE TABLE `payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`from_participant_id` integer NOT NULL,
	`to_participant_id` integer NOT NULL,
	`amount_cents` integer NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`to_participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `payments_event_idx` ON `payments` (`event_id`);