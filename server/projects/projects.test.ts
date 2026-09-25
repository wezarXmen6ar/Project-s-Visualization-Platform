import { beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { addDays, DEFAULT_CALENDAR } from '../../shared/calendar';
import { newProjectSchema, resourceInputSchema, scheduleUpdateSchema, type ScheduleUpdateInput } from '../../shared/schemas';
import type { PhaseRecord, SubPhaseRecord } from '../../shared/types';
import { buildApp } from '../app';
import { projectAssignments } from '../assignments/repo';
import { migrate, openDb } from '../db';
import { createResource } from '../resources/repo';
import { setCalendar } from '../settings';
import { createProject, getProject, updateSchedule } from './repo';

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
      { id: expect.any(Number), name: 'Requirements', order: 0, durationDays: 2, start: '2026-09-24', end: '2026-09-25', subPhases: [] },
      { id: expect.any(Number), name: 'Development', order: 1, durationDays: 3, start: '2026-09-28', end: '2026-09-30', subPhases: [] },
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

  it('creates a project with sub-phases, and reads them back nested under their phase', async () => {
    const app = buildApp(db);
    const res = await app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: {
        ...body,
        phases: [
          { name: 'Requirements', durationDays: 2 },
          {
            name: 'Development', durationDays: 99,
            subPhases: [
              { name: 'Increment 1', durationDays: 5 },
              { name: 'Increment 2', durationDays: 5, withPrevious: true },
            ],
          },
        ],
      },
    });
    expect(res.statusCode).toBe(201);
    const project = res.json();
    expect(project.phases).toHaveLength(2);
    const dev = project.phases[1];
    expect(dev.name).toBe('Development');
    expect(dev.subPhases.map((s: { name: string; order: number; withPrevious: boolean }) => [s.name, s.order, s.withPrevious])).toEqual([
      ['Increment 1', 0, false],
      ['Increment 2', 1, true],
    ]);
    expect(dev.subPhases[0]).toMatchObject({ start: '2026-09-28', end: '2026-10-02' });
    expect(dev.subPhases[1]).toMatchObject({ start: '2026-09-28', end: '2026-10-02' });

    const list = (await app.inject({ method: 'GET', url: '/api/projects' })).json();
    expect(list[0].phases[1].subPhases).toHaveLength(2);
  });

  it('has an assignment on a phase and one on a sub-phase, the sub-phase one keyed to the sub-phase id', async () => {
    const app = buildApp(db);
    const pm = (await app.inject({ method: 'POST', url: '/api/resources', payload: { name: 'Rami', side: 'tech' } })).json();
    const dev2 = (await app.inject({ method: 'POST', url: '/api/resources', payload: { name: 'Fatima', side: 'tech' } })).json();
    const res = await app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: {
        ...body,
        phases: [
          { name: 'Requirements', durationDays: 2 },
          {
            name: 'Development', durationDays: 5, assignments: [{ resourceId: pm.id, allocation: 30 }],
            subPhases: [{ name: 'Increment 1', durationDays: 5, assignments: [{ resourceId: dev2.id, allocation: 60 }] }],
          },
        ],
      },
    });
    expect(res.statusCode).toBe(201);
    const project = res.json();
    const devPhase = project.phases[1];
    const subPhase = devPhase.subPhases[0];
    expect(project.assignments).toHaveLength(2);
    const onPhase = project.assignments.find((a: { resource: { id: number } }) => a.resource.id === pm.id);
    const onSub = project.assignments.find((a: { resource: { id: number } }) => a.resource.id === dev2.id);
    expect(onPhase.phaseId).toBe(devPhase.id);
    expect(onSub.phaseId).toBe(subPhase.id);
  });

  it('gives every phase an empty subPhases array when a project has none', async () => {
    const app = buildApp(db);
    const res = await app.inject({ method: 'POST', url: '/api/projects', payload: body });
    expect(res.statusCode).toBe(201);
    const project = res.json();
    for (const phase of project.phases) expect(phase.subPhases).toEqual([]);
  });
});

