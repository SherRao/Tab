import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull(),
    username: text("username").notNull(),
    displayName: text("display_name").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("users_email_unique").on(t.email),
    uniqueIndex("users_username_unique").on(t.username),
  ],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [uniqueIndex("sessions_token_hash_unique").on(t.tokenHash)],
);

export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  shareToken: text("share_token").notNull().unique(),
  ownerId: integer("owner_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const groups = sqliteTable("groups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventId: integer("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
});

export const participants = sqliteTable(
  "participants",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    userId: integer("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    email: text("email"),
    invitedAt: integer("invited_at", { mode: "timestamp" }),
    addedAt: integer("added_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("participants_event_idx").on(t.eventId),
    uniqueIndex("participants_user_unique")
      .on(t.userId)
      .where(sql`user_id is not null`),
  ],
);

export const AUTH_TOKEN_PURPOSES = ["signin", "invite"] as const;
export type AuthTokenPurpose = (typeof AUTH_TOKEN_PURPOSES)[number];

export const participantGroup = sqliteTable(
  "participantGroup",
  {
    participantId: integer("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    groupId: integer("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.participantId, t.groupId] })],
);

export const authTokens = sqliteTable(
  "auth_tokens",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull(),
    purpose: text("purpose", { enum: AUTH_TOKEN_PURPOSES }).notNull(),
    participantId: integer("participant_id").references(() => participants.id, {
      onDelete: "cascade",
    }),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    usedAt: integer("used_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [uniqueIndex("auth_tokens_token_hash_unique").on(t.tokenHash)],
);

export const CLAIM_STATUSES = ["pending", "approved", "denied"] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const participantClaims = sqliteTable(
  "participant_claims",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    participantId: integer("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    requesterUserId: integer("requester_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status", { enum: CLAIM_STATUSES })
      .notNull()
      .default("pending"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    decidedAt: integer("decided_at", { mode: "timestamp" }),
  },
  (t) => [
    index("participant_claims_participant_idx").on(t.participantId),
    uniqueIndex("participant_claims_pending_unique")
      .on(t.participantId, t.requesterUserId)
      .where(sql`status = 'pending'`),
  ],
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
    groupIds: text("group_ids", { mode: "json" }).$type<number[] | null>(),
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

export const eventsRelations = relations(events, ({ many, one }) => ({
  participants: many(participants),
  expenses: many(expenses),
  owner: one(users, {
    fields: [events.ownerId],
    references: [users.id],
  }),
}));

export const participantsRelations = relations(participants, ({ one }) => ({
  event: one(events, {
    fields: [participants.eventId],
    references: [events.id],
  }),
  user: one(users, {
    fields: [participants.userId],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  ownedEvents: many(events),
  participations: many(participants),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
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
