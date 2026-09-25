import type { DatabaseSync } from 'node:sqlite';
import type { ISODate } from '../../shared/calendar';
import type { AssignmentData, OverloadDecisionData, ValidationIssue } from '../../shared/schemas';
import type {
  AssignmentRecord, AssignmentRole, OverloadDecision, OverloadDecisionKind, Side, WorkloadAssignment, WorkloadData,
} from '../../shared/types';
import { getCalendar } from '../settings';

interface AssignmentRow {
  id: number;
  phase_id: number;
  resource_id: number;
  allocation: number;
  role: AssignmentRole;
  resource_name: string;
  project_id: number;
}

interface EventRow {
  id: number;
  effective_date: string;
  resource_id: number;
  week_start: string;
  decision: OverloadDecisionKind;
  note: string | null;
}

const SELECT_ASSIGNMENTS = `
  SELECT a.*, r.name AS resource_name, p.project_id
  FROM assignments a
  JOIN resources r ON r.id = a.resource_id
  JOIN phases p ON p.id = a.phase_id`;

function toAssignment(row: AssignmentRow): AssignmentRecord {
  return {
    id: row.id,
    phaseId: row.phase_id,
    resource: { id: row.resource_id, name: row.resource_name },
    allocation: row.allocation,
    role: row.role,
  };
}

/**
 * Everyone assigned must exist, be on the tech team and be active. `path` prefixes each issue, e.g. "phases.0.assignments".
 * `alreadyOnPhase` lists resourceIds already saved on this phase, who may stay even if since made inactive - only a
 * newly-added inactive person is rejected. Leave it empty (the default) when there is no existing phase to compare
 * against, e.g. when creating a project.
 */
export function checkAssignmentPeople(
  db: DatabaseSync,
  list: { resourceId: number }[],
  path: string,
  alreadyOnPhase: ReadonlySet<number> = new Set(),
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  list.forEach((a, i) => {
    const person = db.prepare('SELECT name, side, active FROM resources WHERE id = ?').get(a.resourceId) as unknown as
      | { name: string; side: Side; active: number }
      | undefined;
    const at = `${path}.${i}.resourceId`;
    if (!person) issues.push({ path: at, message: 'Unknown person' });
    else if (person.side !== 'tech') issues.push({ path: at, message: `${person.name} is a business contact; only the tech team can be assigned` });
    else if (person.active !== 1 && !alreadyOnPhase.has(a.resourceId)) issues.push({ path: at, message: `${person.name} is inactive` });
  });
  return issues;
}

/** The resourceIds currently saved on a phase, e.g. to allow them to stay even if since made inactive. */
export function phaseAssignmentResourceIds(db: DatabaseSync, phaseId: number): Set<number> {
  const rows = db.prepare('SELECT resource_id FROM assignments WHERE phase_id = ?').all(phaseId) as unknown as { resource_id: number }[];
  return new Set(rows.map((r) => r.resource_id));
}

/** Replaces a phase's people. Call inside a transaction. */
export function saveAssignments(db: DatabaseSync, phaseId: number, list: AssignmentData[]): void {
  db.prepare('DELETE FROM assignments WHERE phase_id = ?').run(phaseId);
  const insert = db.prepare('INSERT INTO assignments (phase_id, resource_id, allocation, role) VALUES (?, ?, ?, ?)');
  for (const a of list) insert.run(phaseId, a.resourceId, a.allocation, a.role);
}

export function projectAssignments(db: DatabaseSync, projectId: number): AssignmentRecord[] {
  const rows = db
    .prepare(`${SELECT_ASSIGNMENTS} WHERE p.project_id = ? ORDER BY p.sort_order, a.id`)
    .all(projectId) as unknown as AssignmentRow[];
  return rows.map(toAssignment);
}

