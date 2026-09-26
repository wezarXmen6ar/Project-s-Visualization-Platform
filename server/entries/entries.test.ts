import { beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { DEFAULT_CALENDAR } from '../../shared/calendar';
import { entryInputSchema, newProjectSchema, resourceInputSchema } from '../../shared/schemas';
import type { ProjectRecord } from '../../shared/types';
import { openDb } from '../db';
import { createProject as createProjectRow } from '../projects/repo';
import { createResource } from '../resources/repo';
import { setMe } from '../settings';
import { getToDo } from '../todos/repo';
import { checkEntry, createEntry, deleteEntry, getEntry, listEntries, updateEntry } from './repo';

let db: DatabaseSync;
let sara: { id: number };
let bea: { id: number };
let ted: { id: number };
let out: { id: number };
let me: { id: number };
let project: ProjectRecord;

beforeEach(() => {
  db = openDb(':memory:');
  sara = createResource(db, resourceInputSchema.parse({ name: 'Sara', side: 'tech' }));
  bea = createResource(db, resourceInputSchema.parse({ name: 'Bea', side: 'business' }));
  ted = createResource(db, resourceInputSchema.parse({ name: 'Ted', side: 'tech' }));
  out = createResource(db, resourceInputSchema.parse({ name: 'Out', side: 'tech' }));
  me = createResource(db, resourceInputSchema.parse({ name: 'Me', side: 'tech' }));
  setMe(db, me.id);
  project = createProjectRow(
    db,
    DEFAULT_CALENDAR,
    newProjectSchema.parse({
      name: 'Portal',
      color: '#3b82f6',
      startDate: '2026-09-25',
      projectManagerId: sara.id,
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
});

describe('creating a meeting', () => {
  it('creates the meeting, its attendees (sorted) and its follow-up to-dos, each linked to it', () => {
    const data = entryInputSchema.parse({
      type: 'meeting',
      effectiveDate: '2026-09-26',
      title: 'Kickoff',
      attendeeIds: [ted.id, sara.id],
      followUps: [{ title: 'Send the minutes' }, { title: 'Book the room', assigneeId: ted.id }],
    });
    expect(checkEntry(db, project.id, data)).toEqual([]);
    const created = createEntry(db, project.id, data);

    expect(created.title).toBe('Kickoff');
    expect(created.attendees).toEqual([{ id: sara.id, name: 'Sara' }, { id: ted.id, name: 'Ted' }]);
    expect(created.followUpToDoIds).toHaveLength(2);

    for (const id of created.followUpToDoIds) {
      const todo = getToDo(db, id)!;
      expect(todo.sourceEntry).toEqual({ id: created.id, title: 'Kickoff', effectiveDate: '2026-09-26' });
    }
  });

  it('deduplicates attendee ids', () => {
    const data = entryInputSchema.parse({
      type: 'meeting', effectiveDate: '2026-09-26', title: 'Kickoff', attendeeIds: [ted.id, ted.id],
    });
    const created = createEntry(db, project.id, data);
    expect(created.attendees).toEqual([{ id: ted.id, name: 'Ted' }]);
  });

  it('rejects a follow-up whose assignee is not on the project, and saves nothing', () => {
    const data = entryInputSchema.parse({
      type: 'meeting',
      effectiveDate: '2026-09-26',
      title: 'Kickoff',
      followUps: [{ title: 'OK one' }, { title: 'Bad one', assigneeId: out.id }],
    });
    const issues = checkEntry(db, project.id, data);
    expect(issues).toEqual([
      { path: 'followUps.1.assigneeId', message: "Out isn't on this project", code: 'error.personNotOnProject', params: { name: 'Out' } },
    ]);
  });

  it('rejects an update with attendees', () => {
    const data = entryInputSchema.parse({
      type: 'update', effectiveDate: '2026-09-26', title: 'Status', attendeeIds: [ted.id],
    });
    expect(checkEntry(db, project.id, data)).toEqual([
      { path: 'attendeeIds', message: 'Only meetings have attendees', code: 'validation.updateHasAttendees' },
    ]);
  });

  it('rejects an unknown phase', () => {
    const data = entryInputSchema.parse({ type: 'update', effectiveDate: '2026-09-26', title: 'Status', phaseId: 999999 });
    expect(checkEntry(db, project.id, data)).toEqual([{ path: 'phaseId', message: 'Unknown phase', code: 'error.unknownPhase' }]);
  });

  it('accepts a past effective date', () => {
    const data = entryInputSchema.parse({ type: 'update', effectiveDate: '2020-01-01', title: 'Old status' });
    const created = createEntry(db, project.id, data);
    expect(created.effectiveDate).toBe('2020-01-01');
  });
});

describe('attachments', () => {
  function insertAttachment(pid: number): number {
    const res = db
      .prepare(
        `INSERT INTO attachments (project_id, original_name, stored_name, mime, size, uploaded_at)
         VALUES (?, 'a.pdf', ?, 'application/pdf', 10, ?)`,
      )
      .run(pid, `${Math.random()}-a.pdf`, new Date().toISOString());
    return Number(res.lastInsertRowid);
  }

  it('links attachmentIds on create, and unlinks (without deleting) whichever are no longer listed on update', () => {
    const attachmentId = insertAttachment(project.id);
    const created = createEntry(
      db, project.id, entryInputSchema.parse({ type: 'update', effectiveDate: '2026-09-26', title: 'Status', attachmentIds: [attachmentId] }),
    );
    expect(created.attachmentIds).toEqual([attachmentId]);

    const updated = updateEntry(
      db, created.id, entryInputSchema.parse({ type: 'update', effectiveDate: '2026-09-26', title: 'Status' }),
    )!;
    expect(updated.attachmentIds).toEqual([]);

    const stillThere = db.prepare('SELECT id FROM attachments WHERE id = ?').get(attachmentId);
    expect(stillThere).toBeTruthy();
  });

  it('rejects an attachment from another project', () => {
    const otherProject = createProjectRow(
      db, DEFAULT_CALENDAR,
      newProjectSchema.parse({ name: 'Other', color: '#3b82f6', startDate: '2026-09-25', phases: [{ name: 'A', durationDays: 5 }] }),
    );
    const attachmentId = insertAttachment(otherProject.id);
    const data = entryInputSchema.parse({ type: 'update', effectiveDate: '2026-09-26', title: 'Status', attachmentIds: [attachmentId] });
    expect(checkEntry(db, project.id, data)).toEqual([
      { path: 'attachmentIds.0', message: 'Unknown attachment', code: 'error.unknownAttachment' },
    ]);
  });
});

describe('listEntries', () => {
  it('sorts newest effective date first, then id descending', () => {
    const a = createEntry(db, project.id, entryInputSchema.parse({ type: 'update', effectiveDate: '2026-09-20', title: 'A' }));
    const b = createEntry(db, project.id, entryInputSchema.parse({ type: 'update', effectiveDate: '2026-09-26', title: 'B' }));
    const c = createEntry(db, project.id, entryInputSchema.parse({ type: 'update', effectiveDate: '2026-09-26', title: 'C' }));
    expect(listEntries(db, project.id).map((e) => e.id)).toEqual([c.id, b.id, a.id]);
  });

  it("includes a top-level phase's sub-phase entries, but a sub-phase filter returns only its own", () => {
    const dev = project.phases[0];
    const sub = dev.subPhases[0];
    const qa = project.phases[1];
    const onSub = createEntry(
      db, project.id, entryInputSchema.parse({ type: 'update', effectiveDate: '2026-09-26', title: 'On sub', phaseId: sub.id }),
    );
    const onQa = createEntry(
      db, project.id, entryInputSchema.parse({ type: 'update', effectiveDate: '2026-09-26', title: 'On QA', phaseId: qa.id }),
    );

    const forDev = listEntries(db, project.id, { phaseId: dev.id });
    expect(forDev.map((e) => e.id)).toEqual([onSub.id]);
    expect(forDev.map((e) => e.id)).not.toContain(onQa.id);

    const forSub = listEntries(db, project.id, { phaseId: sub.id });
    expect(forSub.map((e) => e.id)).toEqual([onSub.id]);
  });
});

describe('updateEntry', () => {
  it('replaces the attendees and changes the phase', () => {
    const qa = project.phases[1];
    const created = createEntry(
      db, project.id,
      entryInputSchema.parse({ type: 'meeting', effectiveDate: '2026-09-26', title: 'Kickoff', attendeeIds: [ted.id] }),
    );
    const updated = updateEntry(
      db, created.id,
      entryInputSchema.parse({ type: 'meeting', effectiveDate: '2026-09-26', title: 'Kickoff', attendeeIds: [sara.id], phaseId: qa.id }),
    )!;
    expect(updated.attendees).toEqual([{ id: sara.id, name: 'Sara' }]);
    expect(updated.phase).toEqual({ id: qa.id, name: 'QA', phaseName: 'QA', subPhaseName: null });
  });

  it('ignores followUps on update', () => {
    const created = createEntry(db, project.id, entryInputSchema.parse({ type: 'update', effectiveDate: '2026-09-26', title: 'Status' }));
    const updated = updateEntry(
      db, created.id,
      entryInputSchema.parse({ type: 'update', effectiveDate: '2026-09-26', title: 'Status', followUps: [{ title: 'Should not save' }] }),
    )!;
    expect(updated.followUpToDoIds).toEqual([]);
  });

  it('returns undefined for a missing entry', () => {
    expect(updateEntry(db, 999999, entryInputSchema.parse({ type: 'update', effectiveDate: '2026-09-26', title: 'X' }))).toBeUndefined();
  });
});

describe('deleteEntry', () => {
  it("deletes the entry and leaves its follow-up to-dos with sourceEntry null", () => {
    const created = createEntry(
      db, project.id,
      entryInputSchema.parse({
        type: 'meeting', effectiveDate: '2026-09-26', title: 'Kickoff', followUps: [{ title: 'Follow up' }],
      }),
    );
    const todoId = created.followUpToDoIds[0];

    expect(deleteEntry(db, created.id)).toBe(true);

    expect(getEntry(db, created.id)).toBeUndefined();
    const todo = getToDo(db, todoId)!;
    expect(todo.sourceEntry).toBeNull();
  });

  it('reports false when there was no such entry', () => {
    expect(deleteEntry(db, 999999)).toBe(false);
  });
});

describe('deleting the project', () => {
  it('removes its entries', () => {
    const created = createEntry(db, project.id, entryInputSchema.parse({ type: 'update', effectiveDate: '2026-09-26', title: 'Status' }));
    db.prepare('DELETE FROM projects WHERE id = ?').run(project.id);
    expect(getEntry(db, created.id)).toBeUndefined();
  });
});
