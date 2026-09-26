import type { DatabaseSync } from 'node:sqlite';
import type { ISODate } from '../../shared/calendar';
import { daysUntilExpiry, expiryState } from '../../shared/expiry';
import { translate } from '../../shared/i18n/translate';
import type { PersonAccountData, ValidationIssue } from '../../shared/schemas';
import type { ExpiringItem, PersonAccountRecord } from '../../shared/types';

interface AccountRow {
  id: number;
  resource_id: number;
  type_id: number | null;
  expiry_date: string;
  remind_days: number;
  note: string | null;
  created_at: string;
  person_name: string;
  type_name: string | null;
  type_name_ar: string | null;
}

const SELECT_ACCOUNTS = `
  SELECT a.*, r.name AS person_name, lv.name AS type_name, lv.name_ar AS type_name_ar
  FROM person_accounts a
  JOIN resources r ON r.id = a.resource_id
  LEFT JOIN list_values lv ON lv.id = a.type_id`;

/** Soonest expiry first, ties broken by id. */
const ORDER_ACCOUNTS = 'ORDER BY a.expiry_date ASC, a.id ASC';

function toAccount(row: AccountRow, today: ISODate): PersonAccountRecord {
  return {
    id: row.id,
    resourceId: row.resource_id,
    personName: row.person_name,
    type: row.type_id === null ? null : { id: row.type_id, name: row.type_name!, nameAr: row.type_name_ar },
    expiryDate: row.expiry_date as ISODate,
    remindDays: row.remind_days,
    note: row.note,
    createdAt: row.created_at,
    state: expiryState(row.expiry_date as ISODate, today, row.remind_days)!,
  };
}

function getRow(db: DatabaseSync, id: number): AccountRow | undefined {
  return db.prepare(`${SELECT_ACCOUNTS} WHERE a.id = ?`).get(id) as unknown as AccountRow | undefined;
}

export function getPersonAccount(db: DatabaseSync, id: number, today: ISODate): PersonAccountRecord | undefined {
  const row = getRow(db, id);
  return row ? toAccount(row, today) : undefined;
}

export function listPersonAccounts(db: DatabaseSync, resourceId: number, today: ISODate): PersonAccountRecord[] {
  const rows = db.prepare(`${SELECT_ACCOUNTS} WHERE a.resource_id = ? ${ORDER_ACCOUNTS}`).all(resourceId) as unknown as AccountRow[];
  return rows.map((row) => toAccount(row, today));
}

/** Validates the type, when set: it must be an `accountType` value. Nothing is saved. */
export function checkPersonAccountRefs(db: DatabaseSync, data: { typeId?: number | null }): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (data.typeId != null) {
    const type = db.prepare("SELECT id FROM list_values WHERE id = ? AND list = 'accountType'").get(data.typeId);
    if (!type) issues.push({ path: 'typeId', message: translate('en', 'error.unknownAccountType'), code: 'error.unknownAccountType' });
  }
  return issues;
}

export function createPersonAccount(
  db: DatabaseSync, resourceId: number, data: PersonAccountData, createdAt: string, today: ISODate,
): PersonAccountRecord {
  const res = db
    .prepare('INSERT INTO person_accounts (resource_id, type_id, expiry_date, remind_days, note, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(resourceId, data.typeId, data.expiryDate, data.remindDays, data.note, createdAt);
  return getPersonAccount(db, Number(res.lastInsertRowid), today)!;
}

/** Changes every field: type, expiry date, reminder lead and note. Also used for "Renewed" (a new expiry date, with
 * the old one recorded in the note by the caller). Returns undefined when the account does not exist. */
export function updatePersonAccount(db: DatabaseSync, id: number, data: PersonAccountData, today: ISODate): PersonAccountRecord | undefined {
  if (!getPersonAccount(db, id, today)) return undefined;
  db.prepare('UPDATE person_accounts SET type_id = ?, expiry_date = ?, remind_days = ?, note = ? WHERE id = ?').run(
    data.typeId, data.expiryDate, data.remindDays, data.note, id,
  );
  return getPersonAccount(db, id, today);
}

export function deletePersonAccountRow(db: DatabaseSync, id: number): boolean {
  return Number(db.prepare('DELETE FROM person_accounts WHERE id = ?').run(id).changes) > 0;
}

/**
 * Every account expired, or due to be renewed (today is on or after `expiry - remindDays`, so a 45-day renewal
 * warns 45 days ahead), across everyone; feeds GET /api/people/expiring. `withinDays` (the documents' window)
 * plays no part here — each account's own reminder lead decides.
 */
export function listExpiringAccounts(db: DatabaseSync, today: ISODate): ExpiringItem[] {
  const rows = db.prepare(`${SELECT_ACCOUNTS} ${ORDER_ACCOUNTS}`).all() as unknown as AccountRow[];
  return rows
    .filter((row) => daysUntilExpiry(row.expiry_date as ISODate, today) <= row.remind_days)
    .map((row) => ({
      kind: 'account' as const,
      id: row.id,
      person: { id: row.resource_id, name: row.person_name },
      type: row.type_id === null ? null : { id: row.type_id, name: row.type_name!, nameAr: row.type_name_ar },
      name: null,
      expiryDate: row.expiry_date as ISODate,
      state: expiryState(row.expiry_date as ISODate, today, row.remind_days)!,
    }));
}
