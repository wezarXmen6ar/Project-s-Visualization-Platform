import { beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { buildApp } from '../app';
import { openDb } from '../db';

let db: DatabaseSync;
let app: ReturnType<typeof buildApp>;
let people: { fatima: number; rami: number; mariam: number; gone: number };

beforeEach(async () => {
  db = openDb(':memory:');
  app = buildApp(db, { today: () => '2026-09-24' });
  const add = async (payload: object) => (await app.inject({ method: 'POST', url: '/api/resources', payload })).json().id as number;
  people = {
    fatima: await add({ name: 'Fatima Noor', side: 'tech' }),
    rami: await add({ name: 'Rami Saleh', side: 'tech', capacity: 80 }),
    mariam: await add({ name: 'Mariam Al Suwaidi', side: 'business' }),
    gone: await add({ name: 'Old Hand', side: 'tech', active: false }),
  };
});

/** 2026-10-05 is a Monday, so Development runs 5–9 Oct and QA 12–16 Oct. */
function projectWith(assignments: object[]) {
  return app.inject({
    method: 'POST',
    url: '/api/projects',
    payload: {
      name: 'Portal', color: '#3b82f6', startDate: '2026-10-05',
      phases: [{ name: 'Development', durationDays: 5, assignments }, { name: 'QA', durationDays: 5 }],
    },
  });
}

const issuesOf = (body: { issues: { path: string; message: string }[] }) => body.issues.map((i) => [i.path, i.message]);

describe('assignments', () => {
  it('creates a project with people on its phases', async () => {
    const res = await projectWith([
      { resourceId: people.fatima, allocation: 60, role: 'responsible' },
      { resourceId: people.rami, allocation: 40 },
    ]);
    expect(res.statusCode).toBe(201);
    const p = res.json();
    expect(p.assignments).toEqual([
      { id: expect.any(Number), phaseId: p.phases[0].id, resource: { id: people.fatima, name: 'Fatima Noor' }, allocation: 60, role: 'responsible' },
      { id: expect.any(Number), phaseId: p.phases[0].id, resource: { id: people.rami, name: 'Rami Saleh' }, allocation: 40, role: 'contributor' },
    ]);
    const listed = (await app.inject({ method: 'GET', url: '/api/projects' })).json();
    expect(listed[0].assignments).toHaveLength(2);
  });

  it('only lets active tech-team people be assigned', async () => {
    const res = await projectWith([
      { resourceId: people.mariam, allocation: 50 },
      { resourceId: people.gone, allocation: 50 },
      { resourceId: 9999, allocation: 50 },
    ]);
    expect(res.statusCode).toBe(400);
    expect(issuesOf(res.json())).toEqual([
      ['phases.0.assignments.0.resourceId', 'Mariam Al Suwaidi is a business contact; only the tech team can be assigned'],
      ['phases.0.assignments.1.resourceId', 'Old Hand is inactive'],
      ['phases.0.assignments.2.resourceId', 'Unknown person'],
    ]);
  });

  it('refuses the same person twice on a phase, and allocations outside 1–100%', async () => {
    const twice = await projectWith([{ resourceId: people.fatima, allocation: 50 }, { resourceId: people.fatima, allocation: 20 }]);
    expect(issuesOf(twice.json())).toEqual([['phases.0.assignments.1.resourceId', 'The same person is assigned twice to this phase']]);
    const tooMuch = await projectWith([{ resourceId: people.fatima, allocation: 120 }]);
    expect(issuesOf(tooMuch.json())).toEqual([['phases.0.assignments.0.allocation', 'Allocation must be between 1% and 100%']]);
  });

  it("replaces the people on a phase, and says when the phase doesn't exist", async () => {
    const p = (await projectWith([{ resourceId: people.fatima, allocation: 60 }])).json();
    const res = await app.inject({
      method: 'PUT', url: `/api/phases/${p.phases[0].id}/assignments`,
      payload: { assignments: [{ resourceId: people.rami, allocation: 100, role: 'responsible' }] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().assignments).toEqual([
      { id: expect.any(Number), phaseId: p.phases[0].id, resource: { id: people.rami, name: 'Rami Saleh' }, allocation: 100, role: 'responsible' },
    ]);

    const bad = await app.inject({
      method: 'PUT', url: `/api/phases/${p.phases[0].id}/assignments`,
      payload: { assignments: [{ resourceId: people.mariam, allocation: 10 }] },
    });
    expect(bad.statusCode).toBe(400);
    expect(issuesOf(bad.json())).toEqual([
      ['assignments.0.resourceId', 'Mariam Al Suwaidi is a business contact; only the tech team can be assigned'],
    ]);

    const missing = await app.inject({ method: 'PUT', url: '/api/phases/9999/assignments', payload: { assignments: [] } });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toEqual({ error: 'Phase not found' });
  });

  it('gives the heatmap its data: active tech people with leave, every assignment, the calendar and decisions', async () => {
    const p = (await projectWith([{ resourceId: people.fatima, allocation: 60, role: 'responsible' }])).json();
    await app.inject({
      method: 'POST', url: `/api/resources/${people.fatima}/leave`, payload: { start: '2026-10-12', end: '2026-10-16' },
    });
    const data = (await app.inject({ method: 'GET', url: '/api/workload' })).json();
    expect(data.calendar).toEqual({ weekendDays: [0, 6], holidays: [] });
    expect(data.resources).toEqual([
      { id: people.fatima, name: 'Fatima Noor', capacity: 100, leave: [{ start: '2026-10-12', end: '2026-10-16', note: null }] },
      { id: people.rami, name: 'Rami Saleh', capacity: 80, leave: [] },
    ]);
    expect(data.assignments).toEqual([{
      id: expect.any(Number), resourceId: people.fatima, phaseId: p.phases[0].id, projectId: p.id, projectName: 'Portal',
      phaseName: 'Development', start: '2026-10-05', end: '2026-10-09', allocation: 60, role: 'responsible',
    }]);
    expect(data.decisions).toEqual([]);
  });

  it('records an overload decision for a Monday and a tech person', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/overloads/decisions',
      payload: { resourceId: people.fatima, weekStart: '2026-10-05', decision: 'accept', note: 'Short spike' },
    });
    expect(res.statusCode).toBe(201);
    const decision = {
      id: expect.any(Number), resourceId: people.fatima, weekStart: '2026-10-05', decision: 'accept', note: 'Short spike', date: '2026-09-24',
    };
    expect(res.json()).toEqual(decision);
    expect((await app.inject({ method: 'GET', url: '/api/workload' })).json().decisions).toEqual([decision]);

    const tuesday = await app.inject({
      method: 'POST', url: '/api/overloads/decisions', payload: { resourceId: people.fatima, weekStart: '2026-10-06', decision: 'split' },
    });
    expect(tuesday.statusCode).toBe(400);
    expect(issuesOf(tuesday.json())).toEqual([['weekStart', 'Week must start on a Monday']]);

    const business = await app.inject({
      method: 'POST', url: '/api/overloads/decisions', payload: { resourceId: people.mariam, weekStart: '2026-10-05', decision: 'split' },
    });
    expect(business.statusCode).toBe(404);
    expect(business.json()).toEqual({ error: 'Person not found' });
  });

  it('lets a phase with an already-inactive person be saved again, but still refuses a newly-added inactive person', async () => {
    const p = (await projectWith([
      { resourceId: people.fatima, allocation: 60 },
      { resourceId: people.rami, allocation: 40 },
    ])).json();

    // Fatima gets deactivated after being assigned - she should stay on the phase.
    await app.inject({
      method: 'PUT', url: `/api/resources/${people.fatima}`,
      payload: { name: 'Fatima Noor', side: 'tech', active: false },
    });

    const resaved = await app.inject({
      method: 'PUT', url: `/api/phases/${p.phases[0].id}/assignments`,
      payload: {
        assignments: [
          { resourceId: people.fatima, allocation: 60 },
          { resourceId: people.rami, allocation: 70 },
        ],
      },
    });
    expect(resaved.statusCode).toBe(200);
    expect(resaved.json().assignments).toEqual([
      { id: expect.any(Number), phaseId: p.phases[0].id, resource: { id: people.fatima, name: 'Fatima Noor' }, allocation: 60, role: 'contributor' },
      { id: expect.any(Number), phaseId: p.phases[0].id, resource: { id: people.rami, name: 'Rami Saleh' }, allocation: 70, role: 'contributor' },
    ]);

    // Adding a different, already-inactive person to the same phase is still rejected.
    const withNewInactive = await app.inject({
      method: 'PUT', url: `/api/phases/${p.phases[0].id}/assignments`,
      payload: {
        assignments: [
          { resourceId: people.fatima, allocation: 60 },
          { resourceId: people.gone, allocation: 40 },
        ],
      },
    });
    expect(withNewInactive.statusCode).toBe(400);
    expect(issuesOf(withNewInactive.json())).toEqual([['assignments.1.resourceId', 'Old Hand is inactive']]);
  });

  it('will not delete someone who is assigned to a phase', async () => {
    await projectWith([{ resourceId: people.fatima, allocation: 60 }]);
    const res = await app.inject({ method: 'DELETE', url: `/api/resources/${people.fatima}` });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({
      error: "Fatima Noor can't be deleted because they are assigned to 1 phase. Make them inactive instead.",
    });
  });
});
