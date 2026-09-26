import type { DatabaseSync } from 'node:sqlite';
import { addDays, type ISODate } from '../../shared/calendar';
import { expiryState } from '../../shared/expiry';
import { translate } from '../../shared/i18n/translate';
import type { KeyDateData, KeyDateItemData, ValidationIssue } from '../../shared/schemas';
import type { KeyDateRecord, UpcomingKeyDate } from '../../shared/types';
import { isPreviewable } from '../attachments/files';
import { transaction } from '../db';

/** Key dates are never shown as "soon" more than 30 days ahead; the same window a passed one stays reminded for. */
const KEY_DATE_WINDOW_DAYS = 30;

interface KeyDateRow {
  id: number;
  project_id: number;
  type_id: number | null;
  attachment_id: number | null;
  date: string;
  note: string | null;
  created_at: string;
  type_name: string | null;
  type_name_ar: string | null;
  attachment_name: string | null;
  attachment_mime: string | null;
  project_name: string | null;
}

const SELECT_KEY_DATES = `
  SELECT k.*, lv.name AS type_name, lv.name_ar AS type_name_ar, a.original_name AS attachment_name, a.mime AS attachment_mime,
    p.name AS project_name
  FROM key_dates k
  LEFT JOIN list_values lv ON lv.id = k.type_id
  LEFT JOIN attachments a ON a.id = k.attachment_id
  JOIN projects p ON p.id = k.project_id`;

/** Soonest first, ties broken by id. */
const ORDER_KEY_DATES = 'ORDER BY k.date ASC, k.id ASC';

function toKeyDate(row: KeyDateRow, today: ISODate): KeyDateRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    type: row.type_id === null ? null : { id: row.type_id, name: row.type_name!, nameAr: row.type_name_ar },
    date: row.date as ISODate,
    note: row.note,
    attachment: row.attachment_id === null
      ? null
      : { id: row.attachment_id, name: row.attachment_name!, mime: row.attachment_mime!, previewable: isPreviewable(row.attachment_mime!) },
    createdAt: row.created_at,
    state: expiryState(row.date as ISODate, today, KEY_DATE_WINDOW_DAYS)!,
  };
}

function getRow(db: DatabaseSync, id: number): KeyDateRow | undefined {
  return db.prepare(`${SELECT_KEY_DATES} WHERE k.id = ?`).get(id) as unknown as KeyDateRow | undefined;
}

export function getKeyDate(db: DatabaseSync, id: number, today: ISODate): KeyDateRecord | undefined {
  const row = getRow(db, id);
  return row ? toKeyDate(row, today) : undefined;
}

/** A project's key dates, soonest first. */
export function listKeyDates(db: DatabaseSync, projectId: number, today: ISODate): KeyDateRecord[] {
  const rows = db.prepare(`${SELECT_KEY_DATES} WHERE k.project_id = ? ${ORDER_KEY_DATES}`).all(projectId) as unknown as KeyDateRow[];
  return rows.map((row) => toKeyDate(row, today));
}

/**
 * Validates the type and attachment, when set: the type must be a `keyDateType` value, and the attachment must
 * belong to this same project (`error.unknownAttachment`). Nothing is saved.
 */
export function checkKeyDateRefs(
  db: DatabaseSync, projectId: number, data: { typeId?: number | null; attachmentId?: number | null },
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (data.typeId != null) {
    const type = db.prepare("SELECT id FROM list_values WHERE id = ? AND list = 'keyDateType'").get(data.typeId);
    if (!type) issues.push({ path: 'typeId', message: translate('en', 'error.unknownKeyDateType'), code: 'error.unknownKeyDateType' });
  }
  if (data.attachmentId != null) {
    const attachment = db.prepare('SELECT id FROM attachments WHERE id = ? AND project_id = ?').get(data.attachmentId, projectId);
    if (!attachment) issues.push({ path: 'attachmentId', message: translate('en', 'error.unknownAttachment'), code: 'error.unknownAttachment' });
  }
  return issues;
}

