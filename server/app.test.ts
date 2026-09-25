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
