import type { DatabaseSync } from 'node:sqlite';
import type { ISODate } from '../../shared/calendar';
import { translate } from '../../shared/i18n/translate';
import type { Params } from '../../shared/i18n/types';
import type { EntryData, ValidationIssue } from '../../shared/schemas';
import type { EntryRecord, EntryType, Ref } from '../../shared/types';
import { transaction } from '../db';
import { PHASE_JOIN_SQL, PHASE_NAME_COLUMNS_SQL, phaseRefFromRow } from '../phaseRef';
import { projectPeopleIds } from '../todos/repo';

interface EntryRow {
  id: number;
  project_id: number;
  phase_id: number | null;
  type: EntryType;
  effective_date: string;
  created_at: string;
  title: string;
  body: string;
  highlight: number;
  phase_name: string | null;
  phase_top_name: string | null;
  phase_sub_name: string | null;
}

const SELECT_ENTRIES = `
  SELECT e.*,${PHASE_NAME_COLUMNS_SQL}
  FROM entries e
  LEFT JOIN phases p ON p.id = e.phase_id
  ${PHASE_JOIN_SQL}`;

/** Newest effective_date first, ties broken by id descending. */
const ORDER_ENTRIES = 'ORDER BY e.effective_date DESC, e.id DESC';

function attendeesByEntry(db: DatabaseSync, entryIds: number[]): Map<number, Ref[]> {
  const map = new Map<number, Ref[]>();
  if (entryIds.length === 0) return map;
  const placeholders = entryIds.map(() => '?').join(', ');
  const rows = db
    .prepare(
      `SELECT ea.entry_id, r.id, r.name FROM entry_attendees ea JOIN resources r ON r.id = ea.resource_id
       WHERE ea.entry_id IN (${placeholders}) ORDER BY r.name COLLATE NOCASE`,
    )
    .all(...entryIds) as unknown as { entry_id: number; id: number; name: string }[];
  for (const row of rows) {
    const list = map.get(row.entry_id) ?? [];
    list.push({ id: row.id, name: row.name });
    map.set(row.entry_id, list);
  }
  return map;
}

function guestsByEntry(db: DatabaseSync, entryIds: number[]): Map<number, string[]> {
  const map = new Map<number, string[]>();
  if (entryIds.length === 0) return map;
  const placeholders = entryIds.map(() => '?').join(', ');
  const rows = db
    .prepare(
      `SELECT entry_id, name FROM entry_guests WHERE entry_id IN (${placeholders}) ORDER BY entry_id, sort_order`,
    )
    .all(...entryIds) as unknown as { entry_id: number; name: string }[];
  for (const row of rows) {
    const list = map.get(row.entry_id) ?? [];
    list.push(row.name);
    map.set(row.entry_id, list);
  }
  return map;
}

function followUpIdsByEntry(db: DatabaseSync, entryIds: number[]): Map<number, number[]> {
  const map = new Map<number, number[]>();
  if (entryIds.length === 0) return map;
  const placeholders = entryIds.map(() => '?').join(', ');
  const rows = db
    .prepare(`SELECT id, source_entry_id FROM todos WHERE source_entry_id IN (${placeholders}) ORDER BY id`)
    .all(...entryIds) as unknown as { id: number; source_entry_id: number }[];
  for (const row of rows) {
    const list = map.get(row.source_entry_id) ?? [];
    list.push(row.id);
    map.set(row.source_entry_id, list);
  }
  return map;
}

function attachmentIdsByEntry(db: DatabaseSync, entryIds: number[]): Map<number, number[]> {
  const map = new Map<number, number[]>();
  if (entryIds.length === 0) return map;
  const placeholders = entryIds.map(() => '?').join(', ');
  const rows = db
    .prepare(`SELECT id, entry_id FROM attachments WHERE entry_id IN (${placeholders}) ORDER BY id`)
    .all(...entryIds) as unknown as { id: number; entry_id: number }[];
  for (const row of rows) {
    const list = map.get(row.entry_id) ?? [];
    list.push(row.id);
    map.set(row.entry_id, list);
  }
  return map;
}

function toEntry(
  row: EntryRow, attendees: Ref[], guests: string[], followUpToDoIds: number[], attachmentIds: number[],
): EntryRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    type: row.type,
    effectiveDate: row.effective_date as ISODate,
    createdAt: row.created_at,
    title: row.title,
    body: row.body,
    highlight: row.highlight === 1,
    phase: phaseRefFromRow(row),
    attendees,
    guests,
    attachmentIds,
    followUpToDoIds,
  };
}

