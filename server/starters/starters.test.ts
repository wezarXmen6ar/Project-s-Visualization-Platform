import { beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { DEFAULT_CALENDAR } from '../../shared/calendar';
import { newProjectSchema, resourceInputSchema, starterToDoInputSchema } from '../../shared/schemas';
import type { ProjectRecord } from '../../shared/types';
import { openDb } from '../db';
import { createProject as createProjectRow } from '../projects/repo';
import { createResource } from '../resources/repo';
import { setMe } from '../settings';
import { acceptStarters, addStarter, listStarters, starterSuggestions } from './repo';

let db: DatabaseSync;
let uatId: number;
let deploymentId: number;
let departmentId: number;

beforeEach(() => {
  db = openDb(':memory:');
  const uat = db.prepare("SELECT id FROM list_values WHERE list = 'phase' AND name = 'UAT'").get() as unknown as { id: number };
  const deployment = db
    .prepare("SELECT id FROM list_values WHERE list = 'phase' AND name = 'Deployment'")
    .get() as unknown as { id: number };
  uatId = uat.id;
  deploymentId = deployment.id;
  const dept = db.prepare('INSERT INTO list_values (list, name, sort_order) VALUES (?, ?, ?)').run('department', 'Finance', 0);
  departmentId = Number(dept.lastInsertRowid);
});

function createProject(phaseNames: string[], startDate = '2026-09-25'): ProjectRecord {
  return createProjectRow(
    db,
    DEFAULT_CALENDAR,
    newProjectSchema.parse({
      name: 'Portal',
      color: '#3b82f6',
      startDate,
      phases: phaseNames.map((name) => ({ name, durationDays: 5 })),
    }),
  );
}

describe('adding and listing', () => {
  it('lists items in Phases-list order, then in the order they were added', () => {
    addStarter(db, starterToDoInputSchema.parse({ phaseListId: uatId, title: 'Write test cases' }));
    addStarter(db, starterToDoInputSchema.parse({ phaseListId: uatId, title: 'Get sign-off' }));
    addStarter(db, starterToDoInputSchema.parse({ phaseListId: deploymentId, title: 'Prepare release notes' }));

    const all = listStarters(db);
    expect(all.map((s) => s.title)).toEqual(['Write test cases', 'Get sign-off', 'Prepare release notes']);
    expect(all[0].phaseListId).toBe(uatId);
    expect(all[2].phaseListId).toBe(deploymentId);
  });

  it('rejects a non-phase list value id with "Unknown phase"', () => {
    const result = addStarter(db, starterToDoInputSchema.parse({ phaseListId: departmentId, title: 'Whatever' }));
    expect(result).toEqual({ error: 'Unknown phase', code: 'error.unknownPhase' });
  });
});

describe('suggestions', () => {
  it('matches phases by name ignoring case, in plan order, with each item in its own order', () => {
    addStarter(db, starterToDoInputSchema.parse({ phaseListId: uatId, title: 'Write test cases' }));
    addStarter(db, starterToDoInputSchema.parse({ phaseListId: uatId, title: 'Get sign-off' }));
    addStarter(db, starterToDoInputSchema.parse({ phaseListId: deploymentId, title: 'Prepare release notes' }));

    const project = createProject(['uat', 'Deployment']);
    const all = starterSuggestions(db, project.id);
    expect(all).toEqual([
      { phaseId: project.phases[0].id, phaseName: 'uat', title: 'Write test cases' },
      { phaseId: project.phases[0].id, phaseName: 'uat', title: 'Get sign-off' },
      { phaseId: project.phases[1].id, phaseName: 'Deployment', title: 'Prepare release notes' },
    ]);
  });

  it('limits to the given phaseIds', () => {
    addStarter(db, starterToDoInputSchema.parse({ phaseListId: uatId, title: 'Write test cases' }));
    addStarter(db, starterToDoInputSchema.parse({ phaseListId: deploymentId, title: 'Prepare release notes' }));
    const project = createProject(['uat', 'Deployment']);

    const onlyDeployment = starterSuggestions(db, project.id, [project.phases[1].id]);
    expect(onlyDeployment).toEqual([{ phaseId: project.phases[1].id, phaseName: 'Deployment', title: 'Prepare release notes' }]);
  });

  it('gives two "Design" phases their own suggestions each', () => {
    const design = db.prepare("SELECT id FROM list_values WHERE list = 'phase' AND name = 'Design'").get() as unknown as { id: number };
    addStarter(db, starterToDoInputSchema.parse({ phaseListId: design.id, title: 'Wireframes' }));
    const project = createProject(['Design', 'Design']);

    const suggestions = starterSuggestions(db, project.id);
    expect(suggestions).toEqual([
      { phaseId: project.phases[0].id, phaseName: 'Design', title: 'Wireframes' },
      { phaseId: project.phases[1].id, phaseName: 'Design', title: 'Wireframes' },
    ]);
  });

  it('keeps matching a phase after its Phases-list value (and the phase) is renamed together', () => {
    const starter = addStarter(db, starterToDoInputSchema.parse({ phaseListId: uatId, title: 'Write test cases' })) as { id: number };
    expect(starter).toBeDefined();
    const project = createProject(['UAT']);

    db.prepare('UPDATE list_values SET name = ? WHERE id = ?').run('User acceptance testing', uatId);
    db.prepare('UPDATE phases SET name = ? WHERE id = ?').run('User acceptance testing', project.phases[0].id);

    const suggestions = starterSuggestions(db, project.id);
    expect(suggestions).toEqual([
      { phaseId: project.phases[0].id, phaseName: 'User acceptance testing', title: 'Write test cases' },
    ]);
  });
});

describe('accepting', () => {
  it('creates to-dos assigned to "I am" and linked to their phases', () => {
    const me = createResource(db, resourceInputSchema.parse({ name: 'Sara', side: 'tech' }));
    setMe(db, me.id);
    const project = createProject(['UAT', 'Deployment']);

    const result = acceptStarters(
      db,
      project.id,
      [
        { phaseId: project.phases[0].id, title: 'Write test cases' },
        { phaseId: project.phases[1].id, title: 'Prepare release notes' },
      ],
      '2026-09-25',
    );
    expect('issues' in result).toBe(false);
    const created = result as import('../../shared/types').ToDoRecord[];
    expect(created).toHaveLength(2);
    expect(created[0]).toMatchObject({ title: 'Write test cases', phase: { id: project.phases[0].id, name: 'UAT' }, assignee: { id: me.id, name: 'Sara' } });
    expect(created[1]).toMatchObject({ title: 'Prepare release notes', phase: { id: project.phases[1].id, name: 'Deployment' } });
  });

  it('assigns null when "I am" is not set', () => {
    const project = createProject(['UAT']);
    const result = acceptStarters(db, project.id, [{ phaseId: project.phases[0].id, title: 'Write test cases' }], '2026-09-25');
    const created = result as import('../../shared/types').ToDoRecord[];
    expect(created[0].assignee).toBeNull();
  });

  it('rejects a phaseId from another project, and creates nothing', () => {
    const project = createProject(['UAT']);
    const other = createProject(['QA'], '2026-10-05');

    const result = acceptStarters(db, project.id, [{ phaseId: other.phases[0].id, title: 'Not this project' }], '2026-09-25');
    expect(result).toEqual({ issues: [{ path: 'items.0.phaseId', message: 'Unknown phase', code: 'error.unknownPhase' }] });

    const rows = db.prepare('SELECT COUNT(*) AS n FROM todos').get() as unknown as { n: number };
    expect(rows.n).toBe(0);
  });
});
