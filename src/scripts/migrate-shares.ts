/**
 * Data migration: populate `expense_shares` from existing expenses.
 *
 * - `group` expenses → all event participants, equal shares at total level
 * - `even` expenses  → `evenParticipantIds ?? groupIds`, else all participants, equal shares at total level
 * - `itemized` expenses → per line-item from `line_item_shares`, equal shares at line-item level
 *
 * Run with: npx tsx src/scripts/migrate-shares.ts
 */

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const url = process.env.DATABASE_URL ?? "file:./data/app.db";
const dbPath = url.replace(/^file:/, "");
fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

function migrate() {
  const expenses = sqlite
    .prepare("SELECT * FROM expenses")
    .all() as Array<{
    id: number;
    event_id: number;
    split_mode: string;
    group_ids: string | null;
    even_participant_ids: string | null;
  }>;

  const participants = sqlite
    .prepare("SELECT id, event_id FROM participants")
    .all() as Array<{ id: number; event_id: number }>;

  const eventParticipants = new Map<number, number[]>();
  for (const p of participants) {
    const arr = eventParticipants.get(p.event_id) ?? [];
    arr.push(p.id);
    eventParticipants.set(p.event_id, arr);
  }

  const lineItemSharesRows = sqlite
    .prepare("SELECT * FROM line_item_shares")
    .all() as Array<{ line_item_id: number; participant_id: number }>;

  const sharesByLineItem = new Map<number, number[]>();
  for (const row of lineItemSharesRows) {
    const arr = sharesByLineItem.get(row.line_item_id) ?? [];
    arr.push(row.participant_id);
    sharesByLineItem.set(row.line_item_id, arr);
  }

  const lineItems = sqlite
    .prepare("SELECT id, expense_id FROM line_items")
    .all() as Array<{ id: number; expense_id: number }>;

  const lineItemsByExpense = new Map<number, number[]>();
  for (const li of lineItems) {
    const arr = lineItemsByExpense.get(li.expense_id) ?? [];
    arr.push(li.id);
    lineItemsByExpense.set(li.expense_id, arr);
  }

  const insert = sqlite.prepare(`
    INSERT INTO expense_shares (expense_id, participant_id, group_id, line_item_id, weight_type, weight_value, created_at)
    VALUES (?, ?, NULL, ?, 'equal', 10000, unixepoch())
  `);

  let totalShares = 0;

  const insertMany = sqlite.transaction(() => {
    for (const expense of expenses) {
      const allEventParticipantIds = eventParticipants.get(expense.event_id) ?? [];

      if (expense.split_mode === "group") {
        for (const pid of allEventParticipantIds) {
          insert.run(expense.id, pid, null);
          totalShares++;
        }
      } else if (expense.split_mode === "even") {
        let participantIds: number[] | null = null;
        if (expense.even_participant_ids) {
          try {
            const parsed = JSON.parse(expense.even_participant_ids);
            if (Array.isArray(parsed) && parsed.length > 0) participantIds = parsed;
          } catch {
            // ignore
          }
        }
        if (!participantIds && expense.group_ids) {
          try {
            const parsed = JSON.parse(expense.group_ids);
            if (Array.isArray(parsed) && parsed.length > 0) participantIds = parsed;
          } catch {
            // ignore
          }
        }
        if (!participantIds || participantIds.length === 0) {
          participantIds = allEventParticipantIds;
        }
        for (const pid of participantIds) {
          insert.run(expense.id, pid, null);
          totalShares++;
        }
      } else if (expense.split_mode === "itemized") {
        const expenseLineItems = lineItemsByExpense.get(expense.id) ?? [];
        for (const lineItemId of expenseLineItems) {
          const assigneeIds = sharesByLineItem.get(lineItemId) ?? [];
          for (const pid of assigneeIds) {
            insert.run(expense.id, pid, lineItemId);
            totalShares++;
          }
        }
      }
    }
  });

  insertMany();

  const count = (sqlite.prepare("SELECT count(*) as c FROM expense_shares").get() as { c: number }).c;
  console.log(`Migration complete. Inserted ${totalShares} expense_shares rows (${count} total in table).`);

  // Verify: every expense should have at least one share
  const orphanExpenses = sqlite
    .prepare(
      `SELECT e.id FROM expenses e LEFT JOIN expense_shares es ON es.expense_id = e.id WHERE es.id IS NULL`,
    )
    .all() as Array<{ id: number }>;
  if (orphanExpenses.length > 0) {
    console.warn(`Warning: ${orphanExpenses.length} expenses have no shares:`, orphanExpenses.map((e) => e.id));
  } else {
    console.log("All expenses have at least one share row.");
  }
}

migrate();
sqlite.close();
