import { beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { DEFAULT_CALENDAR } from '../../shared/calendar';
import { entryInputSchema, newProjectSchema, resourceInputSchema, scheduleUpdateSchema, toDoInputSchema } from '../../shared/schemas';
import type { ProjectRecord } from '../../shared/types';
import { openDb } from '../db';
import { createEntry, deleteEntry } from '../entries/repo';
import { createProject as createProjectRow, updateSchedule } from '../projects/repo';
import { createResource } from '../resources/repo';
import { setMe } from '../settings';
import { checkToDo, createToDo, deleteToDo, getToDo, listToDos, projectPeopleIds, updateToDo } from './repo';

let db: DatabaseSync;
let pat: { id: number };
let bea: { id: number };
let ted: { id: number };
let out: { id: number };
let me: { id: number };
let project: ProjectRecord;

beforeEach(() => {
  db = openDb(':memory:');
  pat = createResource(db, resourceInputSchema.parse({ name: 'Pat', side: 'tech' }));
  bea = createResource(db, resourceInputSchema.parse({ name: 'Bea', side: 'business' }));
  ted = createResource(db, resourceInputSchema.parse({ name: 'Ted', side: 'tech' }));
  out = createResource(db, resourceInputSchema.parse({ name: 'Out', side: 'tech' }));
  me = createResource(db, resourceInputSchema.parse({ name: 'Me', side: 'tech' }));
  setMe(db, me.id);
  project = createProject();
});

function createProject(): ProjectRecord {
  return createProjectRow(
    db,
    DEFAULT_CALENDAR,
    newProjectSchema.parse({
      name: 'Portal',
      color: '#3b82f6',
      startDate: '2026-09-25',
      projectManagerId: pat.id,
      businessPmId: bea.id,
      phases: [
        {
          name: 'Development',
          durationDays: 5,
          subPhases: [{ name: 'Increment 1', durationDays: 5, assignments: [{ resourceId: ted.id, allocation: 50 }] }],
        },
        { name: 'QA', durationDays: 3 },
      ],
    }),
  );
}

describe('checkToDo — assignees', () => {
  it('accepts the tech PM, the business PM, someone on a sub-phase, "I am" and null', () => {
    const data = (assigneeId: number | null) => toDoInputSchema.parse({ title: 'Task', assigneeId });
    expect(checkToDo(db, project.id, data(pat.id))).toEqual([]);
    expect(checkToDo(db, project.id, data(bea.id))).toEqual([]);
    expect(checkToDo(db, project.id, data(ted.id))).toEqual([]);
    expect(checkToDo(db, project.id, data(me.id))).toEqual([]);
    expect(checkToDo(db, project.id, data(null))).toEqual([]);
  });

  it('rejects someone not on the project, and an unknown id', () => {
    const data = (assigneeId: number | null) => toDoInputSchema.parse({ title: 'Task', assigneeId });
    expect(checkToDo(db, project.id, data(out.id))).toEqual([
      { path: 'assigneeId', message: "Out isn't on this project", code: 'error.personNotOnProject', params: { name: 'Out' } },
    ]);
    expect(checkToDo(db, project.id, data(999))).toEqual([{ path: 'assigneeId', message: 'Unknown person', code: 'error.unknownPerson' }]);
  });
});

describe('checkToDo — updates', () => {
  it('accepts keeping an assignee who has left the project, but rejects changing to them', () => {
    const res = db
      .prepare('INSERT INTO todos (project_id, title, assignee_id, created_at) VALUES (?, ?, ?, ?)')
      .run(project.id, 'Old task', out.id, new Date().toISOString());
    const existing = getToDo(db, Number(res.lastInsertRowid))!;
    expect(existing.assignee).toEqual({ id: out.id, name: 'Out' });

    const sameAssignee = toDoInputSchema.parse({ title: 'Old task', assigneeId: out.id });
    expect(checkToDo(db, project.id, sameAssignee, existing)).toEqual([]);

    const other = createToDo(db, project.id, toDoInputSchema.parse({ title: 'New task' }), '2026-09-25');
    const changeToOut = toDoInputSchema.parse({ title: 'New task', assigneeId: out.id });
    expect(checkToDo(db, project.id, changeToOut, other)).toEqual([
      { path: 'assigneeId', message: "Out isn't on this project", code: 'error.personNotOnProject', params: { name: 'Out' } },
    ]);
  });
});

describe('checkToDo — phases', () => {
  it('rejects a phase from another project', () => {
    const other = createProject2();
    const data = toDoInputSchema.parse({ title: 'Task', phaseId: other.phases[0].id });
    expect(checkToDo(db, project.id, data)).toEqual([{ path: 'phaseId', message: 'Unknown phase', code: 'error.unknownPhase' }]);
  });

  it("accepts the project's own sub-phase, and the record reads 'Development › Increment 1'", () => {
    const sub = project.phases[0].subPhases[0];
    const created = createToDo(db, project.id, toDoInputSchema.parse({ title: 'Task', phaseId: sub.id }), '2026-09-25');
    expect(created.phase).toEqual({
      id: sub.id, name: 'Development › Increment 1', phaseName: 'Development', subPhaseName: 'Increment 1',
    });
  });

  function createProject2(): ProjectRecord {
    return createProjectRow(
      db,
      DEFAULT_CALENDAR,
      newProjectSchema.parse({ name: 'Other', color: '#3b82f6', startDate: '2026-09-25', phases: [{ name: 'X', durationDays: 2 }] }),
    );
  }
});

describe('done date', () => {
  it('sets, keeps and clears it', () => {
    const created = createToDo(db, project.id, toDoInputSchema.parse({ title: 'Task' }), '2026-09-25');
    expect(created.done).toBe(false);
    expect(created.doneDate).toBeNull();

    const done1 = updateToDo(db, created.id, toDoInputSchema.parse({ title: 'Task', done: true }), '2026-10-07')!;
    expect(done1.done).toBe(true);
    expect(done1.doneDate).toBe('2026-10-07');

    const done2 = updateToDo(db, created.id, toDoInputSchema.parse({ title: 'Task', done: true }), '2026-10-09')!;
    expect(done2.doneDate).toBe('2026-10-07');

    const reopened = updateToDo(db, created.id, toDoInputSchema.parse({ title: 'Task', done: false }), '2026-10-09')!;
    expect(reopened.done).toBe(false);
    expect(reopened.doneDate).toBeNull();
  });

  it('is set for a to-do created already done', () => {
    const created = createToDo(db, project.id, toDoInputSchema.parse({ title: 'Task', done: true }), '2026-10-07');
    expect(created.done).toBe(true);
    expect(created.doneDate).toBe('2026-10-07');
  });
});

describe('listToDos order and filters', () => {
  it('orders open ones by due date, undated after dated, ties by id; excludes done unless asked; filters combine', () => {
    const overdue = createToDo(db, project.id, toDoInputSchema.parse({ title: 'Overdue', dueDate: '2026-10-01' }), '2026-09-25');
    const later = createToDo(db, project.id, toDoInputSchema.parse({ title: 'Later', dueDate: '2026-10-10' }), '2026-09-25');
    const undated = createToDo(db, project.id, toDoInputSchema.parse({ title: 'Undated' }), '2026-09-25');
    const done = createToDo(db, project.id, toDoInputSchema.parse({ title: 'Done', done: true }), '2026-09-25');
    const tedsTask = createToDo(db, project.id, toDoInputSchema.parse({ title: "Ted's task", assigneeId: ted.id }), '2026-09-25');

    const open = listToDos(db, { projectId: project.id });
    expect(open.map((t) => t.id)).toEqual([overdue.id, later.id, undated.id, tedsTask.id]);

    const withDone = listToDos(db, { projectId: project.id, includeDone: true });
    expect(withDone.map((t) => t.id)).toContain(done.id);
    expect(withDone).toHaveLength(5);

    const forTed = listToDos(db, { projectId: project.id, assigneeId: ted.id });
    expect(forTed.map((t) => t.id)).toEqual([tedsTask.id]);

    const forProject = listToDos(db, { projectId: project.id });
    expect(forProject.every((t) => t.projectId === project.id)).toBe(true);
  });

  it('orders same-day done to-dos by id descending', () => {
    const first = createToDo(db, project.id, toDoInputSchema.parse({ title: 'First' }), '2026-09-25');
    const second = createToDo(db, project.id, toDoInputSchema.parse({ title: 'Second' }), '2026-09-25');
    const third = createToDo(db, project.id, toDoInputSchema.parse({ title: 'Third' }), '2026-09-25');
    updateToDo(db, first.id, toDoInputSchema.parse({ title: 'First', done: true }), '2026-10-07');
    updateToDo(db, second.id, toDoInputSchema.parse({ title: 'Second', done: true }), '2026-10-07');
    updateToDo(db, third.id, toDoInputSchema.parse({ title: 'Third', done: true }), '2026-10-05');

    const done = listToDos(db, { projectId: project.id, includeDone: true }).filter((t) => t.done);
    // Newest done_date first; the two done on the same day come id-descending.
    expect(done.map((t) => t.id)).toEqual([second.id, first.id, third.id]);
  });
});

describe('removing a phase through updateSchedule', () => {
  it("keeps an open to-do (unlinked, with a former-phase note) and deletes the done one, by default", () => {
    const sub = project.phases[0].subPhases[0];
    const openToDo = createToDo(db, project.id, toDoInputSchema.parse({ title: 'Open', phaseId: sub.id }), '2026-09-25');
    const doneToDo = createToDo(db, project.id, toDoInputSchema.parse({ title: 'Done', phaseId: sub.id, done: true }), '2026-09-25');
    const qa = project.phases[1];

    const r = updateSchedule(
      db, DEFAULT_CALENDAR, project.id,
      scheduleUpdateSchema.parse({ startDate: '2026-09-25', phases: [{ id: qa.id, name: 'QA', durationDays: 3 }] }),
      '2026-09-25',
    );
    expect(r.ok).toBe(true);

    const keptOpen = getToDo(db, openToDo.id)!;
    expect(keptOpen.phase).toBeNull();
    expect(keptOpen.formerPhase).toEqual({
      name: 'Development › Increment 1', phaseName: 'Development', subPhaseName: 'Increment 1', removedOn: '2026-09-25',
    });
    expect(getToDo(db, doneToDo.id)).toBeUndefined();
  });

  it("deletes both the open and the done to-do when removedToDos is 'delete'", () => {
    const sub = project.phases[0].subPhases[0];
    const openToDo = createToDo(db, project.id, toDoInputSchema.parse({ title: 'Open', phaseId: sub.id }), '2026-09-25');
    const doneToDo = createToDo(db, project.id, toDoInputSchema.parse({ title: 'Done', phaseId: sub.id, done: true }), '2026-09-25');
    const qa = project.phases[1];

    const r = updateSchedule(
      db, DEFAULT_CALENDAR, project.id,
      scheduleUpdateSchema.parse({
        startDate: '2026-09-25', phases: [{ id: qa.id, name: 'QA', durationDays: 3 }], removedToDos: 'delete',
      }),
      '2026-09-25',
    );
    expect(r.ok).toBe(true);
    expect(getToDo(db, openToDo.id)).toBeUndefined();
    expect(getToDo(db, doneToDo.id)).toBeUndefined();
  });

  it("uses the pre-rename name for a removed sub-phase's formerPhase, even when the parent is renamed in the same call", () => {
    const dev = project.phases[0];
    const sub = dev.subPhases[0];
    const openToDo = createToDo(db, project.id, toDoInputSchema.parse({ title: 'Open', phaseId: sub.id }), '2026-09-25');
    const qa = project.phases[1];

    const r = updateSchedule(
      db, DEFAULT_CALENDAR, project.id,
      scheduleUpdateSchema.parse({
        startDate: '2026-09-25',
        phases: [
          { id: dev.id, name: 'Dev NEW', durationDays: 5 },
          { id: qa.id, name: 'QA', durationDays: 3 },
        ],
      }),
      '2026-09-25',
    );
    expect(r.ok).toBe(true);

    const kept = getToDo(db, openToDo.id)!;
    expect(kept.phase).toBeNull();
    expect(kept.formerPhase).toEqual({
      name: 'Development › Increment 1', phaseName: 'Development', subPhaseName: 'Increment 1', removedOn: '2026-09-25',
    });
  });

  it('leaves everything unchanged when updateSchedule fails validation (an unknown id)', () => {
    const sub = project.phases[0].subPhases[0];
    createToDo(db, project.id, toDoInputSchema.parse({ title: 'Open', phaseId: sub.id }), '2026-09-25');
    createToDo(db, project.id, toDoInputSchema.parse({ title: 'Done', phaseId: sub.id, done: true }), '2026-09-25');
    const qa = project.phases[1];
    const before = listToDos(db, { includeDone: true });

    const r = updateSchedule(
      db, DEFAULT_CALENDAR, project.id,
      scheduleUpdateSchema.parse({ startDate: '2026-09-25', phases: [{ id: 999999, name: 'QA', durationDays: 3 }, { id: qa.id, name: 'QA', durationDays: 3 }] }),
      '2026-09-25',
    );
    expect(r.ok).toBe(false);

    const after = listToDos(db, { includeDone: true });
    expect(after).toEqual(before);
  });

  it('leaves a kept-but-renamed phase\'s to-do untouched', () => {
    const dev = project.phases[0];
    const sub = dev.subPhases[0];
    const onDev = createToDo(db, project.id, toDoInputSchema.parse({ title: 'On dev', phaseId: dev.id }), '2026-09-25');
    const qa = project.phases[1];

    const r = updateSchedule(
      db, DEFAULT_CALENDAR, project.id,
      scheduleUpdateSchema.parse({
        startDate: '2026-09-25',
        phases: [
          { id: dev.id, name: 'Development renamed', durationDays: 5, subPhases: [{ id: sub.id, name: 'Increment 1', durationDays: 5 }] },
          { id: qa.id, name: 'QA', durationDays: 3 },
        ],
      }),
      '2026-09-25',
    );
    expect(r.ok).toBe(true);

    const kept = getToDo(db, onDev.id)!;
    expect(kept.phase).toEqual({ id: dev.id, name: 'Development renamed', phaseName: 'Development renamed', subPhaseName: null });
    expect(kept.formerPhase).toBeNull();
  });
});

describe('relinking', () => {
  it('clears formerPhase when a kept to-do is given a phaseId again', () => {
    const sub = project.phases[0].subPhases[0];
    const openToDo = createToDo(db, project.id, toDoInputSchema.parse({ title: 'Open', phaseId: sub.id }), '2026-09-25');
    const qa = project.phases[1];
    updateSchedule(
      db, DEFAULT_CALENDAR, project.id,
      scheduleUpdateSchema.parse({ startDate: '2026-09-25', phases: [{ id: qa.id, name: 'QA', durationDays: 3 }] }),
      '2026-09-25',
    );
    const removed = getToDo(db, openToDo.id)!;
    expect(removed.formerPhase).not.toBeNull();

    const relinked = updateToDo(db, openToDo.id, toDoInputSchema.parse({ title: 'Open', phaseId: qa.id }), '2026-09-25')!;
    expect(relinked.phase).toEqual({ id: qa.id, name: 'QA', phaseName: 'QA', subPhaseName: null });
    expect(relinked.formerPhase).toBeNull();
  });
});

describe('the fromRemovedPhases filter', () => {
  it('returns only to-dos with a former phase', () => {
    const sub = project.phases[0].subPhases[0];
    const openToDo = createToDo(db, project.id, toDoInputSchema.parse({ title: 'Open', phaseId: sub.id }), '2026-09-25');
    const untouched = createToDo(db, project.id, toDoInputSchema.parse({ title: 'Untouched' }), '2026-09-25');
    const qa = project.phases[1];
    updateSchedule(
      db, DEFAULT_CALENDAR, project.id,
      scheduleUpdateSchema.parse({ startDate: '2026-09-25', phases: [{ id: qa.id, name: 'QA', durationDays: 3 }] }),
      '2026-09-25',
    );
    const removed = listToDos(db, { fromRemovedPhases: true });
    expect(removed.map((t) => t.id)).toEqual([openToDo.id]);
    expect(removed.map((t) => t.id)).not.toContain(untouched.id);
  });
});

describe('deleting the project', () => {
  it('deletes its to-dos', () => {
    const created = createToDo(db, project.id, toDoInputSchema.parse({ title: 'Task' }), '2026-09-25');
    db.prepare('DELETE FROM projects WHERE id = ?').run(project.id);
    expect(getToDo(db, created.id)).toBeUndefined();
  });
});

describe('sourceEntry (M7)', () => {
  it('carries the meeting it came from, and clears when the meeting is deleted', () => {
    const entry = createEntry(
      db, project.id,
      entryInputSchema.parse({
        type: 'meeting', effectiveDate: '2026-09-26', title: 'Kickoff', followUps: [{ title: 'Follow up' }],
      }),
    );
    const todoId = entry.followUpToDoIds[0];
    expect(getToDo(db, todoId)!.sourceEntry).toEqual({ id: entry.id, title: 'Kickoff', effectiveDate: '2026-09-26' });

    deleteEntry(db, entry.id);
    expect(getToDo(db, todoId)!.sourceEntry).toBeNull();
  });

  it('is null for a to-do created directly, not from a meeting', () => {
    const created = createToDo(db, project.id, toDoInputSchema.parse({ title: 'Task' }), '2026-09-25');
    expect(created.sourceEntry).toBeNull();
  });
});

describe('projectPeopleIds and deleteToDo', () => {
  it('includes the PMs, an assigned person, and "I am"', () => {
    const ids = projectPeopleIds(db, project.id);
    expect(ids.has(pat.id)).toBe(true);
    expect(ids.has(bea.id)).toBe(true);
    expect(ids.has(ted.id)).toBe(true);
    expect(ids.has(me.id)).toBe(true);
    expect(ids.has(out.id)).toBe(false);
  });

  it('deletes a to-do and reports when there was none', () => {
    const created = createToDo(db, project.id, toDoInputSchema.parse({ title: 'Task' }), '2026-09-25');
    expect(deleteToDo(db, created.id)).toBe(true);
    expect(deleteToDo(db, created.id)).toBe(false);
  });
});
