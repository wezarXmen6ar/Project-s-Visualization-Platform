import type { DatabaseSync } from 'node:sqlite';
import type { WorkCalendar } from '../../shared/calendar';
import type { NewProject } from '../../shared/schemas';
import { schedulePhases } from '../../shared/scheduler';
import type { PhaseRecord, ProjectRecord } from '../../shared/types';
import { transaction } from '../db';

interface ProjectRow {
  id: number;
  name: string;
  jira_key: string | null;
  color: string;
  start_date: string;
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

function toProject(row: ProjectRow, phases: PhaseRecord[]): ProjectRecord {
  return { id: row.id, name: row.name, jiraKey: row.jira_key, color: row.color, startDate: row.start_date, phases };
}

export function createProject(db: DatabaseSync, cal: WorkCalendar, input: NewProject): ProjectRecord {
  const scheduled = schedulePhases(input.startDate, input.phases, cal);
  const id = transaction(db, () => {
    const res = db
      .prepare('INSERT INTO projects (name, jira_key, color, start_date, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(input.name, input.jiraKey, input.color, input.startDate, new Date().toISOString());
    const projectId = Number(res.lastInsertRowid);
    const insertPhase = db.prepare(
      'INSERT INTO phases (project_id, name, sort_order, duration_days, planned_start, planned_end) VALUES (?, ?, ?, ?, ?, ?)',
    );
    for (const p of scheduled) insertPhase.run(projectId, p.name, p.order, p.durationDays, p.start, p.end);
    return projectId;
  });
  return getProject(db, id)!;
}

export function getProject(db: DatabaseSync, id: number): ProjectRecord | undefined {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as unknown as ProjectRow | undefined;
  if (!row) return undefined;
  const phases = db
    .prepare('SELECT * FROM phases WHERE project_id = ? ORDER BY sort_order')
    .all(id) as unknown as PhaseRow[];
  return toProject(row, phases.map(toPhase));
}

export function listProjects(db: DatabaseSync): ProjectRecord[] {
  const rows = db.prepare('SELECT * FROM projects ORDER BY start_date, id').all() as unknown as ProjectRow[];
  const phaseRows = db.prepare('SELECT * FROM phases ORDER BY project_id, sort_order').all() as unknown as PhaseRow[];
  const byProject = new Map<number, PhaseRecord[]>();
  for (const p of phaseRows) {
    const list = byProject.get(p.project_id) ?? [];
    list.push(toPhase(p));
    byProject.set(p.project_id, list);
  }
  return rows.map((r) => toProject(r, byProject.get(r.id) ?? []));
}
