import { describe, expect, it } from 'vitest';
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
    expect(issues).toContainEqual({ path: 'phases', message: 'Add at least one phase' });
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
    expect(missing.json()).toEqual({ error: 'Project not found' });
  });

  it('rejects an empty title', async () => {
    const { app, project } = await setup();
    const res = await app.inject({ method: 'POST', url: `/api/projects/${project.id}/todos`, payload: { title: '' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().issues).toContainEqual({ path: 'title', message: 'Write what needs doing' });
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

describe('"I am"', () => {
  it('rejects a business contact, accepts a tech person, and null clears it', async () => {
    const db = openDb(':memory:');
    const app = buildApp(db);
    const contact = (await app.inject({ method: 'POST', url: '/api/resources', payload: { name: 'Mariam', side: 'business' } })).json();
    const rejected = await app.inject({ method: 'PUT', url: '/api/settings/me', payload: { resourceId: contact.id } });
    expect(rejected.statusCode).toBe(400);
    expect(rejected.json()).toEqual({ error: 'Choose someone from your tech team' });

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
});
