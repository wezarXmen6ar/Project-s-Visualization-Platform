import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app';
import { openDb } from './db';

describe('health', () => {
  it('reports ok', async () => {
    const app = buildApp(openDb(':memory:'));
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });
});

describe('GET /api/backups', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'pvp-backup-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('reports the backup status', async () => {
    const app = buildApp(openDb(':memory:'), { backupDir: dir });
    const res = await app.inject({ method: 'GET', url: '/api/backups' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ latest: null, count: 0 });
  });
});

describe('POST /api/projects with sub-phases', () => {
  it('rejects a sub-phase assigned to a business contact', async () => {
    const db = openDb(':memory:');
    const app = buildApp(db);
    const contact = (await app.inject({ method: 'POST', url: '/api/resources', payload: { name: 'Mariam', side: 'business' } })).json();
    const res = await app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: {
        name: 'Portal', color: '#3b82f6', startDate: '2026-10-05',
        phases: [
          {
            name: 'Development', durationDays: 5,
            subPhases: [{ name: 'Increment 1', durationDays: 5, assignments: [{ resourceId: contact.id, allocation: 50 }] }],
          },
        ],
      },
    });
    expect(res.statusCode).toBe(400);
    const issues = res.json().issues as { path: string; message: string }[];
    expect(issues.map((i) => i.path)).toContain('phases.0.subPhases.0.assignments.0.resourceId');
  });
});

describe('PUT /api/projects/:id/schedule', () => {
  it('replaces the schedule and returns the saved project with addedPhaseIds', async () => {
    const db = openDb(':memory:');
    const app = buildApp(db);
    const created = (
      await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: { name: 'Portal', color: '#3b82f6', startDate: '2026-10-05', phases: [{ name: 'A', durationDays: 5 }] },
      })
    ).json();
    const res = await app.inject({
      method: 'PUT',
      url: `/api/projects/${created.id}/schedule`,
      payload: {
        startDate: '2026-10-05',
        phases: [{ id: created.phases[0].id, name: 'A', durationDays: 5 }, { name: 'B', durationDays: 3 }],
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.project.phases).toHaveLength(2);
    expect(body.addedPhaseIds).toEqual([body.project.phases[1].id]);
  });

  it('rejects an empty phases array', async () => {
    const db = openDb(':memory:');
    const app = buildApp(db);
    const created = (
      await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: { name: 'Portal', color: '#3b82f6', startDate: '2026-10-05', phases: [{ name: 'A', durationDays: 5 }] },
      })
    ).json();
    const res = await app.inject({
      method: 'PUT',
      url: `/api/projects/${created.id}/schedule`,
      payload: { startDate: '2026-10-05', phases: [] },
    });
    expect(res.statusCode).toBe(400);
    const issues = res.json().issues as { path: string; message: string }[];
    expect(issues).toContainEqual({ path: 'phases', message: 'Add at least one phase', code: 'validation.addAtLeastOnePhase' });
  });

  it('returns 404 for a missing project', async () => {
    const db = openDb(':memory:');
    const app = buildApp(db);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/projects/999/schedule',
      payload: { startDate: '2026-10-05', phases: [{ name: 'A', durationDays: 2 }] },
    });
    expect(res.statusCode).toBe(404);
  });

  it('moves an assignment on the workload heatmap after a schedule change', async () => {
    const db = openDb(':memory:');
    const app = buildApp(db);
    const rami = (await app.inject({ method: 'POST', url: '/api/resources', payload: { name: 'Rami', side: 'tech' } })).json();
    const created = (
      await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: {
          name: 'Portal', color: '#3b82f6', startDate: '2026-10-05',
          phases: [{ name: 'A', durationDays: 5, assignments: [{ resourceId: rami.id, allocation: 50 }] }],
        },
      })
    ).json();
    await app.inject({
      method: 'PUT',
      url: `/api/projects/${created.id}/schedule`,
      payload: { startDate: '2026-10-12', phases: [{ id: created.phases[0].id, name: 'A', durationDays: 5 }] },
    });
    const workload = (await app.inject({ method: 'GET', url: '/api/workload' })).json();
    const assignment = workload.assignments.find((a: { resourceId: number }) => a.resourceId === rami.id);
    expect(assignment.start).toBe('2026-10-12');
  });
});

