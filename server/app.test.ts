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
