import { beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { buildApp } from '../app';
import { openDb } from '../db';

let db: DatabaseSync;
beforeEach(() => {
  db = openDb(':memory:');
});

const names = (values: { name: string }[]) => values.map((v) => v.name);

describe('lists API', () => {
  it('starts with the default project types and goal', async () => {
    const lists = (await buildApp(db).inject({ method: 'GET', url: '/api/lists' })).json();
    expect(names(lists.projectType)).toEqual(['Criminal', 'Customer', 'Management']);
    expect(names(lists.goal)).toEqual(['Digitalisation of internal operations']);
    expect(lists.mainProject).toEqual([]);
    expect(lists.department).toEqual([]);
  });

  it('adds a trimmed value at the end of its list', async () => {
    const res = await buildApp(db).inject({ method: 'POST', url: '/api/lists/projectType', payload: { name: '  Infrastructure ' } });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ id: expect.any(Number), list: 'projectType', name: 'Infrastructure', order: 3 });
  });

  it('returns the existing value when the name is already there, ignoring case', async () => {
    const app = buildApp(db);
    const first = (await app.inject({ method: 'POST', url: '/api/lists/department', payload: { name: 'Finance' } })).json();
    const again = await app.inject({ method: 'POST', url: '/api/lists/department', payload: { name: 'finance' } });
    expect(again.statusCode).toBe(200);
    expect(again.json()).toEqual(first);
    const lists = (await app.inject({ method: 'GET', url: '/api/lists' })).json();
    expect(lists.department).toHaveLength(1);
  });

  it('rejects an empty name and an unknown list', async () => {
    const app = buildApp(db);
    const empty = await app.inject({ method: 'POST', url: '/api/lists/goal', payload: { name: '   ' } });
    expect(empty.statusCode).toBe(400);
    expect(empty.json().issues).toEqual([{ path: 'name', message: 'Name is required' }]);
    const unknown = await app.inject({ method: 'POST', url: '/api/lists/colours', payload: { name: 'Red' } });
    expect(unknown.statusCode).toBe(404);
    expect(unknown.json()).toEqual({ error: 'Unknown list' });
  });

  it('renames a value, refusing a name that is already taken', async () => {
    const app = buildApp(db);
    const customer = (await app.inject({ method: 'GET', url: '/api/lists' })).json().projectType[1];
    const ok = await app.inject({ method: 'PUT', url: `/api/lists/projectType/${customer.id}`, payload: { name: 'Customer services' } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual({ ...customer, name: 'Customer services' });
    const clash = await app.inject({ method: 'PUT', url: `/api/lists/projectType/${customer.id}`, payload: { name: 'criminal' } });
    expect(clash.statusCode).toBe(409);
    expect(clash.json()).toEqual({ error: '"Criminal" already exists' });
  });

  it('only changes a value through its own list', async () => {
    const app = buildApp(db);
    const goal = (await app.inject({ method: 'GET', url: '/api/lists' })).json().goal[0];
    const res = await app.inject({ method: 'PUT', url: `/api/lists/projectType/${goal.id}`, payload: { name: 'X' } });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'Value not found' });
  });

  it('deletes an unused value but refuses one that a project uses', async () => {
    const app = buildApp(db);
    const [criminal, customer] = (await app.inject({ method: 'GET', url: '/api/lists' })).json().projectType;
    db.prepare(
      "INSERT INTO projects (name, color, start_date, created_at, project_type_id) VALUES ('P', '#000000', '2026-01-05', 'x', ?)",
    ).run(criminal.id);

    const refused = await app.inject({ method: 'DELETE', url: `/api/lists/projectType/${criminal.id}` });
    expect(refused.statusCode).toBe(409);
    expect(refused.json()).toEqual({ error: '"Criminal" is used by 1 project' });

    const deleted = await app.inject({ method: 'DELETE', url: `/api/lists/projectType/${customer.id}` });
    expect(deleted.statusCode).toBe(204);
    const lists = (await app.inject({ method: 'GET', url: '/api/lists' })).json();
    expect(names(lists.projectType)).toEqual(['Criminal', 'Management']);
  });

  it('starts with the default phases, Design last', async () => {
    const lists = (await buildApp(db).inject({ method: 'GET', url: '/api/lists' })).json();
    expect(names(lists.phase)).toEqual([
      'Requirements gathering', 'Business analysis', 'Development plan', 'Development', 'QA', 'UAT',
      'Security testing', 'Deployment', 'Launch', 'Design',
    ]);
  });

  it('treats a phase as in use when a project has a phase with that name, and renames it on projects too', async () => {
    const app = buildApp(db);
    await app.inject({
      method: 'POST', url: '/api/projects',
      payload: { name: 'P', color: '#000000', startDate: '2026-01-05', phases: [{ name: 'development', durationDays: 5 }] },
    });
    const development = (await app.inject({ method: 'GET', url: '/api/lists' })).json()
      .phase.find((v: { name: string }) => v.name === 'Development');

    const refused = await app.inject({ method: 'DELETE', url: `/api/lists/phase/${development.id}` });
    expect(refused.statusCode).toBe(409);
    expect(refused.json()).toEqual({ error: '"Development" is used by 1 project' });

    const renamed = await app.inject({ method: 'PUT', url: `/api/lists/phase/${development.id}`, payload: { name: 'Build' } });
    expect(renamed.statusCode).toBe(200);
    const project = (await app.inject({ method: 'GET', url: '/api/projects' })).json()[0];
    expect(project.phases[0].name).toBe('Build');
  });

  it('does not count a sub-phase name as a used Phases-list value, and does not rename a sub-phase when renaming it', async () => {
    const app = buildApp(db);
    await app.inject({
      method: 'POST', url: '/api/projects',
      payload: {
        name: 'P', color: '#000000', startDate: '2026-01-05',
        phases: [{ name: 'Development', durationDays: 5, subPhases: [{ name: 'QA', durationDays: 2 }] }],
      },
    });
    const qaValue = (await app.inject({ method: 'GET', url: '/api/lists' })).json()
      .phase.find((v: { name: string }) => v.name === 'QA');

    const deleted = await app.inject({ method: 'DELETE', url: `/api/lists/phase/${qaValue.id}` });
    expect(deleted.statusCode).toBe(204);

    const readded = (await app.inject({ method: 'POST', url: '/api/lists/phase', payload: { name: 'QA' } })).json();
    const renamed = await app.inject({ method: 'PUT', url: `/api/lists/phase/${readded.id}`, payload: { name: 'Quality Assurance' } });
    expect(renamed.statusCode).toBe(200);
    const project = (await app.inject({ method: 'GET', url: '/api/projects' })).json()[0];
    expect(project.phases[0].subPhases[0].name).toBe('QA');
  });
});
