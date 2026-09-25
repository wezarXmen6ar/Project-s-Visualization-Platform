import type { DatabaseSync } from 'node:sqlite';
import type { ISODate } from '../../shared/calendar';
import type { StarterToDoData, ValidationIssue } from '../../shared/schemas';
import type { StarterSuggestion, StarterToDo, ToDoRecord } from '../../shared/types';
import { transaction } from '../db';
import { getMe } from '../settings';
import { createToDo } from '../todos/repo';

interface StarterRow {
  id: number;
  phase_list_id: number;
  title: string;
  sort_order: number;
}

function toStarterToDo(row: StarterRow): StarterToDo {
  return { id: row.id, phaseListId: row.phase_list_id, title: row.title, order: row.sort_order };
}

/** All starter to-dos, in Phases-list order and then their own order. */
export function listStarters(db: DatabaseSync): StarterToDo[] {
  const rows = db
    .prepare(
      `SELECT st.* FROM starter_todos st
       JOIN list_values lv ON lv.id = st.phase_list_id AND lv.list = 'phase'
       ORDER BY lv.sort_order, st.sort_order`,
    )
    .all() as unknown as StarterRow[];
  return rows.map(toStarterToDo);
}

export function addStarter(db: DatabaseSync, data: StarterToDoData): StarterToDo | { error: 'Unknown phase' } {
  const phase = db.prepare("SELECT id FROM list_values WHERE id = ? AND list = 'phase'").get(data.phaseListId);
  if (!phase) return { error: 'Unknown phase' };
  const { next } = db
    .prepare('SELECT COALESCE(MAX(sort_order) + 1, 0) AS next FROM starter_todos WHERE phase_list_id = ?')
    .get(data.phaseListId) as unknown as { next: number };
  const res = db
    .prepare('INSERT INTO starter_todos (phase_list_id, title, sort_order) VALUES (?, ?, ?)')
    .run(data.phaseListId, data.title, next);
  const row = db.prepare('SELECT * FROM starter_todos WHERE id = ?').get(Number(res.lastInsertRowid)) as unknown as StarterRow;
  return toStarterToDo(row);
}

export function renameStarter(db: DatabaseSync, id: number, title: string): StarterToDo | undefined {
  const changes = Number(db.prepare('UPDATE starter_todos SET title = ? WHERE id = ?').run(title, id).changes);
  if (changes === 0) return undefined;
  const row = db.prepare('SELECT * FROM starter_todos WHERE id = ?').get(id) as unknown as StarterRow;
  return toStarterToDo(row);
}

export function deleteStarter(db: DatabaseSync, id: number): boolean {
  return Number(db.prepare('DELETE FROM starter_todos WHERE id = ?').run(id).changes) > 0;
}

interface SuggestionRow {
  phase_id: number;
  phase_name: string;
  title: string;
}

/**
 * Starter items for a project's top-level phases, in plan order then item order. A phase matches a Phases-list
 * value by name, ignoring case; a project with two same-named phases (e.g. two "Design" phases) gets suggestions
 * under each, since each is its own piece of work. Limited to `phaseIds` when given.
 */
export function starterSuggestions(db: DatabaseSync, projectId: number, phaseIds?: number[]): StarterSuggestion[] {
  const params: (number | string)[] = [projectId];
  let phaseFilter = '';
  if (phaseIds !== undefined) {
    if (phaseIds.length === 0) return [];
    phaseFilter = ` AND p.id IN (${phaseIds.map(() => '?').join(', ')})`;
    params.push(...phaseIds);
  }
  const rows = db
    .prepare(
      `SELECT p.id AS phase_id, p.name AS phase_name, st.title AS title
       FROM phases p
       JOIN list_values lv ON lv.list = 'phase' AND lv.name = p.name COLLATE NOCASE
       JOIN starter_todos st ON st.phase_list_id = lv.id
       WHERE p.project_id = ? AND p.parent_id IS NULL${phaseFilter}
       ORDER BY p.sort_order, st.sort_order`,
    )
    .all(...params) as unknown as SuggestionRow[];
  return rows.map((r) => ({ phaseId: r.phase_id, phaseName: r.phase_name, title: r.title }));
}

/**
 * Creates one to-do per item, in one transaction; nothing is created when any phaseId isn't one of the project's
 * top-level phases. The assignee is "I am" when it is set, and null otherwise; there is no due date and no note.
 */
export function acceptStarters(
  db: DatabaseSync,
  projectId: number,
  items: { phaseId: number; title: string }[],
  today: ISODate,
): ToDoRecord[] | { issues: ValidationIssue[] } {
  const phaseRows = db
    .prepare('SELECT id FROM phases WHERE project_id = ? AND parent_id IS NULL')
    .all(projectId) as unknown as { id: number }[];
  const validIds = new Set(phaseRows.map((r) => r.id));
  const issues: ValidationIssue[] = [];
  items.forEach((item, i) => {
    if (!validIds.has(item.phaseId)) issues.push({ path: `items.${i}.phaseId`, message: 'Unknown phase' });
  });
  if (issues.length > 0) return { issues };

  const me = getMe(db);
  return transaction(db, () =>
    items.map((item) =>
      createToDo(
        db,
        projectId,
        { title: item.title, note: null, assigneeId: me.resourceId, dueDate: null, phaseId: item.phaseId, done: false },
        today,
      ),
    ),
  );
}
