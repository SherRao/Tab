import { relations } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  shareToken: text("share_token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const participants = sqliteTable(
  "participants",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    addedAt: integer("added_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("participants_event_idx").on(t.eventId)],
);

export const SPLIT_MODES = ["itemized", "even", "group"] as const;
export type SplitMode = (typeof SPLIT_MODES)[number];

export const expenses = sqliteTable(
  "expenses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    payerId: integer("payer_id")
      .notNull()
      .references(() => participants.id, { onDelete: "restrict" }),
    description: text("description"),
    taxCents: integer("tax_cents").notNull().default(0),
    tipCents: integer("tip_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),
    splitMode: text("split_mode", { enum: SPLIT_MODES })
      .notNull()
      .default("itemized"),
    evenParticipantIds: text("even_participant_ids", { mode: "json" }).$type<
      number[]
    >(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("expenses_event_idx").on(t.eventId)],
);

export const lineItems = sqliteTable(
  "line_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    expenseId: integer("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    amountCents: integer("amount_cents").notNull(),
  },
  (t) => [index("line_items_expense_idx").on(t.expenseId)],
);

export const lineItemShares = sqliteTable(
  "line_item_shares",
  {
    lineItemId: integer("line_item_id")
      .notNull()
      .references(() => lineItems.id, { onDelete: "cascade" }),
    participantId: integer("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.lineItemId, t.participantId] })],
);

export const eventsRelations = relations(events, ({ many }) => ({
  participants: many(participants),
  expenses: many(expenses),
}));

export const participantsRelations = relations(participants, ({ one }) => ({
  event: one(events, {
    fields: [participants.eventId],
    references: [events.id],
  }),
}));

export const expensesRelations = relations(expenses, ({ one, many }) => ({
  event: one(events, { fields: [expenses.eventId], references: [events.id] }),
  payer: one(participants, {
    fields: [expenses.payerId],
    references: [participants.id],
  }),
  lineItems: many(lineItems),
}));

export const lineItemsRelations = relations(lineItems, ({ one, many }) => ({
  expense: one(expenses, {
    fields: [lineItems.expenseId],
    references: [expenses.id],
  }),
  shares: many(lineItemShares),
}));

export const lineItemSharesRelations = relations(lineItemShares, ({ one }) => ({
  lineItem: one(lineItems, {
    fields: [lineItemShares.lineItemId],
    references: [lineItems.id],
  }),
  participant: one(participants, {
    fields: [lineItemShares.participantId],
    references: [participants.id],
  }),
}));