describe('to-dos', () => {
  async function setup() {
    const db = openDb(':memory:');
    const app = buildApp(db, { today: () => '2026-10-07' });
    const ted = (await app.inject({ method: 'POST', url: '/api/resources', payload: { name: 'Ted', side: 'tech' } })).json();
    const project = (
      await app.inject({
        method: 'POST', url: '/api/projects',
        payload: {
          name: 'Portal', color: '#3b82f6', startDate: '2026-10-05',
          phases: [{ name: 'A', durationDays: 5, assignments: [{ resourceId: ted.id, allocation: 50 }] }],
        },
      })
    ).json();
    return { app, project, ted };
  }

  it('creates a to-do, and 404s for a missing project', async () => {
    const { app, project } = await setup();
    const created = await app.inject({ method: 'POST', url: `/api/projects/${project.id}/todos`, payload: { title: 'Chase Jira' } });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ title: 'Chase Jira', projectId: project.id, done: false });

    const missing = await app.inject({ method: 'POST', url: '/api/projects/999/todos', payload: { title: 'Chase Jira' } });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toEqual({ error: 'Project not found', code: 'error.projectNotFound' });
  });

  it('rejects an empty title', async () => {
    const { app, project } = await setup();
    const res = await app.inject({ method: 'POST', url: `/api/projects/${project.id}/todos`, payload: { title: '' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().issues).toContainEqual({ path: 'title', message: 'Write what needs doing', code: 'validation.writeWhatNeedsDoing' });
  });

  it('marks a to-do done with today\'s date, and deletes it', async () => {
    const { app, project } = await setup();
    const created = (
      await app.inject({ method: 'POST', url: `/api/projects/${project.id}/todos`, payload: { title: 'Chase Jira' } })
    ).json();

    const done = await app.inject({ method: 'PUT', url: `/api/todos/${created.id}`, payload: { title: 'Chase Jira', done: true } });
    expect(done.statusCode).toBe(200);
    expect(done.json()).toMatchObject({ done: true, doneDate: '2026-10-07' });

    const deleted = await app.inject({ method: 'DELETE', url: `/api/todos/${created.id}` });
    expect(deleted.statusCode).toBe(204);
    const again = await app.inject({ method: 'DELETE', url: `/api/todos/${created.id}` });
    expect(again.statusCode).toBe(404);
  });

  it('filters by assignee, and includes done ones only when asked', async () => {
    const { app, project, ted } = await setup();
    await app.inject({ method: 'POST', url: `/api/projects/${project.id}/todos`, payload: { title: 'Unassigned' } });
    const tedsToDo = (
      await app.inject({
        method: 'POST', url: `/api/projects/${project.id}/todos`, payload: { title: "Ted's task", assigneeId: ted.id },
      })
    ).json();
    const doneToDo = (
      await app.inject({ method: 'POST', url: `/api/projects/${project.id}/todos`, payload: { title: 'Done task', done: true } })
    ).json();

    const forTed = await app.inject({ method: 'GET', url: `/api/todos?assigneeId=${ted.id}` });
    expect(forTed.json().map((t: { id: number }) => t.id)).toEqual([tedsToDo.id]);

    const withoutDone = await app.inject({ method: 'GET', url: `/api/todos?projectId=${project.id}` });
    expect(withoutDone.json().map((t: { id: number }) => t.id)).not.toContain(doneToDo.id);

    const withDone = await app.inject({ method: 'GET', url: `/api/todos?projectId=${project.id}&done=include` });
    expect(withDone.json().map((t: { id: number }) => t.id)).toContain(doneToDo.id);
  });

  it('returns only to-dos with a former phase for ?removed=1', async () => {
    const { app, project } = await setup();
    const untouched = (
      await app.inject({ method: 'POST', url: `/api/projects/${project.id}/todos`, payload: { title: 'Untouched' } })
    ).json();
    const phaseId = project.phases[0].id;
    const onPhase = (
      await app.inject({ method: 'POST', url: `/api/projects/${project.id}/todos`, payload: { title: 'On phase', phaseId } })
    ).json();

    await app.inject({
      method: 'PUT', url: `/api/projects/${project.id}/schedule`,
      payload: { startDate: '2026-10-05', phases: [{ name: 'B', durationDays: 3 }] },
    });

    const removed = await app.inject({ method: 'GET', url: '/api/todos?removed=1' });
    const removedIds = removed.json().map((t: { id: number }) => t.id);
    expect(removedIds).toContain(onPhase.id);
    expect(removedIds).not.toContain(untouched.id);
    expect(removed.json().every((t: { formerPhase: unknown }) => t.formerPhase !== null)).toBe(true);
  });

  it('ignores a bad projectId and assigneeId and returns everything open', async () => {
    const { app, project } = await setup();
    const created = (
      await app.inject({ method: 'POST', url: `/api/projects/${project.id}/todos`, payload: { title: 'Task' } })
    ).json();

    const res = await app.inject({ method: 'GET', url: '/api/todos?projectId=abc&assigneeId=-3' });
    expect(res.statusCode).toBe(200);
    expect(res.json().map((t: { id: number }) => t.id)).toContain(created.id);
  });
});