export function createKeyDate(db: DatabaseSync, projectId: number, data: KeyDateData, createdAt: string, today: ISODate): KeyDateRecord {
  const res = db
    .prepare('INSERT INTO key_dates (project_id, type_id, attachment_id, date, note, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(projectId, data.typeId, data.attachmentId, data.date, data.note, createdAt);
  return getKeyDate(db, Number(res.lastInsertRowid), today)!;
}

/** Changes every field: type, date, note and the file it is linked to. Returns undefined when it does not exist. */
export function updateKeyDate(db: DatabaseSync, id: number, data: KeyDateData, today: ISODate): KeyDateRecord | undefined {
  if (!getKeyDate(db, id, today)) return undefined;
  db.prepare('UPDATE key_dates SET type_id = ?, attachment_id = ?, date = ?, note = ? WHERE id = ?').run(
    data.typeId, data.attachmentId, data.date, data.note, id,
  );
  return getKeyDate(db, id, today);
}

export function deleteKeyDateRow(db: DatabaseSync, id: number): boolean {
  return Number(db.prepare('DELETE FROM key_dates WHERE id = ?').run(id).changes) > 0;
}

/**
 * Every key date, across every project, that has passed within the last 30 days or falls within `withinDays`
 * ahead, with its project's name; feeds GET /api/key-dates/upcoming and the dashboard notice. `state` is judged
 * against the fixed `KEY_DATE_WINDOW_DAYS` (like the card and every other key date), never against `withinDays`:
 * the list's own window only decides which dates are returned at all, not how urgent each one reads (review fix).
 */
export function listUpcomingKeyDates(db: DatabaseSync, today: ISODate, withinDays: number): UpcomingKeyDate[] {
  const from = addDays(today, -KEY_DATE_WINDOW_DAYS);
  const to = addDays(today, withinDays);
  const rows = db
    .prepare(`${SELECT_KEY_DATES} WHERE k.date >= ? AND k.date <= ? ${ORDER_KEY_DATES}`)
    .all(from, to) as unknown as KeyDateRow[];
  return rows.map((row) => ({
    id: row.id,
    project: { id: row.project_id, name: row.project_name! },
    type: row.type_id === null ? null : { id: row.type_id, name: row.type_name!, nameAr: row.type_name_ar },
    date: row.date as ISODate,
    state: expiryState(row.date as ISODate, today, KEY_DATE_WINDOW_DAYS)!,
  }));
}

/**
 * Replaces an attachment's whole set of key dates in one transaction (M7 review fix): a row with `id` is updated
 * only when that id is one of this attachment's own key dates (never another attachment's or project's — the id
 * is trusted only as far as it is found here), a row with no `id` is inserted, and any of the attachment's own key
 * dates left out of `items` is deleted. Every row is validated before anything is written, so an invalid row
 * changes nothing. Returns the saved list (soonest first) on success, `{ issues }` with nothing changed for an
 * invalid row, and undefined when the attachment itself does not exist.
 */
export function replaceAttachmentKeyDates(
  db: DatabaseSync, attachmentId: number, items: KeyDateItemData[], createdAt: string, today: ISODate,
): { issues: ValidationIssue[] } | { keyDates: KeyDateRecord[] } | undefined {
  const attachment = db.prepare('SELECT project_id FROM attachments WHERE id = ?').get(attachmentId) as { project_id: number } | undefined;
  if (!attachment) return undefined;
  const projectId = attachment.project_id;

  const ownIds = new Set(
    (db.prepare('SELECT id FROM key_dates WHERE attachment_id = ?').all(attachmentId) as { id: number }[]).map((r) => r.id),
  );

  const issues: ValidationIssue[] = [];
  items.forEach((item, i) => {
    for (const issue of checkKeyDateRefs(db, projectId, { typeId: item.typeId })) {
      issues.push({ ...issue, path: `${i}.${issue.path}` });
    }
    if (item.id !== undefined && !ownIds.has(item.id)) {
      issues.push({ path: `${i}.id`, message: translate('en', 'error.keyDateNotFound'), code: 'error.keyDateNotFound' });
    }
  });
  if (issues.length > 0) return { issues };

  return transaction(db, () => {
    const keptIds = new Set(items.map((item) => item.id).filter((id): id is number => id !== undefined));
    for (const id of ownIds) {
      if (!keptIds.has(id)) db.prepare('DELETE FROM key_dates WHERE id = ?').run(id);
    }
    for (const item of items) {
      if (item.id !== undefined) {
        db.prepare('UPDATE key_dates SET type_id = ?, date = ?, note = ? WHERE id = ?').run(item.typeId, item.date, item.note, item.id);
      } else {
        db.prepare('INSERT INTO key_dates (project_id, type_id, attachment_id, date, note, created_at) VALUES (?, ?, ?, ?, ?, ?)')
          .run(projectId, item.typeId, attachmentId, item.date, item.note, createdAt);
      }
    }
    const rows = db.prepare(`${SELECT_KEY_DATES} WHERE k.attachment_id = ? ${ORDER_KEY_DATES}`).all(attachmentId) as unknown as KeyDateRow[];
    return { keyDates: rows.map((row) => toKeyDate(row, today)) };
  });
}
