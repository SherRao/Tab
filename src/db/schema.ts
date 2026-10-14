import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    username: text("username").notNull(),
    displayName: text("display_name").notNull(),
    createdAt: timestamp("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("users_email_unique").on(t.email),
    uniqueIndex("users_username_unique").on(t.username),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [uniqueIndex("sessions_token_hash_unique").on(t.tokenHash)],
);

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  shareToken: text("share_token").notNull().unique(),
  ownerId: integer("owner_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
});

export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
});

export const participants = pgTable(
  "participants",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    userId: integer("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    email: text("email"),
    invitedAt: timestamp("invited_at"),
    addedAt: timestamp("added_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("participants_event_idx").on(t.eventId),
    uniqueIndex("participants_user_unique")
      .on(t.eventId, t.userId)
      .where(sql`user_id is not null`),
  ],
);

export const AUTH_TOKEN_PURPOSES = ["signin", "invite"] as const;
export type AuthTokenPurpose = (typeof AUTH_TOKEN_PURPOSES)[number];

export const participantGroup = pgTable(
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

export const authTokens = pgTable(
  "auth_tokens",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull(),
    purpose: text("purpose", { enum: AUTH_TOKEN_PURPOSES }).notNull(),
    participantId: integer("participant_id").references(() => participants.id, {
      onDelete: "cascade",
    }),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [uniqueIndex("auth_tokens_token_hash_unique").on(t.tokenHash)],
);

export const CLAIM_STATUSES = ["pending", "approved", "denied"] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const participantClaims = pgTable(
  "participant_claims",
  {
    id: serial("id").primaryKey(),
    participantId: integer("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    requesterUserId: integer("requester_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status", { enum: CLAIM_STATUSES }).notNull().default("pending"),
    createdAt: timestamp("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    decidedAt: timestamp("decided_at"),
  },
  (t) => [
    index("participant_claims_participant_idx").on(t.participantId),
    uniqueIndex("participant_claims_pending_unique")
      .on(t.participantId, t.requesterUserId)
      .where(sql`status = 'pending'`),
  ],
);

export const SPLIT_MODES = ["itemized", "even"] as const;
export type SplitMode = (typeof SPLIT_MODES)[number];

export const expenses = pgTable(
  "expenses",
  {
    id: serial("id").primaryKey(),
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
    splitMode: text("split_mode", { enum: SPLIT_MODES }).notNull().default("itemized"),
    createdAt: timestamp("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("expenses_event_idx").on(t.eventId)],
);

export const lineItems = pgTable(
  "line_items",
  {
    id: serial("id").primaryKey(),
    expenseId: integer("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    amountCents: integer("amount_cents").notNull(),
    quantity: integer("quantity").notNull().default(0),
  },
  (t) => [index("line_items_expense_idx").on(t.expenseId)],
);

export const lineItemShares = pgTable(
  "line_item_shares",
  {
    lineItemId: integer("line_item_id")
      .notNull()
      .references(() => lineItems.id, { onDelete: "cascade" }),
    participantId: integer("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.lineItemId, t.participantId] })],
);

export const WEIGHT_TYPES = ["equal", "percent", "amount"] as const;
export type WeightType = (typeof WEIGHT_TYPES)[number];

export const expenseShares = pgTable(
  "expense_shares",
  {
    id: serial("id").primaryKey(),
    expenseId: integer("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    participantId: integer("participant_id").references(() => participants.id, {
      onDelete: "cascade",
    }),
    groupId: integer("group_id").references(() => groups.id, {
      onDelete: "set null",
    }),
    lineItemId: integer("line_item_id").references(() => lineItems.id, {
      onDelete: "cascade",
    }),
    weightType: text("weight_type", { enum: WEIGHT_TYPES }).notNull(),
    weightValue: integer("weight_value").notNull(),
    createdAt: timestamp("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("expense_shares_expense_idx").on(t.expenseId),
    index("expense_shares_line_item_idx").on(t.lineItemId),
    uniqueIndex("expense_shares_unique_idx").on(
      t.expenseId,
      t.lineItemId,
      t.participantId,
      t.groupId,
    ),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    fromParticipantId: integer("from_participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "restrict" }),
    toParticipantId: integer("to_participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "restrict" }),
    amountCents: integer("amount_cents").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("payments_event_idx").on(t.eventId)],
);

export const eventsRelations = relations(events, ({ many, one }) => ({
  participants: many(participants),
  expenses: many(expenses),
  payments: many(payments),
  owner: one(users, {
    fields: [events.ownerId],
    references: [users.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  event: one(events, { fields: [payments.eventId], references: [events.id] }),
  fromParticipant: one(participants, {
    fields: [payments.fromParticipantId],
    references: [participants.id],
    relationName: "paymentsFrom",
  }),
  toParticipant: one(participants, {
    fields: [payments.toParticipantId],
    references: [participants.id],
    relationName: "paymentsTo",
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
  expenseShares: many(expenseShares),
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

export const expenseSharesRelations = relations(expenseShares, ({ one }) => ({
  expense: one(expenses, {
    fields: [expenseShares.expenseId],
    references: [expenses.id],
  }),
  participant: one(participants, {
    fields: [expenseShares.participantId],
    references: [participants.id],
  }),
  group: one(groups, {
    fields: [expenseShares.groupId],
    references: [groups.id],
  }),
  lineItem: one(lineItems, {
    fields: [expenseShares.lineItemId],
    references: [lineItems.id],
  }),
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
  event: one(events, {
    fields: [groups.eventId],
    references: [events.id],
  }),
  members: many(participantGroup),
}));