export function getEntry(db: DatabaseSync, id: number): EntryRecord | undefined {
  const row = db.prepare(`${SELECT_ENTRIES} WHERE e.id = ?`).get(id) as unknown as EntryRow | undefined;
  if (!row) return undefined;
  const attendees = attendeesByEntry(db, [id]).get(id) ?? [];
  const guests = guestsByEntry(db, [id]).get(id) ?? [];
  const followUpToDoIds = followUpIdsByEntry(db, [id]).get(id) ?? [];
  const attachmentIds = attachmentIdsByEntry(db, [id]).get(id) ?? [];
  return toEntry(row, attendees, guests, followUpToDoIds, attachmentIds);
}

export interface EntryFilter {
  /** When set, entries of this phase and, when it is a top-level phase, its sub-phases too. */
  phaseId?: number;
}

/** Returns [] for an unknown phase filter (the route 404s on a missing project before calling this). */
export function listEntries(db: DatabaseSync, projectId: number, filter: EntryFilter = {}): EntryRecord[] {
  let phaseIds: number[] | undefined;
  if (filter.phaseId !== undefined) {
    const phase = db.prepare('SELECT id, parent_id FROM phases WHERE id = ? AND project_id = ?').get(filter.phaseId, projectId) as unknown as
      | { id: number; parent_id: number | null }
      | undefined;
    if (!phase) return [];
    if (phase.parent_id === null) {
      const subs = db.prepare('SELECT id FROM phases WHERE parent_id = ?').all(phase.id) as unknown as { id: number }[];
      phaseIds = [phase.id, ...subs.map((s) => s.id)];
    } else {
      phaseIds = [phase.id];
    }
  }
  const where = phaseIds ? `AND e.phase_id IN (${phaseIds.map(() => '?').join(', ')})` : '';
  const rows = db
    .prepare(`${SELECT_ENTRIES} WHERE e.project_id = ? ${where} ${ORDER_ENTRIES}`)
    .all(projectId, ...(phaseIds ?? [])) as unknown as EntryRow[];
  const ids = rows.map((r) => r.id);
  const attendees = attendeesByEntry(db, ids);
  const guests = guestsByEntry(db, ids);
  const followUps = followUpIdsByEntry(db, ids);
  const attachments = attachmentIdsByEntry(db, ids);
  return rows.map((r) =>
    toEntry(r, attendees.get(r.id) ?? [], guests.get(r.id) ?? [], followUps.get(r.id) ?? [], attachments.get(r.id) ?? []),
  );
}

/**
 * Validates a phase (belongs to the project, top-level or sub-phase), attendees (meetings only, each an existing
 * person) and, unless `skipFollowUps` is set, follow-ups (the assignee rule from `checkToDo`: on the project, or
 * "I am"). Pass `skipFollowUps: true` on an update, since `updateEntry` ignores `followUps`. Nothing is saved.
 */
export function checkEntry(
  db: DatabaseSync, projectId: number, data: EntryData, options: { skipFollowUps?: boolean } = {},
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (data.phaseId !== null) {
    const phase = db.prepare('SELECT id FROM phases WHERE id = ? AND project_id = ?').get(data.phaseId, projectId);
    if (!phase) issues.push({ path: 'phaseId', message: translate('en', 'error.unknownPhase'), code: 'error.unknownPhase' });
  }
  if (data.type === 'update' && (data.attendeeIds.length > 0 || data.guestNames.length > 0)) {
    issues.push({
      path: 'attendeeIds', message: translate('en', 'validation.updateHasAttendees'), code: 'validation.updateHasAttendees',
    });
  } else {
    const seen = new Set<number>();
    data.attendeeIds.forEach((id, i) => {
      if (seen.has(id)) return;
      seen.add(id);
      const person = db.prepare('SELECT id FROM resources WHERE id = ?').get(id);
      if (!person) issues.push({ path: `attendeeIds.${i}`, message: translate('en', 'error.unknownPerson'), code: 'error.unknownPerson' });
    });
  }
  const seenAttachments = new Set<number>();
  data.attachmentIds.forEach((attachmentId, i) => {
    if (seenAttachments.has(attachmentId)) return;
    seenAttachments.add(attachmentId);
    const attachment = db.prepare('SELECT project_id FROM attachments WHERE id = ?').get(attachmentId) as unknown as
      | { project_id: number }
      | undefined;
    if (!attachment || attachment.project_id !== projectId) {
      issues.push({ path: `attachmentIds.${i}`, message: translate('en', 'error.unknownAttachment'), code: 'error.unknownAttachment' });
    }
  });
  if (!options.skipFollowUps) data.followUps.forEach((f, i) => {
    if (f.assigneeId === null) return;
    const person = db.prepare('SELECT name FROM resources WHERE id = ?').get(f.assigneeId) as unknown as { name: string } | undefined;
    if (!person) {
      issues.push({ path: `followUps.${i}.assigneeId`, message: translate('en', 'error.unknownPerson'), code: 'error.unknownPerson' });
    } else if (!projectPeopleIds(db, projectId).has(f.assigneeId)) {
      const params: Params = { name: person.name };
      issues.push({
        path: `followUps.${i}.assigneeId`, message: translate('en', 'error.personNotOnProject', params),
        code: 'error.personNotOnProject', params,
      });
    }
  });
  return issues;
}