export function assignmentsByProject(db: DatabaseSync): Map<number, AssignmentRecord[]> {
  const rows = db.prepare(`${SELECT_ASSIGNMENTS} ORDER BY p.project_id, p.sort_order, a.id`).all() as unknown as AssignmentRow[];
  const grouped = new Map<number, AssignmentRecord[]>();
  for (const row of rows) grouped.set(row.project_id, [...(grouped.get(row.project_id) ?? []), toAssignment(row)]);
  return grouped;
}

/** The project a phase belongs to, or undefined when there is no such phase. */
export function phaseProjectId(db: DatabaseSync, phaseId: number): number | undefined {
  const row = db.prepare('SELECT project_id FROM phases WHERE id = ?').get(phaseId) as unknown as { project_id: number } | undefined;
  return row?.project_id;
}

export function isTechPerson(db: DatabaseSync, id: number): boolean {
  return db.prepare("SELECT id FROM resources WHERE id = ? AND side = 'tech'").get(id) !== undefined;
}

function toDecision(row: EventRow): OverloadDecision {
  return {
    id: row.id,
    resourceId: row.resource_id,
    weekStart: row.week_start,
    decision: row.decision,
    note: row.note,
    date: row.effective_date,
  };
}

export function listDecisions(db: DatabaseSync): OverloadDecision[] {
  const rows = db.prepare("SELECT * FROM events WHERE type = 'overload-resolved' ORDER BY id").all() as unknown as EventRow[];
  return rows.map(toDecision);
}

export function recordDecision(db: DatabaseSync, d: OverloadDecisionData, today: ISODate): OverloadDecision {
  const res = db
    .prepare(
      "INSERT INTO events (type, effective_date, created_at, resource_id, week_start, decision, note) VALUES ('overload-resolved', ?, ?, ?, ?, ?, ?)",
    )
    .run(today, new Date().toISOString(), d.resourceId, d.weekStart, d.decision, d.note);
  return toDecision(db.prepare('SELECT * FROM events WHERE id = ?').get(Number(res.lastInsertRowid)) as unknown as EventRow);
}

/** Active tech-team people with their leave, every assignment with its phase dates, the calendar, and every decision. */
export function workloadData(db: DatabaseSync): WorkloadData {
  const people = db
    .prepare("SELECT id, name, capacity FROM resources WHERE side = 'tech' AND active = 1 ORDER BY name COLLATE NOCASE, id")
    .all() as unknown as { id: number; name: string; capacity: number }[];
  const leave = db.prepare('SELECT resource_id, start_date, end_date FROM leave ORDER BY start_date, id').all() as unknown as {
    resource_id: number;
    start_date: string;
    end_date: string;
  }[];
  const assignments = db
    .prepare(
      `SELECT a.id, a.resource_id, a.phase_id, a.allocation, a.role, p.name AS phase_name, p.planned_start, p.planned_end,
              pr.id AS project_id, pr.name AS project_name
       FROM assignments a
       JOIN phases p ON p.id = a.phase_id
       JOIN projects pr ON pr.id = p.project_id
       ORDER BY p.planned_start, a.id`,
    )
    .all() as unknown as {
    id: number;
    resource_id: number;
    phase_id: number;
    allocation: number;
    role: AssignmentRole;
    phase_name: string;
    planned_start: string;
    planned_end: string;
    project_id: number;
    project_name: string;
  }[];

  return {
    calendar: getCalendar(db),
    resources: people.map((p) => ({
      id: p.id,
      name: p.name,
      capacity: p.capacity,
      leave: leave.filter((l) => l.resource_id === p.id).map((l) => ({ start: l.start_date, end: l.end_date })),
    })),
    assignments: assignments.map(
      (a): WorkloadAssignment => ({
        id: a.id,
        resourceId: a.resource_id,
        phaseId: a.phase_id,
        projectId: a.project_id,
        projectName: a.project_name,
        phaseName: a.phase_name,
        start: a.planned_start,
        end: a.planned_end,
        allocation: a.allocation,
        role: a.role,
      }),
    ),
    decisions: listDecisions(db),
  };
}
