import { beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { buildApp } from '../app';
import { openDb } from '../db';

let db: DatabaseSync;
let app: ReturnType<typeof buildApp>;
let ids: { customer: number; goal: number; finance: number; digital: number };

beforeEach(async () => {
  db = openDb(':memory:');
  app = buildApp(db, { today: () => '2026-09-24' });
  const lists = (await app.inject({ method: 'GET', url: '/api/lists' })).json();
  const add = async (list: string, name: string) =>
    (await app.inject({ method: 'POST', url: `/api/lists/${list}`, payload: { name } })).json().id as number;
  ids = {
    customer: lists.projectType[1].id,
    goal: lists.goal[0].id,
    finance: await add('department', 'Finance'),
    digital: await add('mainProject', 'Digital Services'),
  };
});

const base = {
  name: 'Customer Portal',
  color: '#3b82f6',
  startDate: '2026-09-24',
  phases: [{ name: 'Development', durationDays: 5 }],
};

function fullBody() {
  return {
    ...base,
    jiraKey: 'PRJ-1',
    priority: 'high',
    projectManager: 'Sara Ahmed',
    businessOwner: '  ',
    mainProjectId: ids.digital,
    category: 'strategic',
    projectTypeId: ids.customer,
    goalId: ids.goal,
    departmentId: ids.finance,
    requester: { internal: true, external: true },
    beneficiary: { employees: false, customers: true },
    background: 'The portal is slow.',
    summary: 'Rebuild it.',
    scopeItems: [
      { kind: 'scope', text: 'Online payments' },
      { kind: 'objective', text: 'Cut call volume by 20%' },
      { kind: 'scope', text: 'Account page' },
    ],
  };
}

describe('project details', () => {
  it('creates a project with classification, description and numbered scope items', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/projects', payload: fullBody() });
    expect(res.statusCode).toBe(201);
    const p = res.json();
    expect(p).toMatchObject({
      priority: 'high',
      projectManager: 'Sara Ahmed',
      businessOwner: null,
      mainProject: { id: ids.digital, name: 'Digital Services' },
      category: 'strategic',
      projectType: { id: ids.customer, name: 'Customer' },
      goal: { id: ids.goal, name: 'Digitalisation of internal operations' },
      department: { id: ids.finance, name: 'Finance' },
      requester: { internal: true, external: true },
      beneficiary: { employees: false, customers: true },
      background: 'The portal is slow.',
      summary: 'Rebuild it.',
    });
    expect(p.scopeItems.map((i: { kind: string; order: number; text: string; dateAdded: string }) =>
      [i.kind, i.order, i.text, i.dateAdded])).toEqual([
      ['objective', 0, 'Cut call volume by 20%', '2026-09-24'],
      ['scope', 0, 'Online payments', '2026-09-24'],
      ['scope', 1, 'Account page', '2026-09-24'],
    ]);
  });

  it('gives sensible defaults to a project created with only the basics', async () => {
    const p = (await app.inject({ method: 'POST', url: '/api/projects', payload: base })).json();
    expect(p).toMatchObject({
      priority: 'medium',
      projectManager: null,
      businessOwner: null,
      mainProject: null,
      category: null,
      projectType: null,
      goal: null,
      department: null,
      requester: { internal: false, external: false },
      beneficiary: { employees: false, customers: false },
      background: '',
      summary: '',
      scopeItems: [],
    });
  });

  it('rejects a list value that does not exist or belongs to another list', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/projects', payload: { ...base, projectTypeId: ids.goal, departmentId: 9999 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().issues).toEqual([
      { path: 'projectTypeId', message: 'Unknown project type' },
      { path: 'departmentId', message: 'Unknown business user (department)' },
    ]);
  });

  it('updates details and scope items without touching phases, keeping the date kept items were added', async () => {
    const created = (await app.inject({ method: 'POST', url: '/api/projects', payload: fullBody() })).json();
    const [objective, payments] = created.scopeItems;
    const later = buildApp(db, { today: () => '2026-10-01' });

    const res = await later.inject({
      method: 'PUT',
      url: `/api/projects/${created.id}/details`,
      payload: {
        ...fullBody(),
        name: 'Customer Portal v2',
        priority: 'low',
        mainProjectId: null,
        scopeItems: [
          { id: objective.id, kind: 'objective', text: 'Cut call volume by 25%' },
          { kind: 'out-of-scope', text: 'Mobile app' },
          { id: payments.id, kind: 'scope', text: 'Online payments' },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const p = res.json();
    expect(p).toMatchObject({ name: 'Customer Portal v2', priority: 'low', mainProject: null });
    expect(p.phases).toEqual(created.phases);
    const keptIds = [objective.id, payments.id];
    expect(p.scopeItems.map((i: { id: number; kind: string; text: string; dateAdded: string }) =>
      [keptIds.includes(i.id) ? 'kept' : 'new', i.kind, i.text, i.dateAdded])).toEqual([
      ['kept', 'objective', 'Cut call volume by 25%', '2026-09-24'],
      ['new', 'out-of-scope', 'Mobile app', '2026-10-01'],
      ['kept', 'scope', 'Online payments', '2026-09-24'],
    ]);
  });

  it('returns 404 for an unknown project and 400 for invalid details', async () => {
    const missing = await app.inject({ method: 'PUT', url: '/api/projects/999/details', payload: base });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toEqual({ error: 'Project not found' });

    const created = (await app.inject({ method: 'POST', url: '/api/projects', payload: base })).json();
    const invalid = await app.inject({
      method: 'PUT',
      url: `/api/projects/${created.id}/details`,
      payload: { ...base, name: '', scopeItems: [{ kind: 'scope', text: ' ' }] },
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json().issues.map((i: { path: string }) => i.path)).toEqual(['name', 'scopeItems.0.text']);
  });

  it('will not delete a list value that a project uses', async () => {
    await app.inject({ method: 'POST', url: '/api/projects', payload: fullBody() });
    const res = await app.inject({ method: 'DELETE', url: `/api/lists/department/${ids.finance}` });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: '"Finance" is used by 1 project' });
  });
});
