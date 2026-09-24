import { beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { buildApp } from '../app';
import { migrate, openDb } from '../db';
import { setCalendar } from '../settings';

const body = {
  name: 'Customer Portal',
  jiraKey: 'PRJ-1',
  color: '#3b82f6',
  startDate: '2026-09-24',
  phases: [
    { name: 'Requirements', durationDays: 2 },
    { name: 'Development', durationDays: 3 },
  ],
};

let db: DatabaseSync;
beforeEach(() => {
  db = openDb(':memory:');
});

describe('projects API', () => {
  it('creates a project and schedules its phases on working days', async () => {
    const app = buildApp(db);
    const res = await app.inject({ method: 'POST', url: '/api/projects', payload: body });
    expect(res.statusCode).toBe(201);
    const project = res.json();
    expect(project).toMatchObject({ name: 'Customer Portal', jiraKey: 'PRJ-1', color: '#3b82f6', startDate: '2026-09-24' });
    expect(project.phases).toEqual([
      { id: expect.any(Number), name: 'Requirements', order: 0, durationDays: 2, start: '2026-09-24', end: '2026-09-25' },
      { id: expect.any(Number), name: 'Development', order: 1, durationDays: 3, start: '2026-09-28', end: '2026-09-30' },
    ]);
  });

  it('lists and fetches projects', async () => {
    const app = buildApp(db);
    const created = (await app.inject({ method: 'POST', url: '/api/projects', payload: body })).json();
    const list = (await app.inject({ method: 'GET', url: '/api/projects' })).json();
    expect(list).toHaveLength(1);
    const one = await app.inject({ method: 'GET', url: `/api/projects/${created.id}` });
    expect(one.statusCode).toBe(200);
    expect(one.json().name).toBe('Customer Portal');
  });

  it('returns 404 for an unknown project', async () => {
    const res = await buildApp(db).inject({ method: 'GET', url: '/api/projects/999' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'Project not found' });
  });

  it('rejects invalid input with field issues', async () => {
    const res = await buildApp(db).inject({ method: 'POST', url: '/api/projects', payload: { ...body, name: '', phases: [] } });
    expect(res.statusCode).toBe(400);
    const paths = res.json().issues.map((i: { path: string }) => i.path);
    expect(paths).toEqual(expect.arrayContaining(['name', 'phases']));
  });

  it('uses the stored weekend setting', async () => {
    setCalendar(db, { weekendDays: [5, 6], holidays: [] });
    const app = buildApp(db);
    const res = await app.inject({ method: 'POST', url: '/api/projects', payload: { ...body, phases: [{ name: 'A', durationDays: 2 }] } });
    expect(res.json().phases[0].end).toBe('2026-09-27');
    const cal = (await app.inject({ method: 'GET', url: '/api/settings/calendar' })).json();
    expect(cal).toEqual({ weekendDays: [5, 6], holidays: [] });
  });

  it('can run migrations twice safely', () => {
    expect(() => migrate(db)).not.toThrow();
  });
});