/** Creates the entry, its attendees and its follow-up to-dos (each with source_entry_id) in one transaction. */
export function createEntry(db: DatabaseSync, projectId: number, data: EntryData): EntryRecord {
  return transaction(db, () => {
    const now = new Date().toISOString();
    const res = db
      .prepare(
        `INSERT INTO entries (project_id, phase_id, type, effective_date, created_at, title, body, highlight)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(projectId, data.phaseId, data.type, data.effectiveDate, now, data.title, data.body, data.highlight ? 1 : 0);
    const entryId = Number(res.lastInsertRowid);

    const insertAttendee = db.prepare('INSERT INTO entry_attendees (entry_id, resource_id) VALUES (?, ?)');
    for (const resourceId of new Set(data.attendeeIds)) insertAttendee.run(entryId, resourceId);

    const insertGuest = db.prepare('INSERT INTO entry_guests (entry_id, name, sort_order) VALUES (?, ?, ?)');
    data.guestNames.forEach((name, i) => insertGuest.run(entryId, name, i));

    const insertFollowUp = db.prepare(
      'INSERT INTO todos (project_id, title, assignee_id, due_date, created_at, source_entry_id) VALUES (?, ?, ?, ?, ?, ?)',
    );
    for (const f of data.followUps) insertFollowUp.run(projectId, f.title, f.assigneeId, f.dueDate, new Date().toISOString(), entryId);

    const linkAttachment = db.prepare('UPDATE attachments SET entry_id = ? WHERE id = ? AND project_id = ?');
    for (const attachmentId of new Set(data.attachmentIds)) linkAttachment.run(entryId, attachmentId, projectId);

    return getEntry(db, entryId)!;
  });
}

/**
 * Updates the fields, the attendees (replaced) and the phase. `followUps` is ignored. Attachments in
 * `attachmentIds` are linked to the entry; attachments that were linked but are no longer listed are unlinked
 * (their `entry_id` is cleared), never deleted.
 */
export function updateEntry(db: DatabaseSync, id: number, data: EntryData): EntryRecord | undefined {
  const existing = getEntry(db, id);
  if (!existing) return undefined;
  return transaction(db, () => {
    db.prepare('UPDATE entries SET phase_id = ?, type = ?, effective_date = ?, title = ?, body = ?, highlight = ? WHERE id = ?').run(
      data.phaseId, data.type, data.effectiveDate, data.title, data.body, data.highlight ? 1 : 0, id,
    );
    db.prepare('DELETE FROM entry_attendees WHERE entry_id = ?').run(id);
    const insertAttendee = db.prepare('INSERT INTO entry_attendees (entry_id, resource_id) VALUES (?, ?)');
    for (const resourceId of new Set(data.attendeeIds)) insertAttendee.run(id, resourceId);

    db.prepare('DELETE FROM entry_guests WHERE entry_id = ?').run(id);
    const insertGuest = db.prepare('INSERT INTO entry_guests (entry_id, name, sort_order) VALUES (?, ?, ?)');
    data.guestNames.forEach((name, i) => insertGuest.run(id, name, i));

    db.prepare('UPDATE attachments SET entry_id = NULL WHERE entry_id = ?').run(id);
    const linkAttachment = db.prepare('UPDATE attachments SET entry_id = ? WHERE id = ? AND project_id = ?');
    for (const attachmentId of new Set(data.attachmentIds)) linkAttachment.run(id, attachmentId, existing.projectId);

    return getEntry(db, id);
  });
}

/** Its to-dos are left with source_entry_id null through ON DELETE SET NULL. */
export function deleteEntry(db: DatabaseSync, id: number): boolean {
  return Number(db.prepare('DELETE FROM entries WHERE id = ?').run(id).changes) > 0;
}
