import type { DatabaseSync } from 'node:sqlite';
import { todayLocal, type ISODate, type WorkCalendar } from '../../shared/calendar';
import type { NewProject, ProjectDetails, ValidationIssue } from '../../shared/schemas';
import { schedulePhases } from '../../shared/scheduler';
import type {
  BusinessContact, Category, ListName, PhaseRecord, Priority, ProjectRecord, Ref, ScopeItem, ScopeKind, Side,
} from '../../shared/types';
import { transaction } from '../db';
import { getListValue } from '../lists/repo';

interface ProjectRow {
  id: number;
  name: string;
  jira_key: string | null;
  color: string;
  start_date: string;
  priority: Priority;
  project_manager_id: number | null;
  main_project_id: number | null;
  category: Category | null;
  project_type_id: number | null;
  goal_id: number | null;
  department_id: number | null;
  requester_internal: number;
  requester_external: number;
  beneficiary_employees: number;
  beneficiary_customers: number;
  background: string;
  summary: string;
  business_pm_id: number | null;
}

interface PhaseRow {
  id: number;
  project_id: number;
  name: string;
  sort_order: number;
  duration_days: number;
  planned_start: string;
  planned_end: string;
}

interface ScopeRow {
  id: number;
  project_id: number;
  kind: ScopeKind;
  text: string;
  sort_order: number;
  date_added: string;
}

/** Columns written from ProjectDetails, in the same order as detailValues(). */
const DETAIL_COLUMNS = [
  'name', 'jira_key', 'color', 'priority', 'project_manager_id', 'main_project_id', 'category',
  'project_type_id', 'goal_id', 'department_id', 'requester_internal', 'requester_external',
  'beneficiary_employees', 'beneficiary_customers', 'background', 'summary', 'business_pm_id',
];

function detailValues(d: ProjectDetails) {
  return [
    d.name, d.jiraKey, d.color, d.priority, d.projectManagerId, d.mainProjectId, d.category,
    d.projectTypeId, d.goalId, d.departmentId, d.requester.internal ? 1 : 0, d.requester.external ? 1 : 0,
    d.beneficiary.employees ? 1 : 0, d.beneficiary.customers ? 1 : 0, d.background, d.summary, d.businessPmId,
  ];
}

const LIST_REFS: { field: 'mainProjectId' | 'projectTypeId' | 'goalId' | 'departmentId'; list: ListName; label: string }[] = [
  { field: 'mainProjectId', list: 'mainProject', label: 'main project' },
  { field: 'projectTypeId', list: 'projectType', label: 'project type' },
  { field: 'goalId', list: 'goal', label: 'goal' },
  { field: 'departmentId', list: 'department', label: 'business user (department)' },
];

const PERSON_REFS: { field: 'projectManagerId' | 'businessPmId'; side: Side; label: string }[] = [
  { field: 'projectManagerId', side: 'tech', label: 'project manager (tech)' },
  { field: 'businessPmId', side: 'business', label: 'business project manager' },
];

/** Every chosen list value must exist in the right list, and every chosen person must exist on the right side. */
export function checkRefs(db: DatabaseSync, details: ProjectDetails): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const { field, list, label } of LIST_REFS) {
    const id = details[field];
    if (id === null) continue;
    if (getListValue(db, id)?.list !== list) issues.push({ path: field, message: `Unknown ${label}` });
  }
  for (const { field, side, label } of PERSON_REFS) {
    const id = details[field];
    if (id === null) continue;
    const person = db.prepare('SELECT side FROM resources WHERE id = ?').get(id) as unknown as { side: Side } | undefined;
    if (person?.side !== side) issues.push({ path: field, message: `Unknown ${label}` });
  }
  return issues;
}

function toPhase(row: PhaseRow): PhaseRecord {
  return {
    id: row.id,
    name: row.name,
    order: row.sort_order,
    durationDays: row.duration_days,
    start: row.planned_start,
    end: row.planned_end,
  };
}

function toScopeItem(row: ScopeRow): ScopeItem {
  return { id: row.id, kind: row.kind, text: row.text, order: row.sort_order, dateAdded: row.date_added };
}

function listNames(db: DatabaseSync): Map<number, string> {
  const rows = db.prepare('SELECT id, name FROM list_values').all() as unknown as { id: number; name: string }[];
  return new Map(rows.map((r) => [r.id, r.name]));
}

function ref(names: Map<number, string>, id: number | null): Ref | null {
  if (id === null) return null;
  const name = names.get(id);
  return name === undefined ? null : { id, name };
}

function peopleById(db: DatabaseSync): Map<number, BusinessContact> {
  const rows = db.prepare('SELECT id, name, phone, email FROM resources').all() as unknown as BusinessContact[];
  return new Map(rows.map((r) => [r.id, { id: r.id, name: r.name, phone: r.phone, email: r.email }]));
}

function toProject(
  row: ProjectRow, phases: PhaseRecord[], scopeItems: ScopeItem[], names: Map<number, string>, people: Map<number, BusinessContact>,
): ProjectRecord {
  return {
    id: row.id,
    name: row.name,
    jiraKey: row.jira_key,
    color: row.color,
    startDate: row.start_date,
    priority: row.priority,
    projectManager: (() => {
      const pm = row.project_manager_id === null ? undefined : people.get(row.project_manager_id);
      return pm ? { id: pm.id, name: pm.name } : null;
    })(),
    businessPm: (row.business_pm_id === null ? undefined : people.get(row.business_pm_id)) ?? null,
    mainProject: ref(names, row.main_project_id),
    category: row.category,
    projectType: ref(names, row.project_type_id),
    goal: ref(names, row.goal_id),
    department: ref(names, row.department_id),
    requester: { internal: row.requester_internal === 1, external: row.requester_external === 1 },
    beneficiary: { employees: row.beneficiary_employees === 1, customers: row.beneficiary_customers === 1 },
    background: row.background,
    summary: row.summary,
    scopeItems,
    phases,
  };
}

