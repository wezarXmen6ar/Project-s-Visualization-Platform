import type { DatabaseSync } from 'node:sqlite';
import type { ISODate } from '../../shared/calendar';
import { translate } from '../../shared/i18n/translate';
import type { Params } from '../../shared/i18n/types';
import type { ToDoData, ValidationIssue } from '../../shared/schemas';
import type { ToDoRecord } from '../../shared/types';
import { getMe } from '../settings';

interface ToDoRow {
  id: number;
  project_id: number;
  project_name: string;
  title: string;
  note: string | null;
  assignee_id: number | null;
  assignee_name: string | null;
  due_date: string | null;
  phase_id: number | null;
  phase_name: string | null;
  phase_top_name: string | null;
  phase_sub_name: string | null;
  done_date: string | null;
  former_phase: string | null;
  former_phase_top: string | null;
  former_phase_sub: string | null;
  former_phase_removed_on: string | null;
  created_at: string;
  source_entry_id: number | null;
  source_entry_title: string | null;
  source_entry_date: string | null;
}

const SELECT_TODOS = `
  SELECT t.*, pr.name AS project_name, r.name AS assignee_name,
    CASE WHEN parent.id IS NULL THEN p.name ELSE parent.name || ' › ' || p.name END AS phase_name,
    COALESCE(parent.name, p.name) AS phase_top_name,
    CASE WHEN parent.id IS NULL THEN NULL ELSE p.name END AS phase_sub_name,
    se.title AS source_entry_title, se.effective_date AS source_entry_date
  FROM todos t
  JOIN projects pr ON pr.id = t.project_id
  LEFT JOIN resources r ON r.id = t.assignee_id
  LEFT JOIN phases p ON p.id = t.phase_id
  LEFT JOIN phases parent ON parent.id = p.parent_id
  LEFT JOIN entries se ON se.id = t.source_entry_id`;

/**
 * Open before done; open ones by due date (undated last), ties by id; done ones by done date, newest first, with a
 * same-day tie broken by id descending.
 */
const ORDER_TODOS = `
  ORDER BY
    (t.done_date IS NOT NULL) ASC,
    CASE WHEN t.done_date IS NULL THEN (t.due_date IS NULL) END ASC,
    CASE WHEN t.done_date IS NULL THEN t.due_date END ASC,
    CASE WHEN t.done_date IS NULL THEN t.id END ASC,
    CASE WHEN t.done_date IS NOT NULL THEN t.done_date END DESC,
    t.id DESC`;

function toToDo(row: ToDoRow): ToDoRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    projectName: row.project_name,
    title: row.title,
    note: row.note,
    assignee: row.assignee_id === null ? null : { id: row.assignee_id, name: row.assignee_name! },
    dueDate: row.due_date,
    done: row.done_date !== null,
    doneDate: row.done_date,
    phase:
      row.phase_id === null
        ? null
        : { id: row.phase_id, name: row.phase_name!, phaseName: row.phase_top_name!, subPhaseName: row.phase_sub_name },
    formerPhase:
      row.former_phase === null
        ? null
        : {
          name: row.former_phase,
          phaseName: row.former_phase_top ?? row.former_phase,
          subPhaseName: row.former_phase_sub,
          removedOn: row.former_phase_removed_on!,
        },
    sourceEntry:
      row.source_entry_id === null
        ? null
        : { id: row.source_entry_id, title: row.source_entry_title!, effectiveDate: row.source_entry_date! as ISODate },
    createdAt: row.created_at,
  };
}

export interface ToDoFilter {
  projectId?: number;
  assigneeId?: number;
  includeDone?: boolean;
  /** When set, only to-dos with a former phase (kept from a removed phase) are returned. */
  fromRemovedPhases?: boolean;
}

export function listToDos(db: DatabaseSync, filter: ToDoFilter = {}): ToDoRecord[] {
  const clauses: string[] = [];
  const params: number[] = [];
  if (filter.projectId !== undefined) {
    clauses.push('t.project_id = ?');
    params.push(filter.projectId);
  }
  if (filter.assigneeId !== undefined) {
    clauses.push('t.assignee_id = ?');
    params.push(filter.assigneeId);
  }
  if (!filter.includeDone) clauses.push('t.done_date IS NULL');
  if (filter.fromRemovedPhases) clauses.push('t.former_phase IS NOT NULL');
  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db.prepare(`${SELECT_TODOS} ${where} ${ORDER_TODOS}`).all(...params) as unknown as ToDoRow[];
  return rows.map(toToDo);
}

export function getToDo(db: DatabaseSync, id: number): ToDoRecord | undefined {
  const row = db.prepare(`${SELECT_TODOS} WHERE t.id = ?`).get(id) as unknown as ToDoRow | undefined;
  return row ? toToDo(row) : undefined;
}

