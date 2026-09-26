import { beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { buildApp } from '../app';
import { openDb } from '../db';
import { getMe, setMe } from '../settings';
import { listResources } from './repo';

let db: DatabaseSync;
let app: ReturnType<typeof buildApp>;
let roles: Record<string, number>;

beforeEach(async () => {
  db = openDb(':memory:');
  app = buildApp(db);
  const lists = (await app.inject({ method: 'GET', url: '/api/lists' })).json();
  roles = Object.fromEntries(lists.role.map((v: { id: number; name: string }) => [v.name, v.id]));
});

const post = (payload: object) => app.inject({ method: 'POST', url: '/api/resources', payload });

describe('resources API', () => {
  it('starts with the default roles', () => {
    expect(Object.keys(roles)).toEqual([
      'Project manager', 'Tech lead', 'Business analyst', 'Developer', 'Designer', 'QA', 'DB engineer', 'InfoSec',
    ]);
  });

  it('adds a tech-team person with a role, specialisation and capacity', async () => {
    const res = await post({
      name: ' Fatima Noor ', side: 'tech', roleId: roles.Developer, specialisation: 'front-end',
      email: 'fatima@example.com', capacity: 80,
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({
      id: expect.any(Number), name: 'Fatima Noor', side: 'tech', employment: 'staff', role: { id: roles.Developer, name: 'Developer' },
      specialisation: 'front-end', email: 'fatima@example.com', phone: null, capacity: 80, active: true, leave: [],
      projects: [], company: null, engagementProject: null, engagementStart: null, engagementEnd: null, engagement: null,
      residence: null,
    });
  });

  it('adds a business-side contact with a normalised UAE mobile, ignoring role, specialisation and capacity', async () => {
    const res = await post({
      name: 'Mariam Al Suwaidi', side: 'business', roleId: roles.Developer, specialisation: 'back-end', capacity: 50,
      phone: '050 123 4567',
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ side: 'business', role: null, specialisation: null, capacity: 100, phone: '+971 50 123 4567' });
  });

  it('rejects a missing name, a bad phone, a capacity out of range and a role from another list', async () => {
    const bad = await post({ name: ' ', side: 'tech', capacity: 0, phone: '04 123 4567' });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().issues.map((i: { path: string; message: string }) => [i.path, i.message])).toEqual([
      ['name', 'Name is required'],
      ['phone', 'Enter a UAE mobile number, e.g. +971 50 123 4567'],
      ['capacity', 'Capacity must be between 1% and 100%'],
    ]);

    const goal = (await app.inject({ method: 'GET', url: '/api/lists' })).json().goal[0];
    const wrongList = await post({ name: 'X', side: 'tech', roleId: goal.id });
    expect(wrongList.statusCode).toBe(400);
    expect(wrongList.json().issues).toEqual([{ path: 'roleId', message: 'Unknown role', code: 'error.unknownRole' }]);
  });

  it('lists the tech team first, then business contacts, each by name', async () => {
    await post({ name: 'Zaid', side: 'business' });
    await post({ name: 'Omar', side: 'tech' });
    await post({ name: 'aisha', side: 'tech' });
    const names = (await app.inject({ method: 'GET', url: '/api/resources' })).json().map((r: { name: string }) => r.name);
    expect(names).toEqual(['aisha', 'Omar', 'Zaid']);
  });

  it('updates a person and returns 404 for an unknown one', async () => {
    const created = (await post({ name: 'Omar', side: 'tech' })).json();
    const res = await app.inject({
      method: 'PUT', url: `/api/resources/${created.id}`,
      payload: { name: 'Omar Haddad', side: 'tech', roleId: roles['Project manager'], active: false },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ name: 'Omar Haddad', role: { name: 'Project manager' }, active: false });
    const missing = await app.inject({ method: 'PUT', url: '/api/resources/999', payload: { name: 'X', side: 'tech' } });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toEqual({ error: 'Person not found', code: 'error.personNotFound' });
  });

  it("refuses to switch an in-use person's side, but allows other edits", async () => {
    const pm = (await post({ name: 'Fatima', side: 'tech' })).json();
    const project = await app.inject({
      method: 'POST', url: '/api/projects',
      payload: {
        name: 'Portal', color: '#3b82f6', startDate: '2026-10-05', projectManagerId: pm.id,
        phases: [{ name: 'Development', durationDays: 5 }],
      },
    });
    expect(project.statusCode).toBe(201);

    const switched = await app.inject({
      method: 'PUT', url: `/api/resources/${pm.id}`,
      payload: { name: 'Fatima', side: 'business' },
    });
    expect(switched.statusCode).toBe(409);
    expect(switched.json()).toEqual({
      error: "Fatima can't change side because they are a project manager on 1 project.",
      code: 'error.personInUseSideChange',
      params: { name: 'Fatima', reasons: [{ code: 'error.reasonPmOnProjects', count: 1 }] },
    });

    const renamed = await app.inject({
      method: 'PUT', url: `/api/resources/${pm.id}`,
      payload: { name: 'Fatima Noor', side: 'tech' },
    });
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json()).toMatchObject({ name: 'Fatima Noor', side: 'tech' });
  });

  it("refuses to switch a tech person's side to business when they have an account, with error.reasonHasAccounts", async () => {
    const tech = (await post({ name: 'Fatima', side: 'tech' })).json();
    const lists = (await app.inject({ method: 'GET', url: '/api/lists' })).json();
    const typeId = lists.accountType[0].id;
    const created = await app.inject({
      method: 'POST', url: `/api/resources/${tech.id}/accounts`, payload: { typeId, expiryDate: '2026-12-01' },
    });
    expect(created.statusCode).toBe(201);

    const switched = await app.inject({
      method: 'PUT', url: `/api/resources/${tech.id}`, payload: { name: 'Fatima', side: 'business' },
    });
    expect(switched.statusCode).toBe(409);
    expect(switched.json().code).toBe('error.personInUseSideChange');
    expect(switched.json().params.reasons).toEqual([{ code: 'error.reasonHasAccounts', count: 1 }]);
  });

  it('records leave, refuses an end before the start, and removes leave', async () => {
    const person = (await post({ name: 'Fatima', side: 'tech' })).json();
    const added = await app.inject({
      method: 'POST', url: `/api/resources/${person.id}/leave`,
      payload: { start: '2026-10-12', end: '2026-10-16', note: 'Annual leave' },
    });
    expect(added.statusCode).toBe(201);
    expect(added.json()).toEqual({ id: expect.any(Number), start: '2026-10-12', end: '2026-10-16', note: 'Annual leave' });

    const backwards = await app.inject({
      method: 'POST', url: `/api/resources/${person.id}/leave`, payload: { start: '2026-10-16', end: '2026-10-12' },
    });
    expect(backwards.statusCode).toBe(400);
    expect(backwards.json().issues).toEqual([{ path: 'end', message: 'End date must be on or after the start date', code: 'validation.endDateAfterStart' }]);

    const noPerson = await app.inject({
      method: 'POST', url: '/api/resources/999/leave', payload: { start: '2026-10-12', end: '2026-10-12' },
    });
    expect(noPerson.statusCode).toBe(404);

    const listed = (await app.inject({ method: 'GET', url: '/api/resources' })).json()[0];
    expect(listed.leave).toEqual([added.json()]);
    expect((await app.inject({ method: 'DELETE', url: `/api/leave/${added.json().id}` })).statusCode).toBe(204);
    const again = await app.inject({ method: 'DELETE', url: `/api/leave/${added.json().id}` });
    expect(again.statusCode).toBe(404);
    expect(again.json()).toEqual({ error: 'Leave not found', code: 'error.leaveNotFound' });
  });

  it('deletes a person together with their leave', async () => {
    const person = (await post({ name: 'Temp', side: 'tech' })).json();
    await app.inject({ method: 'POST', url: `/api/resources/${person.id}/leave`, payload: { start: '2026-10-12', end: '2026-10-12' } });
    expect((await app.inject({ method: 'DELETE', url: `/api/resources/${person.id}` })).statusCode).toBe(204);
    expect((await app.inject({ method: 'GET', url: '/api/resources' })).json()).toEqual([]);
    expect((await app.inject({ method: 'DELETE', url: `/api/resources/${person.id}` })).statusCode).toBe(404);
  });

  it('will not delete a role that a person has', async () => {
    await post({ name: 'Fatima', side: 'tech', roleId: roles.Developer });
    const res = await app.inject({ method: 'DELETE', url: `/api/lists/role/${roles.Developer}` });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({
      error: '"Developer" is used by 1 person',
      code: 'error.listValueInUsePeople',
      params: { name: 'Developer', count: 1 },
    });
  });

  it("won't delete a person with a to-do, but allows switching a business contact who has one to the tech team", async () => {
    const project = (
      await app.inject({
        method: 'POST', url: '/api/projects',
        payload: { name: 'Portal', color: '#3b82f6', startDate: '2026-10-05', phases: [{ name: 'A', durationDays: 5 }] },
      })
    ).json();

    const tech = (await post({ name: 'Fatima', side: 'tech' })).json();
    await app.inject({
      method: 'PUT', url: `/api/phases/${project.phases[0].id}/assignments`,
      payload: { assignments: [{ resourceId: tech.id, allocation: 30 }] },
    });
    const created = await app.inject({
      method: 'POST', url: `/api/projects/${project.id}/todos`, payload: { title: 'Follow up', assigneeId: tech.id },
    });
    expect(created.statusCode).toBe(201);
    const deleted = await app.inject({ method: 'DELETE', url: `/api/resources/${tech.id}` });
    expect(deleted.statusCode).toBe(409);
    expect(deleted.json().error).toContain('they have 1 to-do');

    // Inserted directly: a to-do keeps its assignee even once they are no longer "on the project" in any other way
    // (see the assignee rule), which is how a business contact ends up with only a to-do to their name.
    const contact = (await post({ name: 'Mariam', side: 'business' })).json();
    db.prepare('INSERT INTO todos (project_id, title, assignee_id, created_at) VALUES (?, ?, ?, ?)')
      .run(project.id, 'Chase invoice', contact.id, new Date().toISOString());

    const switched = await app.inject({
      method: 'PUT', url: `/api/resources/${contact.id}`, payload: { name: 'Mariam', side: 'tech' },
    });
    expect(switched.statusCode).toBe(200);
    expect(switched.json().side).toBe('tech');
  });

  it('refuses to delete a person who attended a meeting, with error.reasonAttendedMeetings', async () => {
    const project = (
      await app.inject({
        method: 'POST', url: '/api/projects',
        payload: { name: 'Portal', color: '#3b82f6', startDate: '2026-10-05', phases: [{ name: 'A', durationDays: 5 }] },
      })
    ).json();
    const attendee = (await post({ name: 'Fatima', side: 'tech' })).json();
    const meeting = await app.inject({
      method: 'POST', url: `/api/projects/${project.id}/entries`,
      payload: { type: 'meeting', effectiveDate: '2026-10-05', title: 'Kickoff', attendeeIds: [attendee.id] },
    });
    expect(meeting.statusCode).toBe(201);

    const res = await app.inject({ method: 'DELETE', url: `/api/resources/${attendee.id}` });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('error.personInUseDelete');
    expect(res.json().params.reasons).toEqual([{ code: 'error.reasonAttendedMeetings', count: 1 }]);
  });

  it('clears "I am" when that person is deleted, and a reused id never inherits it', async () => {
    const me = (await post({ name: 'Sam', side: 'tech' })).json();
    setMe(db, me.id);
    expect(getMe(db)).toEqual({ resourceId: me.id, name: 'Sam' });

    const deleted = await app.inject({ method: 'DELETE', url: `/api/resources/${me.id}` });
    expect(deleted.statusCode).toBe(204);
    expect(getMe(db)).toEqual({ resourceId: null, name: null });

    // A business contact created afterwards may land on the same (reused) id; "I am" must stay cleared.
    const contact = (await post({ name: 'A Contact', side: 'business' })).json();
    expect(getMe(db)).toEqual({ resourceId: null, name: null });

    const row = db.prepare("SELECT value FROM settings WHERE key = 'me'").get() as { value: string };
    expect(JSON.parse(row.value).resourceId).not.toBe(contact.id);
    expect(JSON.parse(row.value).resourceId).toBeNull();
  });
});

describe('outsourced people', () => {
  let outsourcedApp: ReturnType<typeof buildApp>;
  let outsourcedDb: DatabaseSync;
  let companyId: number;

  beforeEach(async () => {
    outsourcedDb = openDb(':memory:');
    outsourcedApp = buildApp(outsourcedDb, { today: () => '2026-09-24' });
    const added = await outsourcedApp.inject({ method: 'POST', url: '/api/lists/company', payload: { name: 'TechNova' } });
    companyId = added.json().id;
  });

  const postOutsourced = (payload: object) =>
    outsourcedApp.inject({
      method: 'POST', url: '/api/resources',
      payload: { name: 'Omar Farid', side: 'tech', employment: 'outsourced', companyId, ...payload },
    });

  it('requires a company for an outsourced person', async () => {
    const res = await outsourcedApp.inject({
      method: 'POST', url: '/api/resources', payload: { name: 'Omar Farid', side: 'tech', employment: 'outsourced' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().issues).toEqual([{ path: 'companyId', message: 'Company is required', code: 'validation.companyRequired' }]);
  });

  it('creates an outsourced person with their company, an optional project and engagement dates', async () => {
    const res = await postOutsourced({ engagementStart: '2026-09-01', engagementEnd: '2026-12-31' });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      name: 'Omar Farid', side: 'tech', employment: 'outsourced', company: { id: companyId, name: 'TechNova' },
      engagementProject: null, engagementStart: '2026-09-01', engagementEnd: '2026-12-31', engagement: 'engaged',
    });
  });

  it('stores a business contact submitted as outsourced as staff, dropping the company', async () => {
    const res = await outsourcedApp.inject({
      method: 'POST', url: '/api/resources',
      payload: { name: 'Mariam', side: 'business', employment: 'outsourced', companyId },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ side: 'business', employment: 'staff', company: null, engagement: null });
  });

  it('marks an outsourced person past once their engagement has ended', async () => {
    const res = await postOutsourced({ engagementStart: '2026-01-01', engagementEnd: '2026-06-30' });
    expect(res.json()).toMatchObject({ engagement: 'past' });
  });

  it('marks an outsourced person upcoming when their engagement starts after today', async () => {
    const res = await postOutsourced({ engagementStart: '2026-11-01' });
    expect(res.json()).toMatchObject({ engagement: 'upcoming' });
  });

  it('rejects an unknown company', async () => {
    const res = await outsourcedApp.inject({
      method: 'POST', url: '/api/resources', payload: { name: 'Omar Farid', side: 'tech', employment: 'outsourced', companyId: 9999 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().issues).toEqual([{ path: 'companyId', message: 'Unknown company', code: 'error.unknownCompany' }]);
  });

  it('a company in use cannot be deleted', async () => {
    await postOutsourced({});
    const res = await outsourcedApp.inject({ method: 'DELETE', url: `/api/lists/company/${companyId}` });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({
      error: '"TechNova" is used by 1 person', code: 'error.listValueInUsePeople', params: { name: 'TechNova', count: 1 },
    });
  });

  it('lets a staff (our team) tech person keep a company they are contracted through', async () => {
    const res = await outsourcedApp.inject({
      method: 'POST', url: '/api/resources', payload: { name: 'Sara Ahmed', side: 'tech', employment: 'staff', companyId },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      side: 'tech', employment: 'staff', company: { id: companyId, name: 'TechNova' }, engagement: null,
    });
  });

  it("refuses an outsourced person as 'I am', even when active", async () => {
    const created = (await postOutsourced({})).json();
    const res = await outsourcedApp.inject({ method: 'PUT', url: '/api/settings/me', payload: { resourceId: created.id } });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'Choose someone from your tech team', code: 'error.chooseTechTeamMember' });
  });
});

describe('the projects a person is on', () => {
  async function makeProject(name: string, phaseEnd: string, opts: { assignResourceId?: number; pmId?: number } = {}) {
    const project = (
      await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: {
          name,
          color: '#3b82f6',
          startDate: '2026-01-05',
          phases: [{ name: 'Phase 1', durationDays: 1 }],
          ...(opts.pmId ? { projectManagerId: opts.pmId } : {}),
        },
      })
    ).json();
    const phaseId = project.phases[0].id;
    db.prepare('UPDATE phases SET planned_end = ? WHERE id = ?').run(phaseEnd, phaseId);
    if (opts.assignResourceId) {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/phases/${phaseId}/assignments`,
        payload: { assignments: [{ resourceId: opts.assignResourceId, allocation: 100, role: 'contributor' }] },
      });
      expect(res.statusCode).toBe(200);
    }
    return { id: project.id, name, phaseId };
  }

  const projectsFor = (id: number) => listResources(db, '2026-10-01').find((r) => r.id === id)!.projects;

  it('lists only the current project when one of two links has already ended', async () => {
    const person = (await post({ name: 'Zara', side: 'tech' })).json();
    const current = await makeProject('Current Co', '2026-10-20', { assignResourceId: person.id });
    await makeProject('Old Co', '2026-09-10', { assignResourceId: person.id });
    expect(projectsFor(person.id)).toEqual([{ id: current.id, name: 'Current Co', finished: false }]);
  });

  it('keeps the most recently finished project when nothing is current', async () => {
    const person = (await post({ name: 'Yusuf', side: 'tech' })).json();
    const old = await makeProject('Legacy App', '2026-09-10', { assignResourceId: person.id });
    expect(projectsFor(person.id)).toEqual([{ id: old.id, name: 'Legacy App', finished: true }]);
  });

  it('lists a project as current for its tech PM when the last phase ends in the future', async () => {
    const pm = (await post({ name: 'PM Person', side: 'tech' })).json();
    const project = await makeProject('Future Co', '2026-11-01', { pmId: pm.id });
    expect(projectsFor(pm.id)).toEqual([{ id: project.id, name: 'Future Co', finished: false }]);
  });

  it('is empty for a person with no links at all', async () => {
    const person = (await post({ name: 'Nobody', side: 'tech' })).json();
    expect(projectsFor(person.id)).toEqual([]);
  });
});