/**
 * Makes the project's scope items match `items`. An item whose id is already saved on this project is updated and
 * keeps its date added; any other item is inserted with `today`; saved items that are not in `items` are deleted.
 * Order counts from 0 within each kind, in the order given.
 */
function saveScopeItems(db: DatabaseSync, projectId: number, items: ProjectDetails['scopeItems'], today: ISODate): void {
  const saved = (db.prepare('SELECT id FROM scope_items WHERE project_id = ?').all(projectId) as unknown as { id: number }[])
    .map((r) => r.id);
  const kept = new Set(items.map((i) => i.id).filter((id): id is number => id !== undefined && saved.includes(id)));
  const remove = db.prepare('DELETE FROM scope_items WHERE id = ?');
  for (const id of saved) if (!kept.has(id)) remove.run(id);

  const update = db.prepare('UPDATE scope_items SET kind = ?, text = ?, sort_order = ? WHERE id = ?');
  const insert = db.prepare(
    'INSERT INTO scope_items (project_id, kind, text, sort_order, date_added) VALUES (?, ?, ?, ?, ?)',
  );
  const nextOrder = new Map<ScopeKind, number>();
  for (const item of items) {
    const order = nextOrder.get(item.kind) ?? 0;
    nextOrder.set(item.kind, order + 1);
    // kept.delete() is true only the first time an id is seen, so a repeated id is saved as a new item.
    if (item.id !== undefined && kept.delete(item.id)) update.run(item.kind, item.text, order, item.id);
    else insert.run(projectId, item.kind, item.text, order, today);
  }
}

export function createProject(db: DatabaseSync, cal: WorkCalendar, input: NewProject, today: ISODate = todayLocal()): ProjectRecord {
  const scheduled = schedulePhases(input.startDate, input.phases, cal);
  const id = transaction(db, () => {
    const columns = [...DETAIL_COLUMNS, 'start_date', 'created_at'];
    const res = db
      .prepare(`INSERT INTO projects (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`)
      .run(...detailValues(input), input.startDate, new Date().toISOString());
    const projectId = Number(res.lastInsertRowid);
    const insertPhase = db.prepare(
      'INSERT INTO phases (project_id, name, sort_order, duration_days, planned_start, planned_end) VALUES (?, ?, ?, ?, ?, ?)',
    );
    for (const p of scheduled) insertPhase.run(projectId, p.name, p.order, p.durationDays, p.start, p.end);
    saveScopeItems(db, projectId, input.scopeItems, today);
    return projectId;
  });
  return getProject(db, id)!;
}

/** Changes everything except the schedule. Returns undefined when the project does not exist. */
export function updateProjectDetails(
  db: DatabaseSync, id: number, details: ProjectDetails, today: ISODate = todayLocal(),
): ProjectRecord | undefined {
  if (!db.prepare('SELECT id FROM projects WHERE id = ?').get(id)) return undefined;
  transaction(db, () => {
    const sets = DETAIL_COLUMNS.map((c) => `${c} = ?`).join(', ');
    db.prepare(`UPDATE projects SET ${sets} WHERE id = ?`).run(...detailValues(details), id);
    saveScopeItems(db, id, details.scopeItems, today);
  });
  return getProject(db, id);
}

export function getProject(db: DatabaseSync, id: number): ProjectRecord | undefined {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as unknown as ProjectRow | undefined;
  if (!row) return undefined;
  const phases = db
    .prepare('SELECT * FROM phases WHERE project_id = ? ORDER BY sort_order')
    .all(id) as unknown as PhaseRow[];
  const scope = db
    .prepare('SELECT * FROM scope_items WHERE project_id = ? ORDER BY kind, sort_order')
    .all(id) as unknown as ScopeRow[];
  return toProject(row, phases.map(toPhase), scope.map(toScopeItem), listNames(db), peopleById(db));
}

function byProject<R extends { project_id: number }, T>(rows: R[], map: (row: R) => T): Map<number, T[]> {
  const grouped = new Map<number, T[]>();
  for (const row of rows) {
    const list = grouped.get(row.project_id) ?? [];
    list.push(map(row));
    grouped.set(row.project_id, list);
  }
  return grouped;
}

export function listProjects(db: DatabaseSync): ProjectRecord[] {
  const rows = db.prepare('SELECT * FROM projects ORDER BY start_date, id').all() as unknown as ProjectRow[];
  const phases = byProject(
    db.prepare('SELECT * FROM phases ORDER BY project_id, sort_order').all() as unknown as PhaseRow[],
    toPhase,
  );
  const scope = byProject(
    db.prepare('SELECT * FROM scope_items ORDER BY project_id, kind, sort_order').all() as unknown as ScopeRow[],
    toScopeItem,
  );
  const names = listNames(db);
  const people = peopleById(db);
  return rows.map((r) => toProject(r, phases.get(r.id) ?? [], scope.get(r.id) ?? [], names, people));
}