describe('updateSchedule', () => {
  let id: number;
  let a: PhaseRecord;
  let b: PhaseRecord;
  let c: PhaseRecord;
  let c1: SubPhaseRecord;
  let c2: SubPhaseRecord;
  let rami: { id: number };

  beforeEach(() => {
    rami = createResource(db, resourceInputSchema.parse({ name: 'Rami', side: 'tech' }));
    const project = createProject(
      db,
      DEFAULT_CALENDAR,
      newProjectSchema.parse({
        name: 'Portal',
        color: '#3b82f6',
        startDate: '2026-10-05',
        phases: [
          { name: 'A', durationDays: 5 },
          { name: 'B', durationDays: 5, assignments: [{ resourceId: rami.id, allocation: 30 }] },
          {
            name: 'C',
            durationDays: 5,
            subPhases: [
              { name: 'C1', durationDays: 3 },
              { name: 'C2', durationDays: 2, assignments: [{ resourceId: rami.id, allocation: 20 }] },
            ],
          },
        ],
      }),
    );
    id = project.id;
    a = project.phases[0];
    b = project.phases[1];
    c = project.phases[2];
    c1 = c.subPhases[0];
    c2 = c.subPhases[1];
  });

  it('reorders and renames phases in place, keeping their people', () => {
    const r = updateSchedule(db, DEFAULT_CALENDAR, id, scheduleUpdateSchema.parse({
      startDate: '2026-10-05',
      phases: [
        { id: b.id, name: 'B renamed', durationDays: 5 },
        { id: a.id, name: 'A', durationDays: 5 },
        { id: c.id, name: 'C', durationDays: 5, subPhases: [{ id: c1.id, name: 'C1', durationDays: 3 }, { id: c2.id, name: 'C2', durationDays: 2 }] },
      ],
    }));
    expect(r.ok).toBe(true);
    const p = getProject(db, id)!;
    expect(p.phases.map((ph) => [ph.id, ph.name, ph.start])).toEqual([
      [b.id, 'B renamed', '2026-10-05'],
      [a.id, 'A', '2026-10-12'],
      [c.id, 'C', '2026-10-19'],
    ]);
    expect(p.assignments.map((x) => x.phaseId).sort()).toEqual([b.id, c2.id].sort());
  });

  it('adds new items with fresh ids, reports only the new top-level phase in addedPhaseIds, and spans A over its new sub-phase', () => {
    const r = updateSchedule(db, DEFAULT_CALENDAR, id, scheduleUpdateSchema.parse({
      startDate: '2026-10-05',
      phases: [
        { id: a.id, name: 'A', durationDays: 5, subPhases: [{ name: 'A1', durationDays: 2 }] },
        { id: b.id, name: 'B', durationDays: 5 },
        { id: c.id, name: 'C', durationDays: 5, subPhases: [{ id: c1.id, name: 'C1', durationDays: 3 }, { id: c2.id, name: 'C2', durationDays: 2 }] },
        { name: 'D', durationDays: 3 },
      ],
    }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const p = getProject(db, id)!;
    const aPhase = p.phases.find((ph) => ph.id === a.id)!;
    const newSub = aPhase.subPhases.find((s) => s.name === 'A1')!;
    const newTop = p.phases.find((ph) => ph.name === 'D')!;
    expect(newSub.id).toEqual(expect.any(Number));
    expect(newTop.id).toEqual(expect.any(Number));
    expect(r.saved.addedPhaseIds).toEqual([newTop.id]);
    expect(aPhase.subPhases).toHaveLength(1);
    expect(aPhase.start).toBe('2026-10-05');
    expect(aPhase.end).toBe(newSub.end);
  });

  it('deletes a phase left out of the request, along with its assignment', () => {
    const r = updateSchedule(db, DEFAULT_CALENDAR, id, scheduleUpdateSchema.parse({
      startDate: '2026-10-05',
      phases: [
        { id: a.id, name: 'A', durationDays: 5 },
        { id: c.id, name: 'C', durationDays: 5, subPhases: [{ id: c1.id, name: 'C1', durationDays: 3 }, { id: c2.id, name: 'C2', durationDays: 2 }] },
      ],
    }));
    expect(r.ok).toBe(true);
    const p = getProject(db, id)!;
    expect(p.phases.map((ph) => ph.id)).not.toContain(b.id);
    expect(projectAssignments(db, id).some((asg) => asg.phaseId === b.id)).toBe(false);
  });

  it('moves a sub-phase to another phase, deleting its old phase, and keeps its assignment', () => {
    const r = updateSchedule(db, DEFAULT_CALENDAR, id, scheduleUpdateSchema.parse({
      startDate: '2026-10-05',
      phases: [
        { id: a.id, name: 'A', durationDays: 5, subPhases: [{ id: c2.id, name: 'C2', durationDays: 2 }] },
        { id: b.id, name: 'B', durationDays: 5 },
      ],
    }));
    expect(r.ok).toBe(true);
    const p = getProject(db, id)!;
    expect(p.phases.map((ph) => ph.id)).not.toContain(c.id);
    const aPhase = p.phases.find((ph) => ph.id === a.id)!;
    expect(aPhase.subPhases.map((s) => s.id)).toEqual([c2.id]);
    expect(p.assignments.some((asg) => asg.phaseId === c2.id)).toBe(true);
    expect(db.prepare('SELECT id FROM phases WHERE id = ?').get(c1.id)).toBeUndefined();
  });

  it('moves every phase and sub-phase by one week when the start date changes', () => {
    const before = getProject(db, id)!;
    const r = updateSchedule(db, DEFAULT_CALENDAR, id, scheduleUpdateSchema.parse({
      startDate: '2026-10-12',
      phases: [
        { id: a.id, name: 'A', durationDays: 5 },
        { id: b.id, name: 'B', durationDays: 5 },
        { id: c.id, name: 'C', durationDays: 5, subPhases: [{ id: c1.id, name: 'C1', durationDays: 3 }, { id: c2.id, name: 'C2', durationDays: 2 }] },
      ],
    }));
    expect(r.ok).toBe(true);
    const after = getProject(db, id)!;
    expect(after.startDate).toBe('2026-10-12');
    for (const ph of before.phases) {
      const match = after.phases.find((p) => p.id === ph.id)!;
      expect(match.start).toBe(addDays(ph.start, 7));
      for (const sub of ph.subPhases) {
        const matchSub = match.subPhases.find((s) => s.id === sub.id)!;
        expect(matchSub.start).toBe(addDays(sub.start, 7));
      }
    }
  });

  it('rejects unknown or misplaced ids and changes nothing', () => {
    const other = createProject(
      db,
      DEFAULT_CALENDAR,
      newProjectSchema.parse({ name: 'Other', color: '#3b82f6', startDate: '2026-10-05', phases: [{ name: 'X', durationDays: 2 }] }),
    );
    const before = getProject(db, id)!;

    const cases: { input: ScheduleUpdateInput; path: string; message: string }[] = [
      {
        input: { startDate: '2026-10-05', phases: [{ id: other.phases[0].id, name: 'A', durationDays: 5 }] },
        path: 'phases.0.id',
        message: 'Unknown phase',
      },
      {
        input: { startDate: '2026-10-05', phases: [{ id: c1.id, name: 'A', durationDays: 5 }] },
        path: 'phases.0.id',
        message: 'Unknown phase',
      },
      {
        input: {
          startDate: '2026-10-05',
          phases: [{ id: a.id, name: 'A', durationDays: 5, subPhases: [{ id: b.id, name: 'S', durationDays: 2 }] }],
        },
        path: 'phases.0.subPhases.0.id',
        message: 'Unknown sub-phase',
      },
      {
        input: {
          startDate: '2026-10-05',
          phases: [{ id: a.id, name: 'A', durationDays: 5 }, { id: a.id, name: 'A again', durationDays: 5 }],
        },
        path: 'phases.1.id',
        message: 'The same phase appears twice',
      },
    ];
    for (const { input, path, message } of cases) {
      const r = updateSchedule(db, DEFAULT_CALENDAR, id, scheduleUpdateSchema.parse(input));
      expect(r.ok).toBe(false);
      if (r.ok) continue;
      expect(r.status).toBe(400);
      if (r.status !== 400) continue;
      expect(r.issues).toContainEqual({ path, message });
    }
    expect(getProject(db, id)).toEqual(before);
  });

  it('returns 404 for a project that does not exist', () => {
    const r = updateSchedule(db, DEFAULT_CALENDAR, 999999, scheduleUpdateSchema.parse({
      startDate: '2026-10-05',
      phases: [{ name: 'A', durationDays: 2 }],
    }));
    expect(r).toEqual({ ok: false, status: 404, error: 'Project not found' });
  });
});