/** The people a to-do on this project may be assigned to: its tech and business PM, anyone on any of its phases, and "I am". */
export function projectPeopleIds(db: DatabaseSync, projectId: number): Set<number> {
  const ids = new Set<number>();
  const project = db.prepare('SELECT project_manager_id, business_pm_id FROM projects WHERE id = ?').get(projectId) as unknown as
    | { project_manager_id: number | null; business_pm_id: number | null }
    | undefined;
  if (project) {
    if (project.project_manager_id !== null) ids.add(project.project_manager_id);
    if (project.business_pm_id !== null) ids.add(project.business_pm_id);
  }
  const assigned = db
    .prepare('SELECT DISTINCT a.resource_id FROM assignments a JOIN phases p ON p.id = a.phase_id WHERE p.project_id = ?')
    .all(projectId) as unknown as { resource_id: number }[];
  for (const { resource_id } of assigned) ids.add(resource_id);
  const me = getMe(db);
  if (me.resourceId !== null) ids.add(me.resourceId);
  return ids;
}

/**
 * Validates an assignee and a phase for a to-do on `projectId`. An update that keeps the same assignee as `existing`
 * is not checked, so someone who has left the project keeps their to-dos.
 */
export function checkToDo(db: DatabaseSync, projectId: number, data: ToDoData, existing?: ToDoRecord): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (data.assigneeId !== null && data.assigneeId !== existing?.assignee?.id) {
    const person = db.prepare('SELECT name FROM resources WHERE id = ?').get(data.assigneeId) as unknown as { name: string } | undefined;
    if (!person) issues.push({ path: 'assigneeId', message: translate('en', 'error.unknownPerson'), code: 'error.unknownPerson' });
    else if (!projectPeopleIds(db, projectId).has(data.assigneeId)) {
      const params: Params = { name: person.name };
      issues.push({
        path: 'assigneeId', message: translate('en', 'error.personNotOnProject', params), code: 'error.personNotOnProject', params,
      });
    }
  }
  if (data.phaseId !== null) {
    const phase = db.prepare('SELECT id FROM phases WHERE id = ? AND project_id = ?').get(data.phaseId, projectId);
    if (!phase) issues.push({ path: 'phaseId', message: translate('en', 'error.unknownPhase'), code: 'error.unknownPhase' });
  }
  return issues;
}

export function createToDo(db: DatabaseSync, projectId: number, data: ToDoData, today: ISODate): ToDoRecord {
  const doneDate = data.done ? today : null;
  const res = db
    .prepare(
      `INSERT INTO todos (project_id, title, note, assignee_id, due_date, phase_id, done_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(projectId, data.title, data.note, data.assigneeId, data.dueDate, data.phaseId, doneDate, new Date().toISOString());
  return getToDo(db, Number(res.lastInsertRowid))!;
}

/**
 * Returns undefined when there is no such to-do. `done: true` on an open to-do sets doneDate to today; on one already
 * done it keeps its date; `done: false` clears it. Setting a phaseId (relinking) clears the former-phase note.
 */
export function updateToDo(db: DatabaseSync, id: number, data: ToDoData, today: ISODate): ToDoRecord | undefined {
  const existing = getToDo(db, id);
  if (!existing) return undefined;
  const doneDate = data.done ? (existing.done ? existing.doneDate : today) : null;
  const clearFormer = data.phaseId !== null;
  db.prepare(
    `UPDATE todos SET title = ?, note = ?, assignee_id = ?, due_date = ?, phase_id = ?, done_date = ?${
      clearFormer ? ', former_phase = NULL, former_phase_top = NULL, former_phase_sub = NULL, former_phase_removed_on = NULL' : ''
    } WHERE id = ?`,
  ).run(data.title, data.note, data.assigneeId, data.dueDate, data.phaseId, doneDate, id);
  return getToDo(db, id);
}

export function deleteToDo(db: DatabaseSync, id: number): boolean {
  return Number(db.prepare('DELETE FROM todos WHERE id = ?').run(id).changes) > 0;
}

/**
 * Handles the to-dos of phases that are about to be removed (call before deleting the phase rows, inside the same
 * transaction). Done to-dos are always deleted. Open ones are deleted when `removedToDos` is 'delete'; otherwise they
 * are unlinked and remember the removed phase, via `labelFor` (built from names read before this save): its phase
 * name and, for a sub-phase, its own name. The joined "Phase › Sub-phase" text is kept too.
 */
export function handleRemovedPhaseToDos(
  db: DatabaseSync,
  removedPhaseIds: number[],
  removedToDos: 'keep' | 'delete',
  today: ISODate,
  labelFor: (phaseId: number) => { phaseName: string; subPhaseName: string | null },
): void {
  if (removedPhaseIds.length === 0) return;
  const placeholders = removedPhaseIds.map(() => '?').join(', ');
  const rows = db
    .prepare(`SELECT id, phase_id, done_date FROM todos WHERE phase_id IN (${placeholders})`)
    .all(...removedPhaseIds) as unknown as { id: number; phase_id: number; done_date: string | null }[];
  const del = db.prepare('DELETE FROM todos WHERE id = ?');
  const keep = db.prepare(
    `UPDATE todos SET phase_id = NULL, former_phase = ?, former_phase_top = ?, former_phase_sub = ?, former_phase_removed_on = ?
     WHERE id = ?`,
  );
  for (const row of rows) {
    if (row.done_date !== null || removedToDos === 'delete') del.run(row.id);
    else {
      const { phaseName, subPhaseName } = labelFor(row.phase_id);
      const joined = subPhaseName === null ? phaseName : `${phaseName} › ${subPhaseName}`;
      keep.run(joined, phaseName, subPhaseName, today, row.id);
    }
  }
}