describe('starter to-dos', () => {
  async function uatPhaseId(app: ReturnType<typeof buildApp>) {
    const lists = (await app.inject({ method: 'GET', url: '/api/lists' })).json();
    return (lists.phase.find((p: { name: string }) => p.name === 'UAT') as { id: number }).id;
  }

  it('adds a starter to-do, and rejects a non-phase list value with "Unknown phase"', async () => {
    const db = openDb(':memory:');
    const app = buildApp(db);
    const phaseId = await uatPhaseId(app);

    const created = await app.inject({ method: 'POST', url: '/api/starter-todos', payload: { phaseListId: phaseId, title: 'Write test cases' } });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ phaseListId: phaseId, title: 'Write test cases' });

    const departmentValue = (
      await app.inject({ method: 'POST', url: '/api/lists/department', payload: { name: 'Finance' } })
    ).json();
    const rejected = await app.inject({ method: 'POST', url: '/api/starter-todos', payload: { phaseListId: departmentValue.id, title: 'X' } });
    expect(rejected.statusCode).toBe(400);
    expect(rejected.json()).toEqual({ error: 'Unknown phase', code: 'error.unknownPhase' });
  });

  it('lists starter to-dos, renames one, and 404s on a missing id', async () => {
    const db = openDb(':memory:');
    const app = buildApp(db);
    const phaseId = await uatPhaseId(app);
    const created = (
      await app.inject({ method: 'POST', url: '/api/starter-todos', payload: { phaseListId: phaseId, title: 'Write test cases' } })
    ).json();

    const listed = await app.inject({ method: 'GET', url: '/api/starter-todos' });
    expect(listed.json().map((s: { id: number }) => s.id)).toContain(created.id);

    const renamed = await app.inject({ method: 'PUT', url: `/api/starter-todos/${created.id}`, payload: { title: 'Write full test cases' } });
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json().title).toBe('Write full test cases');

    const missing = await app.inject({ method: 'PUT', url: '/api/starter-todos/999999', payload: { title: 'X' } });
    expect(missing.statusCode).toBe(404);
  });

  it('deletes a starter to-do, 200/204s and 404s appropriately', async () => {
    const db = openDb(':memory:');
    const app = buildApp(db);
    const phaseId = await uatPhaseId(app);
    const created = (
      await app.inject({ method: 'POST', url: '/api/starter-todos', payload: { phaseListId: phaseId, title: 'Write test cases' } })
    ).json();

    const deleted = await app.inject({ method: 'DELETE', url: `/api/starter-todos/${created.id}` });
    expect(deleted.statusCode).toBe(204);
    const again = await app.inject({ method: 'DELETE', url: `/api/starter-todos/${created.id}` });
    expect(again.statusCode).toBe(404);
  });

  it('gives suggestions for a project\'s phases, filterable by phaseIds, and 404s for a missing project', async () => {
    const db = openDb(':memory:');
    const app = buildApp(db);
    const uatId = await uatPhaseId(app);
    await app.inject({ method: 'POST', url: '/api/starter-todos', payload: { phaseListId: uatId, title: 'Write test cases' } });
    const project = (
      await app.inject({
        method: 'POST', url: '/api/projects',
        payload: { name: 'Portal', color: '#3b82f6', startDate: '2026-09-25', phases: [{ name: 'UAT', durationDays: 5 }] },
      })
    ).json();

    const all = await app.inject({ method: 'GET', url: `/api/projects/${project.id}/starter-suggestions` });
    expect(all.statusCode).toBe(200);
    expect(all.json()).toEqual([{ phaseId: project.phases[0].id, phaseName: 'UAT', title: 'Write test cases' }]);

    const filtered = await app.inject({ method: 'GET', url: `/api/projects/${project.id}/starter-suggestions?phaseIds=${project.phases[0].id}` });
    expect(filtered.json()).toEqual(all.json());

    const missing = await app.inject({ method: 'GET', url: '/api/projects/999999/starter-suggestions' });
    expect(missing.statusCode).toBe(404);
  });

  it('accepts starter items into to-dos, and rejects a phaseId not among the project\'s top-level phases', async () => {
    const db = openDb(':memory:');
    const app = buildApp(db, { today: () => '2026-09-25' });
    const project = (
      await app.inject({
        method: 'POST', url: '/api/projects',
        payload: { name: 'Portal', color: '#3b82f6', startDate: '2026-09-25', phases: [{ name: 'UAT', durationDays: 5 }] },
      })
    ).json();

    const accepted = await app.inject({
      method: 'POST', url: `/api/projects/${project.id}/todos/from-starters`,
      payload: { items: [{ phaseId: project.phases[0].id, title: 'Write test cases' }] },
    });
    expect(accepted.statusCode).toBe(201);
    expect(accepted.json()).toMatchObject([{ title: 'Write test cases', phase: { id: project.phases[0].id, name: 'UAT' } }]);

    const bad = await app.inject({
      method: 'POST', url: `/api/projects/${project.id}/todos/from-starters`,
      payload: { items: [{ phaseId: 999999, title: 'X' }] },
    });
    expect(bad.statusCode).toBe(400);

    const missing = await app.inject({
      method: 'POST', url: '/api/projects/999999/todos/from-starters',
      payload: { items: [{ phaseId: project.phases[0].id, title: 'X' }] },
    });
    expect(missing.statusCode).toBe(404);
  });

  it('rejects a sub-phase id in from-starters and creates nothing', async () => {
    const db = openDb(':memory:');
    const app = buildApp(db, { today: () => '2026-09-25' });
    const project = (
      await app.inject({
        method: 'POST', url: '/api/projects',
        payload: {
          name: 'Portal', color: '#3b82f6', startDate: '2026-09-25',
          phases: [{ name: 'Development', durationDays: 5, subPhases: [{ name: 'Increment 1', durationDays: 5 }] }],
        },
      })
    ).json();
    const subPhaseId = project.phases[0].subPhases[0].id;

    const res = await app.inject({
      method: 'POST', url: `/api/projects/${project.id}/todos/from-starters`,
      payload: { items: [{ phaseId: subPhaseId, title: 'X' }] },
    });
    expect(res.statusCode).toBe(400);

    const todos = await app.inject({ method: 'GET', url: `/api/todos?projectId=${project.id}` });
    expect(todos.json()).toEqual([]);
  });

  it('ignores bad phaseIds values and returns only the valid phase\'s suggestions', async () => {
    const db = openDb(':memory:');
    const app = buildApp(db);
    const uatId = await uatPhaseId(app);
    await app.inject({ method: 'POST', url: '/api/starter-todos', payload: { phaseListId: uatId, title: 'Write test cases' } });
    const project = (
      await app.inject({
        method: 'POST', url: '/api/projects',
        payload: { name: 'Portal', color: '#3b82f6', startDate: '2026-09-25', phases: [{ name: 'UAT', durationDays: 5 }] },
      })
    ).json();
    const uatPhase = project.phases[0].id;

    const res = await app.inject({
      method: 'GET', url: `/api/projects/${project.id}/starter-suggestions?phaseIds=abc,-1,${uatPhase}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([{ phaseId: uatPhase, phaseName: 'UAT', title: 'Write test cases' }]);
  });
});

describe('"I am"', () => {
  it('rejects a business contact, accepts a tech person, and null clears it', async () => {
    const db = openDb(':memory:');
    const app = buildApp(db);
    const contact = (await app.inject({ method: 'POST', url: '/api/resources', payload: { name: 'Mariam', side: 'business' } })).json();
    const rejected = await app.inject({ method: 'PUT', url: '/api/settings/me', payload: { resourceId: contact.id } });
    expect(rejected.statusCode).toBe(400);
    expect(rejected.json()).toEqual({ error: 'Choose someone from your tech team', code: 'error.chooseTechTeamMember' });

    const tech = (await app.inject({ method: 'POST', url: '/api/resources', payload: { name: 'Sara', side: 'tech' } })).json();
    const set = await app.inject({ method: 'PUT', url: '/api/settings/me', payload: { resourceId: tech.id } });
    expect(set.statusCode).toBe(200);
    expect(set.json()).toEqual({ resourceId: tech.id, name: 'Sara' });

    const got = await app.inject({ method: 'GET', url: '/api/settings/me' });
    expect(got.json()).toEqual({ resourceId: tech.id, name: 'Sara' });

    const cleared = await app.inject({ method: 'PUT', url: '/api/settings/me', payload: { resourceId: null } });
    expect(cleared.statusCode).toBe(200);
    expect(cleared.json()).toEqual({ resourceId: null, name: null });
  });

  it('reads as unset once the person is deactivated', async () => {
    const db = openDb(':memory:');
    const app = buildApp(db);
    const sara = (await app.inject({ method: 'POST', url: '/api/resources', payload: { name: 'Sara', side: 'tech' } })).json();
    const set = await app.inject({ method: 'PUT', url: '/api/settings/me', payload: { resourceId: sara.id } });
    expect(set.statusCode).toBe(200);

    const deactivated = await app.inject({
      method: 'PUT', url: `/api/resources/${sara.id}`,
      payload: { name: 'Sara', side: 'tech', active: false },
    });
    expect(deactivated.statusCode).toBe(200);

    const got = await app.inject({ method: 'GET', url: '/api/settings/me' });
    expect(got.statusCode).toBe(200);
    expect(got.json()).toEqual({ resourceId: null, name: null });
  });
});
