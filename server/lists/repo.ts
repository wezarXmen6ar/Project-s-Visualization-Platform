import type { DatabaseSync } from 'node:sqlite';
import { LIST_NAMES, type ListName, type ListValue, type Lists } from '../../shared/types';
import { transaction } from '../db';

interface ListRow {
  id: number;
  list: ListName;
  name: string;
  sort_order: number;
}

/**
 * How many projects use a list value. Most lists are referenced by id from a projects column. Phases store their
 * name on each project's phase rows, so a phase value is matched by name (ignoring case).
 */
const USAGE_SQL: Record<ListName, string> = {
  mainProject: 'SELECT COUNT(*) AS n FROM projects WHERE main_project_id = ?',
  projectType: 'SELECT COUNT(*) AS n FROM projects WHERE project_type_id = ?',
  goal: 'SELECT COUNT(*) AS n FROM projects WHERE goal_id = ?',
  department: 'SELECT COUNT(*) AS n FROM projects WHERE department_id = ?',
  phase: 'SELECT COUNT(DISTINCT project_id) AS n FROM phases WHERE name = ? COLLATE NOCASE',
};

export type ListChange = { ok: true; value?: ListValue } | { ok: false; status: 404 | 409; error: string };

function toValue(row: ListRow): ListValue {
  return { id: row.id, list: row.list, name: row.name, order: row.sort_order };
}

function findByName(db: DatabaseSync, list: ListName, name: string): ListRow | undefined {
  return db
    .prepare('SELECT * FROM list_values WHERE list = ? AND name = ? COLLATE NOCASE')
    .get(list, name) as unknown as ListRow | undefined;
}

export function isListName(value: string): value is ListName {
  return (LIST_NAMES as readonly string[]).includes(value);
}

export function getLists(db: DatabaseSync): Lists {
  const lists: Lists = { mainProject: [], projectType: [], goal: [], department: [], phase: [] };
  const rows = db.prepare('SELECT * FROM list_values ORDER BY sort_order, id').all() as unknown as ListRow[];
  for (const row of rows) lists[row.list].push(toValue(row));
  return lists;
}

export function getListValue(db: DatabaseSync, id: number): ListValue | undefined {
  const row = db.prepare('SELECT * FROM list_values WHERE id = ?').get(id) as unknown as ListRow | undefined;
  return row ? toValue(row) : undefined;
}

/** Adds a value at the end of a list, or returns the existing value with the same name (ignoring case). */
export function addListValue(db: DatabaseSync, list: ListName, name: string): { value: ListValue; created: boolean } {
  const existing = findByName(db, list, name);
  if (existing) return { value: toValue(existing), created: false };
  const { next } = db
    .prepare('SELECT COALESCE(MAX(sort_order) + 1, 0) AS next FROM list_values WHERE list = ?')
    .get(list) as unknown as { next: number };
  const res = db.prepare('INSERT INTO list_values (list, name, sort_order) VALUES (?, ?, ?)').run(list, name, next);
  return { value: getListValue(db, Number(res.lastInsertRowid))!, created: true };
}

export function renameListValue(db: DatabaseSync, list: ListName, id: number, name: string): ListChange {
  const current = getListValue(db, id);
  if (!current || current.list !== list) return { ok: false, status: 404, error: 'Value not found' };
  const clash = findByName(db, list, name);
  if (clash && clash.id !== id) return { ok: false, status: 409, error: `"${clash.name}" already exists` };
  transaction(db, () => {
    db.prepare('UPDATE list_values SET name = ? WHERE id = ?').run(name, id);
    // Phase names live on each project's phases, so a renamed phase is renamed there too.
    if (list === 'phase') db.prepare('UPDATE phases SET name = ? WHERE name = ? COLLATE NOCASE').run(name, current.name);
  });
  return { ok: true, value: getListValue(db, id) };
}

export function deleteListValue(db: DatabaseSync, list: ListName, id: number): ListChange {
  const current = getListValue(db, id);
  if (!current || current.list !== list) return { ok: false, status: 404, error: 'Value not found' };
  const { n } = db.prepare(USAGE_SQL[list]).get(list === 'phase' ? current.name : id) as unknown as { n: number };
  if (n > 0) return { ok: false, status: 409, error: `"${current.name}" is used by ${n} project${n === 1 ? '' : 's'}` };
  db.prepare('DELETE FROM list_values WHERE id = ?').run(id);
  return { ok: true };
}
