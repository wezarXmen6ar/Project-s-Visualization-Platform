import type { DatabaseSync } from 'node:sqlite';
import type { MessageKey } from '../../shared/i18n/en';
import { translate } from '../../shared/i18n/translate';
import type { Params } from '../../shared/i18n/types';
import { LIST_NAMES, type ListName, type ListValue, type Lists } from '../../shared/types';
import { transaction } from '../db';

interface ListRow {
  id: number;
  list: ListName;
  name: string;
  name_ar: string | null;
  sort_order: number;
}

/**
 * How many things use a list value, and the message key for the "in use" message (its own plural forms cover
 * "project"/"projects" or "person"/"people"). Most lists are referenced by id from a projects column. Phases store
 * their name on each project's phase rows, so a phase value is matched by name (ignoring case). Roles are used by
 * people.
 */
const USAGE: Record<ListName, { sql: string; key: MessageKey }> = {
  mainProject: { sql: 'SELECT COUNT(*) AS n FROM projects WHERE main_project_id = ?', key: 'error.listValueInUseProjects' },
  projectType: { sql: 'SELECT COUNT(*) AS n FROM projects WHERE project_type_id = ?', key: 'error.listValueInUseProjects' },
  goal: { sql: 'SELECT COUNT(*) AS n FROM projects WHERE goal_id = ?', key: 'error.listValueInUseProjects' },
  department: { sql: 'SELECT COUNT(*) AS n FROM projects WHERE department_id = ?', key: 'error.listValueInUseProjects' },
  phase: {
    sql: 'SELECT COUNT(DISTINCT project_id) AS n FROM phases WHERE parent_id IS NULL AND name = ? COLLATE NOCASE',
    key: 'error.listValueInUseProjects',
  },
  role: { sql: 'SELECT COUNT(*) AS n FROM resources WHERE role_id = ?', key: 'error.listValueInUsePeople' },
  attachmentType: { sql: 'SELECT COUNT(*) AS n FROM attachments WHERE type_id = ?', key: 'error.listValueInUseAttachments' },
};

export type ListChange =
  | { ok: true; value?: ListValue }
  | { ok: false; status: 404 | 409; error: string; code?: MessageKey; params?: Params };

function toValue(row: ListRow): ListValue {
  return { id: row.id, list: row.list, name: row.name, nameAr: row.name_ar, order: row.sort_order };
}

function findByName(db: DatabaseSync, list: ListName, name: string): ListRow | undefined {
  return db
    .prepare('SELECT * FROM list_values WHERE list = ? AND name = ? COLLATE NOCASE')
    .get(list, name) as unknown as ListRow | undefined;
}

/** All USAGE entries share the same params shape: `{ name, count }`. */
function inUse(current: { name: string }, key: MessageKey, count: number): ListChange {
  const params: Params = { name: current.name, count };
  return { ok: false, status: 409, error: translate('en', key, params), code: key, params };
}

export function isListName(value: string): value is ListName {
  return (LIST_NAMES as readonly string[]).includes(value);
}

export function getLists(db: DatabaseSync): Lists {
  const lists: Lists = { mainProject: [], projectType: [], goal: [], department: [], phase: [], role: [], attachmentType: [] };
  const rows = db.prepare('SELECT * FROM list_values ORDER BY sort_order, id').all() as unknown as ListRow[];
  for (const row of rows) lists[row.list].push(toValue(row));
  return lists;
}

export function getListValue(db: DatabaseSync, id: number): ListValue | undefined {
  const row = db.prepare('SELECT * FROM list_values WHERE id = ?').get(id) as unknown as ListRow | undefined;
  return row ? toValue(row) : undefined;
}

/**
 * Adds a value at the end of a list, or returns the existing value with the same name (ignoring case). `nameAr`
 * is null when not given, e.g. an "Other…" value added from a dropdown.
 */
export function addListValue(
  db: DatabaseSync, list: ListName, name: string, nameAr: string | null = null,
): { value: ListValue; created: boolean } {
  const existing = findByName(db, list, name);
  if (existing) return { value: toValue(existing), created: false };
  const { next } = db
    .prepare('SELECT COALESCE(MAX(sort_order) + 1, 0) AS next FROM list_values WHERE list = ?')
    .get(list) as unknown as { next: number };
  const res = db
    .prepare('INSERT INTO list_values (list, name, name_ar, sort_order) VALUES (?, ?, ?, ?)')
    .run(list, name, nameAr, next);
  return { value: getListValue(db, Number(res.lastInsertRowid))!, created: true };
}

/** `nameAr` undefined keeps the value's current Arabic name; null clears it; a string replaces it. */
export function renameListValue(db: DatabaseSync, list: ListName, id: number, name: string, nameAr?: string | null): ListChange {
  const current = getListValue(db, id);
  if (!current || current.list !== list) {
    return { ok: false, status: 404, error: translate('en', 'error.listValueNotFound'), code: 'error.listValueNotFound' };
  }
  const clash = findByName(db, list, name);
  if (clash && clash.id !== id) {
    const params: Params = { name: clash.name };
    return { ok: false, status: 409, error: translate('en', 'error.listValueExists', params), code: 'error.listValueExists', params };
  }
  const nextNameAr = nameAr === undefined ? current.nameAr : nameAr;
  transaction(db, () => {
    db.prepare('UPDATE list_values SET name = ?, name_ar = ? WHERE id = ?').run(name, nextNameAr, id);
    // Phase names live on each project's phases, so a renamed phase is renamed there too.
    if (list === 'phase') {
      db.prepare('UPDATE phases SET name = ? WHERE parent_id IS NULL AND name = ? COLLATE NOCASE').run(name, current.name);
    }
  });
  return { ok: true, value: getListValue(db, id) };
}

export function deleteListValue(db: DatabaseSync, list: ListName, id: number): ListChange {
  const current = getListValue(db, id);
  if (!current || current.list !== list) {
    return { ok: false, status: 404, error: translate('en', 'error.listValueNotFound'), code: 'error.listValueNotFound' };
  }
  const usage = USAGE[list];
  const { n } = db.prepare(usage.sql).get(list === 'phase' ? current.name : id) as unknown as { n: number };
  if (n > 0) return inUse(current, usage.key, n);
  if (list === 'phase') {
    const { n: starters } = db.prepare('SELECT COUNT(*) AS n FROM starter_todos WHERE phase_list_id = ?').get(id) as unknown as {
      n: number;
    };
    if (starters > 0) return inUse(current, 'error.phaseHasStarters', starters);
  }
  db.prepare('DELETE FROM list_values WHERE id = ?').run(id);
  return { ok: true };
}
