CREATE TABLE "expense_shares" (
	"id" serial PRIMARY KEY NOT NULL,
	"expense_id" integer NOT NULL,
	"participant_id" integer,
	"group_id" integer,
	"line_item_id" integer,
	"weight_type" text NOT NULL,
	"weight_value" integer NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE INDEX "expense_shares_expense_idx" ON "expense_shares" USING btree ("expense_id");
--> statement-breakpoint
CREATE INDEX "expense_shares_line_item_idx" ON "expense_shares" USING btree ("line_item_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "expense_shares_unique_idx" ON "expense_shares" USING btree ("expense_id","line_item_id","participant_id","group_id");
--> statement-breakpoint
ALTER TABLE "expense_shares" ADD CONSTRAINT "expense_shares_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "expense_shares" ADD CONSTRAINT "expense_shares_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "expense_shares" ADD CONSTRAINT "expense_shares_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "expense_shares" ADD CONSTRAINT "expense_shares_line_item_id_line_items_id_fk" FOREIGN KEY ("line_item_id") REFERENCES "public"."line_items"("id") ON DELETE cascade ON UPDATE no action;
