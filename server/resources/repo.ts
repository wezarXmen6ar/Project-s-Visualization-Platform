import type { DatabaseSync } from 'node:sqlite';
import type { LeaveData, ResourceData, ValidationIssue } from '../../shared/schemas';
import type { LeaveRecord, ResourceRecord, Side, Specialisation } from '../../shared/types';
import { getListValue } from '../lists/repo';

interface ResourceRow {
  id: number;
  name: string;
  side: Side;
  role_id: number | null;
  specialisation: Specialisation | null;
  email: string | null;
  phone: string | null;
  capacity: number;
  active: number;
}

interface LeaveRow {
  id: number;
  resource_id: number;
  start_date: string;
  end_date: string;
  note: string | null;
}

/** Columns written from ResourceData, in the same order as resourceValues(). */
const COLUMNS = ['name', 'side', 'role_id', 'specialisation', 'email', 'phone', 'capacity', 'active'];

function resourceValues(r: ResourceData) {
  return [r.name, r.side, r.roleId, r.specialisation, r.email, r.phone, r.capacity, r.active ? 1 : 0];
}

/**
 * What still points at a person, each with the reason shown when deleting is refused. A person in use can be made
 * inactive but not deleted, so history keeps their name. Later features add their own entries here.
 */
const USAGE: { sql: string; reason: (n: number) => string }[] = [
  {
    sql: 'SELECT COUNT(*) AS n FROM projects WHERE ? IN (project_manager_id, business_pm_id)',
    reason: (n) => `they are a project manager on ${n} project${n === 1 ? '' : 's'}`,
  },
  {
    sql: 'SELECT COUNT(*) AS n FROM assignments WHERE resource_id = ?',
    reason: (n) => `they are assigned to ${n} phase${n === 1 ? '' : 's'}`,
  },
];

function toLeave(row: LeaveRow): LeaveRecord {
  return { id: row.id, start: row.start_date, end: row.end_date, note: row.note };
}

function roleNames(db: DatabaseSync): Map<number, string> {
  const rows = db.prepare("SELECT id, name FROM list_values WHERE list = 'role'").all() as unknown as { id: number; name: string }[];
  return new Map(rows.map((r) => [r.id, r.name]));
}

function toResource(row: ResourceRow, roles: Map<number, string>, leave: LeaveRecord[]): ResourceRecord {
  const roleName = row.role_id === null ? undefined : roles.get(row.role_id);
  return {
    id: row.id,
    name: row.name,
    side: row.side,
    role: row.role_id !== null && roleName !== undefined ? { id: row.role_id, name: roleName } : null,
    specialisation: row.specialisation,
    email: row.email,
    phone: row.phone,
    capacity: row.capacity,
    active: row.active === 1,
    leave,
  };
}

/** The tech team first, then business contacts, each by name (ignoring case). */
export function listResources(db: DatabaseSync): ResourceRecord[] {
  const rows = db
    .prepare("SELECT * FROM resources ORDER BY CASE side WHEN 'tech' THEN 0 ELSE 1 END, name COLLATE NOCASE, id")
    .all() as unknown as ResourceRow[];
  const leave = new Map<number, LeaveRecord[]>();
  for (const l of db.prepare('SELECT * FROM leave ORDER BY start_date, id').all() as unknown as LeaveRow[]) {
    leave.set(l.resource_id, [...(leave.get(l.resource_id) ?? []), toLeave(l)]);
  }
  const roles = roleNames(db);
  return rows.map((r) => toResource(r, roles, leave.get(r.id) ?? []));
}

export function getResource(db: DatabaseSync, id: number): ResourceRecord | undefined {
  const row = db.prepare('SELECT * FROM resources WHERE id = ?').get(id) as unknown as ResourceRow | undefined;
  if (!row) return undefined;
  const leave = (db.prepare('SELECT * FROM leave WHERE resource_id = ? ORDER BY start_date, id').all(id) as unknown as LeaveRow[])
    .map(toLeave);
  return toResource(row, roleNames(db), leave);
}

/** A chosen role must exist in the role list. */
export function checkResourceRefs(db: DatabaseSync, r: ResourceData): ValidationIssue[] {
  if (r.roleId !== null && getListValue(db, r.roleId)?.list !== 'role') return [{ path: 'roleId', message: 'Unknown role' }];
  return [];
}

export function createResource(db: DatabaseSync, r: ResourceData): ResourceRecord {
  const res = db
    .prepare(`INSERT INTO resources (${COLUMNS.join(', ')}) VALUES (${COLUMNS.map(() => '?').join(', ')})`)
    .run(...resourceValues(r));
  return getResource(db, Number(res.lastInsertRowid))!;
}

/** Returns undefined when the person does not exist. */
export function updateResource(db: DatabaseSync, id: number, r: ResourceData): ResourceRecord | undefined {
  const res = db
    .prepare(`UPDATE resources SET ${COLUMNS.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`)
    .run(...resourceValues(r), id);
  return Number(res.changes) === 0 ? undefined : getResource(db, id);
}

export type ResourceDelete = { ok: true } | { ok: false; status: 404 | 409; error: string };

export function deleteResource(db: DatabaseSync, id: number): ResourceDelete {
  const person = getResource(db, id);
  if (!person) return { ok: false, status: 404, error: 'Person not found' };
  const reasons = USAGE.flatMap(({ sql, reason }) => {
    const { n } = db.prepare(sql).get(id) as unknown as { n: number };
    return n > 0 ? [reason(n)] : [];
  });
  if (reasons.length > 0) {
    return { ok: false, status: 409, error: `${person.name} can't be deleted because ${reasons.join(' and ')}. Make them inactive instead.` };
  }
  db.prepare('DELETE FROM resources WHERE id = ?').run(id);
  return { ok: true };
}

/** Returns undefined when the person does not exist. */
export function addLeave(db: DatabaseSync, resourceId: number, l: LeaveData): LeaveRecord | undefined {
  if (!db.prepare('SELECT id FROM resources WHERE id = ?').get(resourceId)) return undefined;
  const res = db
    .prepare('INSERT INTO leave (resource_id, start_date, end_date, note) VALUES (?, ?, ?, ?)')
    .run(resourceId, l.start, l.end, l.note);
  return toLeave(db.prepare('SELECT * FROM leave WHERE id = ?').get(Number(res.lastInsertRowid)) as unknown as LeaveRow);
}

/** Returns false when there was no such leave. */
export function deleteLeave(db: DatabaseSync, id: number): boolean {
  return Number(db.prepare('DELETE FROM leave WHERE id = ?').run(id).changes) > 0;
}
