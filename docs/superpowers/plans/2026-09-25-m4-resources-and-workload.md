# Milestone 4: Resources and Workload — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep a list of people: your tech team, and business-side contacts. Let the user assign tech people to phases with an allocation %, show everyone's weekly workload as a heatmap with leave taken into account, warn about overbooking as soon as it happens, and let the user resolve an overload by splitting time, reassigning, or accepting the risk.

**Architecture:**
- **Storage:** three new schema versions.
  - Migration 5: a `role` list, plus `resources` and `leave` tables.
  - Migration 6: projects point at people for the tech PM and the business PM, and the existing name text moves into Resources.
  - Migration 7: `assignments` and a first `events` table, used for overload decisions.
- **Workload engine:** a pure engine, `shared/capacity.ts`, turns people, leave and assignments into weekly load. It runs in the browser for the heatmap and for live warnings. The server only supplies its input, from `GET /api/workload`.
- **Screens:**
  - Resources is a new page with a people table, a person form, and the heatmap.
  - Assignments are edited on the project page and in a new Step 4 of the create wizard.

**Tech Stack:** Node 24, TypeScript 5, React 19, React Router 7, Vite 6, Fastify 5, zod 3, `node:sqlite` (built in), Vitest 3, Testing Library, jsdom.

**Spec:** `docs/superpowers/specs/2026-09-24-visual-project-portfolio-design.md` (§2 Resource, Leave, Assignment, Event; §3.2 Step 4; §3.7 Resources page; the overload row of Key decisions)

**Decisions confirmed with the user (2026-09-25):**
- **Overload decision prompt:** M4 offers **Split the time**, **Reassign** and **Accept the risk**, and records each decision with its date.
  - "Pause a project" and "Delay a phase" are shown but disabled.
  - They switch on later: Delay a phase with progress and phase shifts (M7), and Pause a project with holds (M8). (Renumbered in the roadmap review, 2026-09-25.)
- **Assigning people:** on the project page at any time, since people change mid-project, and in a new **Step 4 "People"** of the create wizard.
- **Business-side people are in Resources, as business contacts.**
  - A person is either **Tech team** or **Business side**.
  - Business contacts keep a UAE mobile and an email, and are chosen as the project's business PM.
  - They are **not** counted in workload and can't be assigned to phases.
  - Both PM fields on a project become pickers from Resources.
- **Leave is in M4.** Leave days reduce what a person can give that week, so a phase that overlaps someone's leave shows up as an overbooking.

**Deliberate choices (flag if you disagree):**
- **Roles are an editable list** ("role", in Settings), seeded with:
  - Project manager
  - Tech lead
  - Business analyst
  - Developer
  - Designer
  - QA
  - DB engineer
  - InfoSec

  The spec's "business owner" role is covered by the Business side instead.
- **Specialisation** (Front end / Back end / Full stack) is a fixed, optional choice for tech people.
- **Workload is weekly, Monday to Sunday.**
  - A person's **booked %** for a week is each assignment's allocation × the working days it covers that week ÷ that week's working days.
  - Their **available %** is their capacity × (working days − leave days) ÷ working days.
  - A week is **overbooked** when booked is more than available by over 0.5 percentage points, a tolerance for rounding such as 3 × 33.4%.
- **Existing PM names are moved, not lost.** When upgrading, migration 6 turns every distinct tech PM name into a tech-team person with the Project manager role. Every distinct business PM, with their phone and email, becomes a business contact. The project then points at them.
- **People are deactivated, not deleted, once in use.** A person who is a PM on a project or assigned to a phase can't be deleted, only made inactive, so history keeps their name. Inactive people drop out of pickers and the heatmap, but stay on the projects that already name them — including surviving a later save of a phase they're already on (Task 4's `checkAssignmentPeople`, fixed post-review, 2026-09-25: the first version rejected any inactive person on every phase PUT, contradicting this rule; only a *newly added* inactive person is now rejected). A person's side also can't be changed while they're in use, for the same reason (Task 4 fix): it would silently point a project's PM or a phase's assignment at someone on the wrong side.
- **Accepting a risk doesn't hide it.** An accepted overload stays visible on the heatmap in its own "accepted" style, and no longer counts in the dashboard warning.

## Global Constraints

- **Branch:** all work happens on `build/m4`, created from `main`. **Never commit to `main`.** Merging happens only after the user approves the milestone. Then every branch (`main`, `design/portfolio-spec`, `build/m1-m2`, `build/m2`, `build/m3`, `build/m4`) is fast-forwarded to the same commit.
- **Node:** 24.x or later is required (for `node:sqlite`). No native or compiled npm dependencies, because it runs on Windows.
- **Database:** use `node:sqlite` with raw SQL and versioned migrations (`PRAGMA user_version`). **Never edit a shipped migration — append a new one.** Migrations 1–4 exist; M4 adds 5, 6 and 7.
- **Dates:** always ISO `YYYY-MM-DD` strings. "Today" is the local date (`todayLocal()`), never a UTC slice. Weeks start on **Monday**.
- **Tests:** every client test file starts with `// @vitest-environment jsdom`. Server and shared tests run in the default Node environment. Tests that depend on "today" fix the clock with `vi.useFakeTimers({ toFake: ['Date'] })` and `vi.setSystemTime(...)`.
- **Presentation side is read-only:** no create or edit controls under `/present`. M4 adds nothing there, because the spec keeps capacity on the management side.
- **UAE mobile** (people's phone): accepts `+971`, `00971`, `971` or `0` in front of `5X XXX XXXX`, with any spaces or dashes. It is stored as `+971 5X XXX XXXX`. Anything else is refused with "Enter a UAE mobile number, e.g. +971 50 123 4567". Use the existing `normalizeUaeMobile` and `optionalUaeMobile`.
- **Allocation** is a whole % from 1 to 100 per assignment. A person appears at most once per phase. Only **active tech-team** people can be assigned.
- **Reordering** stays drag-and-drop on a handle button plus ArrowUp/ArrowDown. M4 adds no reordering.

## Where M4 sits

M1–M3 are merged to `main`, at commit `6704f55`. The roadmap row for M4 reads: *"Resources page, assigning people to phases, workload heatmap, overload decision prompt."*

## File Structure (after M4)

```
shared/
  types.ts        + Side, Specialisation, ResourceRecord, LeaveRecord, BusinessContact, AssignmentRole,
                    AssignmentRecord, OverloadDecision, WorkloadAssignment, WorkloadData; LIST_NAMES + 'role';
                    ProjectRecord: projectManager → Ref, businessPm → BusinessContact, + assignments
  schemas.ts      + resourceInputSchema, leaveInputSchema, assignmentInputSchema, phaseAssignmentsSchema,
                    assignmentsUpdateSchema, overloadDecisionSchema; phase input gains assignments;
                    project details: projectManagerId, businessPmId
  capacity.ts     new: weekStartOf, weeksCovering, computeWorkload (pure workload engine)
server/
  db.ts           + migrations 5, 6, 7
  resources/repo.ts        new: people and leave
  assignments/repo.ts      new: assignments, workload data, overload decisions
  projects/repo.ts         PMs by id, assignments on create and in records, checkRefs (lists + people)
  lists/repo.ts            role list usage ("used by N people")
  app.ts                   + /api/resources…, /api/leave/:id, /api/phases/:id/assignments, /api/workload,
                             /api/overloads/decisions
  demoData.ts              demo people, leave and assignments
client/
  api.ts, useResources.ts, useWorkload.ts
  components/PersonPicker.tsx, components/AssignmentsEditor.tsx
  pages/manage/ResourcesPage.tsx, PersonPage.tsx, WorkloadHeatmap.tsx, OverloadPanel.tsx
  pages/manage/overloads.ts   (live warnings), heatmap.ts (cell styling)
  pages/manage/PeopleFields.tsx (wizard Step 4), ProjectPeople.tsx (project page card)
```

---

### Task 1: People and leave — storage and API

This task adds the `role` list and the people themselves, with their leave. There are no screens yet. The client test fixtures and the lists hook only gain the new `role` list, so the type check stays green.

**Files:**
- Modify: `server/db.ts` (append migration 5), `shared/types.ts`, `shared/schemas.ts`, `server/lists/repo.ts`, `server/app.ts`, `client/useLists.ts`, `client/testing/mockFetch.ts`
- Create: `server/resources/repo.ts`
- Test: `server/resources/resources.test.ts` (new)

**Interfaces:**
- Consumes: `optionalId`, `optionalText`, `optionalEmail`, `optionalUaeMobile`, `isoDate`, `toIssues` (M3); `getListValue` (M3); `Ref`, `Lists` (M3).
- Produces:
  - `LIST_NAMES` gains `'role'`, seeded by migration 5.
  - `shared/types.ts`:
    - `SIDES = ['tech', 'business'] as const`, `Side`
    - `SPECIALISATIONS = ['front-end', 'back-end', 'full-stack'] as const`, `Specialisation`
    - `LeaveRecord { id; start; end; note: string | null }`
    - `ResourceRecord { id; name; side; role: Ref | null; specialisation; email; phone; capacity; active; leave: LeaveRecord[] }`
  - `shared/schemas.ts`:
    - `resourceInputSchema`: `name` is required. Business side forces `roleId`, `specialisation` and `capacity` to `null`, `null` and `100`. `capacity` is 1–100, default 100, with the message "Capacity must be between 1% and 100%".
    - `leaveInputSchema`: `start` and `end` are ISO dates, `note` is optional. An end before the start gives "End date must be on or after the start date" on `end`.
    - Types `ResourceInput`, `ResourceData`, `LeaveInput`, `LeaveData`.
  - `server/resources/repo.ts`:
    - `listResources`, `getResource`, `checkResourceRefs`, `createResource`, `updateResource`, `deleteResource`, `addLeave`, `deleteLeave`
    - `USAGE` (empty for now: Tasks 2 and 4 add to it)
  - HTTP:
    - `GET /api/resources`: the tech team first, then business contacts, each sorted by name ignoring case.
    - `POST /api/resources` → 201, or 400 `{ error: 'Invalid person', issues }`. A `roleId` that isn't a role gives `{ path: 'roleId', message: 'Unknown role' }`.
    - `PUT /api/resources/:id` → 200, or 404 `{ error: 'Person not found' }`.
    - `DELETE /api/resources/:id` → 204, 404, or 409. The 409 message is "`<name>` can't be deleted because `<reasons>`. Make them inactive instead."
    - `POST /api/resources/:id/leave` → 201 `LeaveRecord`, 400 `{ error: 'Invalid leave', issues }`, or 404.
    - `DELETE /api/leave/:id` → 204, or 404 `{ error: 'Leave not found' }`.
  - A role in use can't be deleted: `DELETE /api/lists/role/:id` → 409 `"<name>" is used by N person/people`.

- [ ] **Step 1: Write the failing test** `server/resources/resources.test.ts`

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { buildApp } from '../app';
import { openDb } from '../db';

let db: DatabaseSync;
let app: ReturnType<typeof buildApp>;
let roles: Record<string, number>;

beforeEach(async () => {
  db = openDb(':memory:');
  app = buildApp(db);
  const lists = (await app.inject({ method: 'GET', url: '/api/lists' })).json();
  roles = Object.fromEntries(lists.role.map((v: { id: number; name: string }) => [v.name, v.id]));
});

const post = (payload: unknown) => app.inject({ method: 'POST', url: '/api/resources', payload });

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
      id: expect.any(Number), name: 'Fatima Noor', side: 'tech', role: { id: roles.Developer, name: 'Developer' },
      specialisation: 'front-end', email: 'fatima@example.com', phone: null, capacity: 80, active: true, leave: [],
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
    expect(wrongList.json().issues).toEqual([{ path: 'roleId', message: 'Unknown role' }]);
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
    expect(missing.json()).toEqual({ error: 'Person not found' });
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
    expect(backwards.json().issues).toEqual([{ path: 'end', message: 'End date must be on or after the start date' }]);

    const noPerson = await app.inject({
      method: 'POST', url: '/api/resources/999/leave', payload: { start: '2026-10-12', end: '2026-10-12' },
    });
    expect(noPerson.statusCode).toBe(404);

    const listed = (await app.inject({ method: 'GET', url: '/api/resources' })).json()[0];
    expect(listed.leave).toEqual([added.json()]);
    expect((await app.inject({ method: 'DELETE', url: `/api/leave/${added.json().id}` })).statusCode).toBe(204);
    const again = await app.inject({ method: 'DELETE', url: `/api/leave/${added.json().id}` });
    expect(again.statusCode).toBe(404);
    expect(again.json()).toEqual({ error: 'Leave not found' });
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
    expect(res.json()).toEqual({ error: '"Developer" is used by 1 person' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run server/resources`
Expected: FAIL. `lists.role` is undefined, and `/api/resources` returns 404.

- [ ] **Step 3: Types and the role list**

In `shared/types.ts`:
- Change `LIST_NAMES` to:

```ts
export const LIST_NAMES = ['mainProject', 'projectType', 'goal', 'department', 'phase', 'role'] as const;
```

- Add after the `ScopeItem` interface:

```ts
/** 'tech': your team, counted in workload and assignable to phases. 'business': business-side contacts, not counted. */
export const SIDES = ['tech', 'business'] as const;
export type Side = (typeof SIDES)[number];

export const SPECIALISATIONS = ['front-end', 'back-end', 'full-stack'] as const;
export type Specialisation = (typeof SPECIALISATIONS)[number];

export interface LeaveRecord {
  id: number;
  start: ISODate;
  end: ISODate;
  note: string | null;
}

export interface ResourceRecord {
  id: number;
  name: string;
  side: Side;
  /** Tech side only. */
  role: Ref | null;
  /** Tech side only. */
  specialisation: Specialisation | null;
  email: string | null;
  /** Normalised UAE mobile, "+971 5X XXX XXXX". */
  phone: string | null;
  /** % of a full working week this person can give (tech side; business contacts are always 100). */
  capacity: number;
  active: boolean;
  /** Ordered by start date. */
  leave: LeaveRecord[];
}
```

In `client/useLists.ts`, change `EMPTY` to:

```ts
const EMPTY: Lists = { mainProject: [], projectType: [], goal: [], department: [], phase: [], role: [] };
```

In `client/testing/mockFetch.ts`, add to the object returned by `sampleLists()`, after `phase`:

```ts
    role: [
      'Project manager', 'Tech lead', 'Business analyst', 'Developer', 'Designer', 'QA', 'DB engineer', 'InfoSec',
    ].map((name, i) => ({ id: 60 + i, list: 'role' as const, name, order: i })),
```

- [ ] **Step 4: Append migration 5 to `server/db.ts`** (a new array entry after migration 4)

```ts
  `
  INSERT INTO list_values (list, name, sort_order) VALUES
    ('role', 'Project manager', 0),
    ('role', 'Tech lead', 1),
    ('role', 'Business analyst', 2),
    ('role', 'Developer', 3),
    ('role', 'Designer', 4),
    ('role', 'QA', 5),
    ('role', 'DB engineer', 6),
    ('role', 'InfoSec', 7);

  CREATE TABLE resources (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    side TEXT NOT NULL,
    role_id INTEGER REFERENCES list_values(id),
    specialisation TEXT,
    email TEXT,
    phone TEXT,
    capacity INTEGER NOT NULL DEFAULT 100,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE leave (
    id INTEGER PRIMARY KEY,
    resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    note TEXT
  );
  CREATE INDEX leave_resource ON leave(resource_id);
  `,
```

- [ ] **Step 5: Role usage in `server/lists/repo.ts`**

- In `getLists`, add `role: []` to the `lists` literal.
- Replace the whole `USAGE_SQL` constant, including its doc comment, with:

```ts
/**
 * How many things use a list value, and what to call them in the "in use" message. Most lists are referenced by id
 * from a projects column. Phases store their name on each project's phase rows, so a phase value is matched by name
 * (ignoring case). Roles are used by people.
 */
const USAGE: Record<ListName, { sql: string; one: string; many: string }> = {
  mainProject: { sql: 'SELECT COUNT(*) AS n FROM projects WHERE main_project_id = ?', one: 'project', many: 'projects' },
  projectType: { sql: 'SELECT COUNT(*) AS n FROM projects WHERE project_type_id = ?', one: 'project', many: 'projects' },
  goal: { sql: 'SELECT COUNT(*) AS n FROM projects WHERE goal_id = ?', one: 'project', many: 'projects' },
  department: { sql: 'SELECT COUNT(*) AS n FROM projects WHERE department_id = ?', one: 'project', many: 'projects' },
  phase: {
    sql: 'SELECT COUNT(DISTINCT project_id) AS n FROM phases WHERE name = ? COLLATE NOCASE',
    one: 'project',
    many: 'projects',
  },
  role: { sql: 'SELECT COUNT(*) AS n FROM resources WHERE role_id = ?', one: 'person', many: 'people' },
};
```

- In `deleteListValue`, replace the two lines that compute `n` and return the 409 with:

```ts
  const usage = USAGE[list];
  const { n } = db.prepare(usage.sql).get(list === 'phase' ? current.name : id) as unknown as { n: number };
  if (n > 0) return { ok: false, status: 409, error: `"${current.name}" is used by ${n} ${n === 1 ? usage.one : usage.many}` };
```

- [ ] **Step 6: Input rules in `shared/schemas.ts`**

Change the import from `./types` to:

```ts
import { CATEGORIES, PRIORITIES, SCOPE_KINDS, SIDES, SPECIALISATIONS } from './types';
```

Append at the end of the file:

```ts
export const resourceInputSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(200),
    side: z.enum(SIDES),
    roleId: optionalId,
    specialisation: z
      .enum(SPECIALISATIONS)
      .nullish()
      .transform((v) => v ?? null),
    email: optionalEmail,
    phone: optionalUaeMobile,
    capacity: z
      .number({ invalid_type_error: 'Capacity must be a number' })
      .int('Capacity must be a whole number')
      .min(1, 'Capacity must be between 1% and 100%')
      .max(100, 'Capacity must be between 1% and 100%')
      .default(100),
    active: z.boolean().default(true),
  })
  // Business contacts have no role or specialisation, and are not counted in workload.
  .transform((r) => (r.side === 'business' ? { ...r, roleId: null, specialisation: null, capacity: 100 } : r));

export const leaveInputSchema = z
  .object({ start: isoDate, end: isoDate, note: optionalText(200) })
  .refine((l) => l.end >= l.start, { message: 'End date must be on or after the start date', path: ['end'] });

export type ResourceInput = z.input<typeof resourceInputSchema>;
export type ResourceData = z.output<typeof resourceInputSchema>;
export type LeaveInput = z.input<typeof leaveInputSchema>;
export type LeaveData = z.output<typeof leaveInputSchema>;
```

- [ ] **Step 7: Create `server/resources/repo.ts`**

```ts
import type { DatabaseSync } from 'node:sqlite';
import type { LeaveData, ResourceData, ValidationIssue } from '../../shared/schemas';
import type { LeaveRecord, ResourceRecord, Side, Specialisation } from '../../shared/types';
import { getListValue } from '../lists/repo';

interface ResourceRow {
  id: number;
  name: string;
  side: Side;
  role_id: number | null;
  specialisation: Specialisation | null;
  email: string | null;
  phone: string | null;
  capacity: number;
  active: number;
}

interface LeaveRow {
  id: number;
  resource_id: number;
  start_date: string;
  end_date: string;
  note: string | null;
}

/** Columns written from ResourceData, in the same order as resourceValues(). */
const COLUMNS = ['name', 'side', 'role_id', 'specialisation', 'email', 'phone', 'capacity', 'active'];

function resourceValues(r: ResourceData) {
  return [r.name, r.side, r.roleId, r.specialisation, r.email, r.phone, r.capacity, r.active ? 1 : 0];
}

/**
 * What still points at a person, each with the reason shown when deleting is refused. A person in use can be made
 * inactive but not deleted, so history keeps their name. Later features add their own entries here.
 */
const USAGE: { sql: string; reason: (n: number) => string }[] = [];

function toLeave(row: LeaveRow): LeaveRecord {
  return { id: row.id, start: row.start_date, end: row.end_date, note: row.note };
}

function roleNames(db: DatabaseSync): Map<number, string> {
  const rows = db.prepare("SELECT id, name FROM list_values WHERE list = 'role'").all() as unknown as { id: number; name: string }[];
  return new Map(rows.map((r) => [r.id, r.name]));
}

function toResource(row: ResourceRow, roles: Map<number, string>, leave: LeaveRecord[]): ResourceRecord {
  const roleName = row.role_id === null ? undefined : roles.get(row.role_id);
  return {
    id: row.id,
    name: row.name,
    side: row.side,
    role: row.role_id !== null && roleName !== undefined ? { id: row.role_id, name: roleName } : null,
    specialisation: row.specialisation,
    email: row.email,
    phone: row.phone,
    capacity: row.capacity,
    active: row.active === 1,
    leave,
  };
}

/** The tech team first, then business contacts, each by name (ignoring case). */
export function listResources(db: DatabaseSync): ResourceRecord[] {
  const rows = db
    .prepare("SELECT * FROM resources ORDER BY CASE side WHEN 'tech' THEN 0 ELSE 1 END, name COLLATE NOCASE, id")
    .all() as unknown as ResourceRow[];
  const leave = new Map<number, LeaveRecord[]>();
  for (const l of db.prepare('SELECT * FROM leave ORDER BY start_date, id').all() as unknown as LeaveRow[]) {
    leave.set(l.resource_id, [...(leave.get(l.resource_id) ?? []), toLeave(l)]);
  }
  const roles = roleNames(db);
  return rows.map((r) => toResource(r, roles, leave.get(r.id) ?? []));
}

export function getResource(db: DatabaseSync, id: number): ResourceRecord | undefined {
  const row = db.prepare('SELECT * FROM resources WHERE id = ?').get(id) as unknown as ResourceRow | undefined;
  if (!row) return undefined;
  const leave = (db.prepare('SELECT * FROM leave WHERE resource_id = ? ORDER BY start_date, id').all(id) as unknown as LeaveRow[])
    .map(toLeave);
  return toResource(row, roleNames(db), leave);
}

/** A chosen role must exist in the role list. */
export function checkResourceRefs(db: DatabaseSync, r: ResourceData): ValidationIssue[] {
  if (r.roleId !== null && getListValue(db, r.roleId)?.list !== 'role') return [{ path: 'roleId', message: 'Unknown role' }];
  return [];
}

export function createResource(db: DatabaseSync, r: ResourceData): ResourceRecord {
  const res = db
    .prepare(`INSERT INTO resources (${COLUMNS.join(', ')}) VALUES (${COLUMNS.map(() => '?').join(', ')})`)
    .run(...resourceValues(r));
  return getResource(db, Number(res.lastInsertRowid))!;
}

/** Returns undefined when the person does not exist. */
export function updateResource(db: DatabaseSync, id: number, r: ResourceData): ResourceRecord | undefined {
  const res = db
    .prepare(`UPDATE resources SET ${COLUMNS.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`)
    .run(...resourceValues(r), id);
  return Number(res.changes) === 0 ? undefined : getResource(db, id);
}

export type ResourceDelete = { ok: true } | { ok: false; status: 404 | 409; error: string };

export function deleteResource(db: DatabaseSync, id: number): ResourceDelete {
  const person = getResource(db, id);
  if (!person) return { ok: false, status: 404, error: 'Person not found' };
  const reasons = USAGE.flatMap(({ sql, reason }) => {
    const { n } = db.prepare(sql).get(id) as unknown as { n: number };
    return n > 0 ? [reason(n)] : [];
  });
  if (reasons.length > 0) {
    return { ok: false, status: 409, error: `${person.name} can't be deleted because ${reasons.join(' and ')}. Make them inactive instead.` };
  }
  db.prepare('DELETE FROM resources WHERE id = ?').run(id);
  return { ok: true };
}

/** Returns undefined when the person does not exist. */
export function addLeave(db: DatabaseSync, resourceId: number, l: LeaveData): LeaveRecord | undefined {
  if (!db.prepare('SELECT id FROM resources WHERE id = ?').get(resourceId)) return undefined;
  const res = db
    .prepare('INSERT INTO leave (resource_id, start_date, end_date, note) VALUES (?, ?, ?, ?)')
    .run(resourceId, l.start, l.end, l.note);
  return toLeave(db.prepare('SELECT * FROM leave WHERE id = ?').get(Number(res.lastInsertRowid)) as unknown as LeaveRow);
}

/** Returns false when there was no such leave. */
export function deleteLeave(db: DatabaseSync, id: number): boolean {
  return Number(db.prepare('DELETE FROM leave WHERE id = ?').run(id).changes) > 0;
}
```

- [ ] **Step 8: Routes in `server/app.ts`**

Add to the imports:

```ts
import { leaveInputSchema, resourceInputSchema } from '../shared/schemas';
import {
  addLeave, checkResourceRefs, createResource, deleteLeave, deleteResource, listResources, updateResource,
} from './resources/repo';
```

Merge the first line into the existing `../shared/schemas` import rather than adding a second import from the same module.

Add these routes directly after the `app.delete('/api/lists/:list/:id', …)` route:

```ts
  app.get('/api/resources', async () => listResources(db));

  app.post('/api/resources', async (req, reply) => {
    const parsed = resourceInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid person', issues: toIssues(parsed.error) });
    const issues = checkResourceRefs(db, parsed.data);
    if (issues.length > 0) return reply.code(400).send({ error: 'Invalid person', issues });
    return reply.code(201).send(createResource(db, parsed.data));
  });

  app.put<{ Params: { id: string } }>('/api/resources/:id', async (req, reply) => {
    const parsed = resourceInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid person', issues: toIssues(parsed.error) });
    const issues = checkResourceRefs(db, parsed.data);
    if (issues.length > 0) return reply.code(400).send({ error: 'Invalid person', issues });
    const person = updateResource(db, Number(req.params.id), parsed.data);
    if (!person) return reply.code(404).send({ error: 'Person not found' });
    return person;
  });

  app.delete<{ Params: { id: string } }>('/api/resources/:id', async (req, reply) => {
    const result = deleteResource(db, Number(req.params.id));
    return result.ok ? reply.code(204).send() : reply.code(result.status).send({ error: result.error });
  });

  app.post<{ Params: { id: string } }>('/api/resources/:id/leave', async (req, reply) => {
    const parsed = leaveInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid leave', issues: toIssues(parsed.error) });
    const leave = addLeave(db, Number(req.params.id), parsed.data);
    if (!leave) return reply.code(404).send({ error: 'Person not found' });
    return reply.code(201).send(leave);
  });

  app.delete<{ Params: { id: string } }>('/api/leave/:id', async (req, reply) =>
    deleteLeave(db, Number(req.params.id)) ? reply.code(204).send() : reply.code(404).send({ error: 'Leave not found' }));
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npx vitest run server/resources server/lists`
Expected: PASS.

- [ ] **Step 10: Run the whole suite and the type check**

Run: `npm test` → Expected: PASS (all tests).
Run: `npm run typecheck` → Expected: exit code 0.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: people and leave with roles, storage and API"
```

---

### Task 2: Project managers become people pickers

The project's **Project manager (tech)** and **Business project manager** stop being typed text and point at people in Resources. Migration 6 moves existing names into Resources, so nothing typed so far is lost:
- each distinct tech PM name becomes a tech-team person with the Project manager role;
- each distinct business PM becomes a business contact with their phone and email.

The form picks from Resources, and "+ Add new person…" adds someone inline, including a business contact's phone and email.

**Files:**
- Modify: `server/db.ts` (append migration 6), `shared/types.ts`, `shared/schemas.ts`, `server/projects/repo.ts`, `server/resources/repo.ts`, `server/app.ts`, `server/demoData.ts`
- Modify: `client/api.ts`, `client/testing/mockFetch.ts`, `client/pages/manage/projectDraft.ts`, `client/pages/manage/DetailsFields.tsx`, `client/pages/manage/CreateProjectPage.tsx`, `client/pages/manage/EditProjectPage.tsx`, `client/pages/manage/ProjectPage.tsx`
- Create: `client/useResources.ts`, `client/components/PersonPicker.tsx`
- Test: `server/db.test.ts`, `server/projects/details.test.ts`, `server/demoData.test.ts`, `client/components/PersonPicker.test.tsx` (new), `client/pages/manage/CreateProjectPage.test.tsx`, `client/pages/manage/EditProjectPage.test.tsx`, `client/pages/manage/ProjectPage.test.tsx`, `client/pages/manage/projectDraft.test.ts`

**Interfaces:**
- Consumes: `ResourceRecord`, `Side`, `resourceInputSchema`, `ResourceInput`, `createResource`, `USAGE` in `server/resources/repo.ts` (Task 1); `optionalId` (M3); `OptionPicker`'s `.option-add` styles (M3).
- Produces:
  - `BusinessContact { id; name; phone: string | null; email: string | null }`.
  - `ProjectRecord`:
    - `projectManager: Ref | null`
    - `businessPm: BusinessContact | null`
    - `businessPmName`, `businessPmPhone` and `businessPmEmail` are removed.
  - `projectDetailsSchema`: `projectManagerId` and `businessPmId`, both optional ids. They replace `projectManager` and the three `businessPm*` fields.
  - `server/projects/repo.ts`: `checkRefs(db, details)`, renamed from `checkListRefs`.
    - It also checks that `projectManagerId` is a tech person, otherwise "Unknown project manager (tech)".
    - It also checks that `businessPmId` is a business contact, otherwise "Unknown business project manager".
  - Resources `USAGE` gains "they are a project manager on N project(s)".
  - Client:
    - `api.listResources()` and `api.createResource(input)`.
    - `useResources(): { people, error, remember }`.
    - `PersonPicker({ label, side, people, value, onChange, onAdded, noneLabel, newPersonRoleId? })`. Its add choice is "+ Add new person…". Adding asks for "New `<label lower-case>`", and for business contacts also "`<label>` phone (UAE mobile)" and "`<label>` email".
    - `DetailsFields` gains props `people` and `onPersonAdded`.
    - `DetailsDraft`: `projectManagerId` and `businessPmId`.
  - Test fixture `samplePeople()`:
    - `70` Sara Ahmed: tech, Project manager (role id 60)
    - `71` Fatima Noor: tech, Developer (63), front-end
    - `72` Rami Saleh: tech, Developer, back-end, capacity 80
    - `80` Mariam Al Suwaidi: business, `+971 50 123 4567`, `mariam@example.com`
  - `server/demoData.ts`:
    - `DEMO_PEOPLE: DemoPerson[]`.
    - Demo projects name `projectManager` and `businessPm`.
    - `toProjectInput(demo, idFor, personId)`.
    - `seedDemo` adds the people first.

- [ ] **Step 1: Write the failing tests**

Append inside `describe('migrate', …)` in `server/db.test.ts`:

```ts
  it('moves project manager names into Resources when upgrading from version 5', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    for (const m of MIGRATIONS.slice(0, 5)) db.exec(m);
    db.exec('PRAGMA user_version = 5');
    const insert = db.prepare(
      "INSERT INTO projects (name, color, start_date, created_at, project_manager, business_pm_name, business_pm_phone, business_pm_email) VALUES (?, '#000000', '2026-01-05', 'x', ?, ?, ?, ?)",
    );
    insert.run('A', 'Sara Ahmed', 'Mariam', '+971 50 123 4567', null);
    insert.run('B', ' Sara Ahmed ', 'Mariam', null, 'mariam@example.com');
    insert.run('C', null, null, null, null);

    migrate(db);

    const people = db.prepare('SELECT name, side, phone, email FROM resources ORDER BY side DESC, name').all().map((r) => ({ ...r }));
    expect(people).toEqual([
      { name: 'Sara Ahmed', side: 'tech', phone: null, email: null },
      { name: 'Mariam', side: 'business', phone: '+971 50 123 4567', email: 'mariam@example.com' },
    ]);
    const pm = db.prepare("SELECT r.name AS role FROM resources p JOIN list_values r ON r.id = p.role_id WHERE p.side = 'tech'").get();
    expect({ ...pm }).toEqual({ role: 'Project manager' });
    const projects = db
      .prepare('SELECT name, project_manager_id IS NOT NULL AS pm, business_pm_id IS NOT NULL AS bpm FROM projects ORDER BY name')
      .all()
      .map((r) => ({ ...r }));
    expect(projects).toEqual([{ name: 'A', pm: 1, bpm: 1 }, { name: 'B', pm: 1, bpm: 1 }, { name: 'C', pm: 0, bpm: 0 }]);
  });
```

In `server/projects/details.test.ts`:
- Change the `ids` declaration to:

```ts
let ids: { customer: number; goal: number; finance: number; digital: number; sara: number; mariam: number };
```

- In `beforeEach`, add these two lines after the `const add = …` helper:

```ts
  const person = async (payload: object) =>
    (await app.inject({ method: 'POST', url: '/api/resources', payload })).json().id as number;
```

- Extend the `ids = { … }` object with:

```ts
    sara: await person({ name: 'Sara Ahmed', side: 'tech' }),
    mariam: await person({ name: 'Mariam Al Suwaidi', side: 'business', phone: '050 123 4567', email: 'mariam@example.com' }),
```

- In `fullBody()`, replace `projectManager: 'Sara Ahmed',` with `projectManagerId: ids.sara, businessPmId: ids.mariam,`.
- In the test `'creates a project with classification, description and numbered scope items'`, replace `projectManager: 'Sara Ahmed',` with:

```ts
      projectManager: { id: ids.sara, name: 'Sara Ahmed' },
      businessPm: { id: ids.mariam, name: 'Mariam Al Suwaidi', phone: '+971 50 123 4567', email: 'mariam@example.com' },
```

- In the test `'gives sensible defaults …'`, replace `projectManager: null,` with `projectManager: null, businessPm: null,`.
- Replace the two tests `'stores the business project manager with a normalised UAE mobile, every part optional'` and `'rejects a phone that is not a UAE mobile and a malformed email'` with:

```ts
  it('refuses a project manager from the wrong side, or one who does not exist', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/projects', payload: { ...base, projectManagerId: ids.mariam, businessPmId: 9999 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().issues).toEqual([
      { path: 'projectManagerId', message: 'Unknown project manager (tech)' },
      { path: 'businessPmId', message: 'Unknown business project manager' },
    ]);
  });

  it('will not delete a person who manages a project', async () => {
    await app.inject({ method: 'POST', url: '/api/projects', payload: fullBody() });
    const res = await app.inject({ method: 'DELETE', url: `/api/resources/${ids.sara}` });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({
      error: "Sara Ahmed can't be deleted because they are a project manager on 1 project. Make them inactive instead.",
    });
  });
```

In `server/demoData.test.ts`:
- Change `toProjectInput(demo, () => 1)` to `toProjectInput(demo, () => 1, () => 1)`.
- Replace the `businessPmName` / `businessPmPhone` / `businessPmEmail` assertion block with:

```ts
    expect(projects.find((p) => p.name === 'Customer Portal Revamp')).toMatchObject({
      projectManager: { name: 'Sara Ahmed' },
      businessPm: { name: 'Mariam Al Suwaidi', phone: '+971 50 123 4567', email: 'mariam.alsuwaidi@example.com' },
    });
```

Create `client/components/PersonPicker.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { ResourceRecord, Side } from '../../shared/types';
import { mockFetch, samplePeople } from '../testing/mockFetch';
import { PersonPicker } from './PersonPicker';

const inactive: ResourceRecord = {
  id: 81, name: 'Old Contact', side: 'business', role: null, specialisation: null, email: null, phone: null,
  capacity: 100, active: false, leave: [],
};

function Harness({ side, label, initial = null, roleId }: { side: Side; label: string; initial?: number | null; roleId?: number }) {
  const [people, setPeople] = useState<ResourceRecord[]>([...samplePeople(), inactive]);
  const [value, setValue] = useState<number | null>(initial);
  return (
    <PersonPicker
      label={label}
      side={side}
      people={people}
      value={value}
      onChange={setValue}
      onAdded={(p) => setPeople((list) => [...list, p])}
      noneLabel="Not set"
      newPersonRoleId={roleId}
    />
  );
}

const optionNames = (label: string) =>
  within(screen.getByLabelText(label)).getAllByRole('option').map((o) => o.textContent);

describe('PersonPicker', () => {
  it("offers only this side's active people, sorted by name", () => {
    render(<Harness side="tech" label="Project manager (tech)" />);
    expect(optionNames('Project manager (tech)')).toEqual(['Not set', 'Fatima Noor', 'Rami Saleh', 'Sara Ahmed', '+ Add new person…']);
  });

  it('keeps showing a chosen person who has since been made inactive', () => {
    render(<Harness side="business" label="Business project manager" initial={81} />);
    expect(screen.getByLabelText('Business project manager')).toHaveDisplayValue('Old Contact (inactive)');
    expect(optionNames('Business project manager')).toEqual([
      'Not set', 'Mariam Al Suwaidi', 'Old Contact (inactive)', '+ Add new person…',
    ]);
  });

  it('adds a business contact with phone and email, then selects them', async () => {
    const fetchMock = mockFetch({
      'POST /api/resources': () => ({
        status: 201,
        body: {
          id: 82, name: 'Noura Al Hammadi', side: 'business', role: null, specialisation: null,
          email: 'noura@example.com', phone: '+971 55 234 5678', capacity: 100, active: true, leave: [],
        },
      }),
    });
    const user = userEvent.setup();
    render(<Harness side="business" label="Business project manager" />);

    await user.selectOptions(screen.getByLabelText('Business project manager'), '+ Add new person…');
    await user.type(screen.getByLabelText('New business project manager'), 'Noura Al Hammadi');
    await user.type(screen.getByLabelText('Business project manager phone (UAE mobile)'), '055 234 5678');
    await user.type(screen.getByLabelText('Business project manager email'), 'noura@example.com');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByRole('option', { name: 'Noura Al Hammadi' })).toBeInTheDocument();
    expect(screen.getByLabelText('Business project manager')).toHaveValue('82');
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init?.body as string)).toEqual({
      name: 'Noura Al Hammadi', side: 'business', roleId: null, phone: '055 234 5678', email: 'noura@example.com',
    });
  });

  it("shows the server's messages, and Cancel goes back to the list", async () => {
    mockFetch({
      'POST /api/resources': () => ({
        status: 400,
        body: { error: 'Invalid person', issues: [{ path: 'phone', message: 'Enter a UAE mobile number, e.g. +971 50 123 4567' }] },
      }),
    });
    const user = userEvent.setup();
    render(<Harness side="business" label="Business project manager" />);
    await user.selectOptions(screen.getByLabelText('Business project manager'), '+ Add new person…');
    await user.type(screen.getByLabelText('New business project manager'), 'Noura');
    await user.type(screen.getByLabelText('Business project manager phone (UAE mobile)'), '04 123 4567');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a UAE mobile number, e.g. +971 50 123 4567');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText('Business project manager')).toHaveValue('');
  });

  it('gives a tech person added here the given role, and asks for no phone or email', async () => {
    const fetchMock = mockFetch({
      'POST /api/resources': () => ({
        status: 201,
        body: {
          id: 73, name: 'Omar Haddad', side: 'tech', role: { id: 60, name: 'Project manager' }, specialisation: null,
          email: null, phone: null, capacity: 100, active: true, leave: [],
        },
      }),
    });
    const user = userEvent.setup();
    render(<Harness side="tech" label="Project manager (tech)" roleId={60} />);
    await user.selectOptions(screen.getByLabelText('Project manager (tech)'), '+ Add new person…');
    expect(screen.queryByLabelText('Project manager (tech) phone (UAE mobile)')).toBeNull();
    await user.type(screen.getByLabelText('New project manager (tech)'), 'Omar Haddad{Enter}');
    expect(await screen.findByRole('option', { name: 'Omar Haddad' })).toBeInTheDocument();
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init?.body as string)).toEqual({ name: 'Omar Haddad', side: 'tech', roleId: 60, phone: '', email: '' });
  });
});
```

In `client/pages/manage/CreateProjectPage.test.tsx`:
- Import `samplePeople` from `../../testing/mockFetch`.
- Add to `baseRoutes`:

```tsx
  'GET /api/resources': () => ({ body: samplePeople() }),
```

- Delete the whole test `'will not move on with a business PM phone that is not a UAE mobile'`. Phone validation now lives in the person form (`PersonPicker.test.tsx`).
- In `'creates a project with its details, scope and phases'`, replace the four `user.type(...)` lines for "Project manager (tech)", "Business project manager", "Business PM phone (UAE mobile)" and "Business PM email" with:

```tsx
    await screen.findByRole('option', { name: 'Sara Ahmed' });
    await user.selectOptions(screen.getByLabelText('Project manager (tech)'), 'Sara Ahmed');
    await user.selectOptions(screen.getByLabelText('Business project manager'), 'Mariam Al Suwaidi');
```

- In the same test's `toMatchObject`, replace the four lines `projectManager: 'Sara Ahmed',`, `businessPmName: …`, `businessPmPhone: …` and `businessPmEmail: …` with:

```tsx
      projectManagerId: 70,
      businessPmId: 80,
```

In `client/pages/manage/EditProjectPage.test.tsx`:
- Import `samplePeople`.
- Add `'GET /api/resources': () => ({ body: samplePeople() }),` to **every** `mockFetch({ … })` call in the file.
- In the `project` fixture, replace `projectManager: 'Sara Ahmed',` with `projectManager: { id: 70, name: 'Sara Ahmed' },`.
- Replace `expect(screen.getByLabelText('Project manager (tech)')).toHaveValue('Sara Ahmed');` with:

```tsx
    await screen.findByRole('option', { name: 'Sara Ahmed' });
    expect(screen.getByLabelText('Project manager (tech)')).toHaveValue('70');
```

- Replace `projectManager: 'Sara Ahmed'` in the `toMatchObject` of the sent body with `projectManagerId: 70`.

In `client/pages/manage/ProjectPage.test.tsx`:
- In the second test's fixture, replace `projectManager: 'Sara Ahmed',` with `projectManager: { id: 70, name: 'Sara Ahmed' },`.
- In the third test's fixture, replace the four lines `projectManager` / `businessPmName` / `businessPmPhone` / `businessPmEmail` with:

```tsx
          projectManager: { id: 70, name: 'Sara Ahmed' },
          businessPm: { id: 80, name: 'Mariam Al Suwaidi', phone: '+971 50 123 4567', email: 'mariam@example.com' },
```

In `client/pages/manage/projectDraft.test.ts`, replace `projectManager: 'Sara',` in the fixture with `projectManager: { id: 70, name: 'Sara' },`. In the expectation, replace `projectManager: 'Sara'` with `projectManagerId: 70`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run server client`
Expected: FAIL.
- The version-5 upgrade leaves no people.
- `projectManagerId` is ignored.
- `samplePeople` and `PersonPicker` don't exist.

- [ ] **Step 3: Append migration 6 to `server/db.ts`** (after migration 5)

```ts
  `
  ALTER TABLE projects ADD COLUMN project_manager_id INTEGER REFERENCES resources(id);
  ALTER TABLE projects ADD COLUMN business_pm_id INTEGER REFERENCES resources(id);

  INSERT INTO resources (name, side, role_id, capacity, active)
    SELECT DISTINCT trim(project_manager), 'tech',
      (SELECT id FROM list_values WHERE list = 'role' AND name = 'Project manager'), 100, 1
    FROM projects
    WHERE trim(COALESCE(project_manager, '')) <> ''
      AND trim(project_manager) NOT IN (SELECT name FROM resources WHERE side = 'tech');
  UPDATE projects
    SET project_manager_id = (SELECT id FROM resources r WHERE r.side = 'tech' AND r.name = trim(projects.project_manager) ORDER BY id LIMIT 1)
    WHERE trim(COALESCE(project_manager, '')) <> '';

  INSERT INTO resources (name, side, phone, email, capacity, active)
    SELECT trim(business_pm_name), 'business', MAX(business_pm_phone), MAX(business_pm_email), 100, 1
    FROM projects
    WHERE trim(COALESCE(business_pm_name, '')) <> ''
      AND trim(business_pm_name) NOT IN (SELECT name FROM resources WHERE side = 'business')
    GROUP BY trim(business_pm_name);
  UPDATE projects
    SET business_pm_id = (SELECT id FROM resources r WHERE r.side = 'business' AND r.name = trim(projects.business_pm_name) ORDER BY id LIMIT 1)
    WHERE trim(COALESCE(business_pm_name, '')) <> '';

  ALTER TABLE projects DROP COLUMN project_manager;
  ALTER TABLE projects DROP COLUMN business_pm_name;
  ALTER TABLE projects DROP COLUMN business_pm_phone;
  ALTER TABLE projects DROP COLUMN business_pm_email;
  `,
```

- [ ] **Step 4: Types and input rules**

In `shared/types.ts`, add after `ResourceRecord`:

```ts
/** A business-side contact as a project shows them. */
export interface BusinessContact {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
}
```

In `ProjectRecord`, replace the four lines `projectManager: string | null;`, `businessPmName`, `businessPmPhone` and `businessPmEmail`, with their doc comments, with:

```ts
  /** From the tech team (Resources, tech side). */
  projectManager: Ref | null;
  /** The business owner's representative (Resources, business side), who runs the project with the tech PM. */
  businessPm: BusinessContact | null;
```

In `shared/schemas.ts`, in `projectDetailsSchema`, replace the four lines `projectManager: optionalText(200),`, `businessPmName: optionalText(200),`, `businessPmPhone: optionalUaeMobile,` and `businessPmEmail: optionalEmail,` with:

```ts
  projectManagerId: optionalId,
  businessPmId: optionalId,
```

`optionalUaeMobile` and `optionalEmail` stay, because `resourceInputSchema` uses them.

- [ ] **Step 5: Store PMs by id in `server/projects/repo.ts`**

- Add `Side` and `BusinessContact` to the type import from `../../shared/types`.
- In `ProjectRow`, replace `project_manager: string | null;` with `project_manager_id: number | null;`. Replace the three `business_pm_*` lines with `business_pm_id: number | null;`.
- Replace `DETAIL_COLUMNS` and `detailValues` with:

```ts
/** Columns written from ProjectDetails, in the same order as detailValues(). */
const DETAIL_COLUMNS = [
  'name', 'jira_key', 'color', 'priority', 'project_manager_id', 'main_project_id', 'category',
  'project_type_id', 'goal_id', 'department_id', 'requester_internal', 'requester_external',
  'beneficiary_employees', 'beneficiary_customers', 'background', 'summary', 'business_pm_id',
];

function detailValues(d: ProjectDetails) {
  return [
    d.name, d.jiraKey, d.color, d.priority, d.projectManagerId, d.mainProjectId, d.category,
    d.projectTypeId, d.goalId, d.departmentId, d.requester.internal ? 1 : 0, d.requester.external ? 1 : 0,
    d.beneficiary.employees ? 1 : 0, d.beneficiary.customers ? 1 : 0, d.background, d.summary, d.businessPmId,
  ];
}
```

- Replace `checkListRefs` (keep `LIST_REFS` above it) with:

```ts
const PERSON_REFS: { field: 'projectManagerId' | 'businessPmId'; side: Side; label: string }[] = [
  { field: 'projectManagerId', side: 'tech', label: 'project manager (tech)' },
  { field: 'businessPmId', side: 'business', label: 'business project manager' },
];

/** Every chosen list value must exist in the right list, and every chosen person must exist on the right side. */
export function checkRefs(db: DatabaseSync, details: ProjectDetails): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const { field, list, label } of LIST_REFS) {
    const id = details[field];
    if (id === null) continue;
    if (getListValue(db, id)?.list !== list) issues.push({ path: field, message: `Unknown ${label}` });
  }
  for (const { field, side, label } of PERSON_REFS) {
    const id = details[field];
    if (id === null) continue;
    const person = db.prepare('SELECT side FROM resources WHERE id = ?').get(id) as unknown as { side: Side } | undefined;
    if (person?.side !== side) issues.push({ path: field, message: `Unknown ${label}` });
  }
  return issues;
}
```

- Add after `ref()`:

```ts
function peopleById(db: DatabaseSync): Map<number, BusinessContact> {
  const rows = db.prepare('SELECT id, name, phone, email FROM resources').all() as unknown as BusinessContact[];
  return new Map(rows.map((r) => [r.id, { id: r.id, name: r.name, phone: r.phone, email: r.email }]));
}
```

- Change `toProject`'s signature to `function toProject(row: ProjectRow, phases: PhaseRecord[], scopeItems: ScopeItem[], names: Map<number, string>, people: Map<number, BusinessContact>): ProjectRecord`. Replace its four lines `projectManager: row.project_manager,` … `businessPmEmail: row.business_pm_email,` with:

```ts
    projectManager: (() => {
      const pm = row.project_manager_id === null ? undefined : people.get(row.project_manager_id);
      return pm ? { id: pm.id, name: pm.name } : null;
    })(),
    businessPm: (row.business_pm_id === null ? undefined : people.get(row.business_pm_id)) ?? null,
```

- In `getProject`, pass `peopleById(db)` as the last argument to `toProject`. In `listProjects`, add `const people = peopleById(db);` next to `const names = listNames(db);` and pass `people` as the last argument.

In `server/app.ts`, replace `checkListRefs` with `checkRefs` in the import and at both call sites.

In `server/resources/repo.ts`, replace `const USAGE: … = [];` with:

```ts
const USAGE: { sql: string; reason: (n: number) => string }[] = [
  {
    sql: 'SELECT COUNT(*) AS n FROM projects WHERE ? IN (project_manager_id, business_pm_id)',
    reason: (n) => `they are a project manager on ${n} project${n === 1 ? '' : 's'}`,
  },
];
```

- [ ] **Step 6: Demo projects name their people (`server/demoData.ts`)**

Replace the imports and the `DemoProject` type at the top of the file with:

```ts
import type { DatabaseSync } from 'node:sqlite';
import type { WorkCalendar } from '../shared/calendar';
import { newProjectSchema, resourceInputSchema, type NewProjectInput } from '../shared/schemas';
import type { ListName, Side, Specialisation } from '../shared/types';
import { transaction } from './db';
import { addListValue } from './lists/repo';
import { createProject } from './projects/repo';
import { createResource } from './resources/repo';

/** A person the demo projects name; seedDemo adds them to Resources first. */
export interface DemoPerson {
  name: string;
  side: Side;
  role?: string;
  specialisation?: Specialisation;
  capacity?: number;
  email?: string;
  phone?: string;
}

export const DEMO_PEOPLE: DemoPerson[] = [
  { name: 'Sara Ahmed', side: 'tech', role: 'Project manager', email: 'sara.ahmed@example.com' },
  { name: 'Omar Haddad', side: 'tech', role: 'Project manager' },
  { name: 'Lina Karim', side: 'tech', role: 'Project manager' },
  { name: 'Yusuf Nasser', side: 'tech', role: 'Project manager' },
  { name: 'Khalid Al Mansoori', side: 'business' },
  { name: 'Mariam Al Suwaidi', side: 'business', phone: '+971 50 123 4567', email: 'mariam.alsuwaidi@example.com' },
  { name: 'Noura Al Hammadi', side: 'business', phone: '055 234 5678' },
  { name: 'Ahmed Al Zaabi', side: 'business', email: 'ahmed.alzaabi@example.com' },
];

/** A demo project names its list values and people; seedDemo turns the names into ids. */
export type DemoProject = Omit<
  NewProjectInput,
  'mainProjectId' | 'projectTypeId' | 'goalId' | 'departmentId' | 'projectManagerId' | 'businessPmId'
> & {
  mainProject?: string;
  projectType?: string;
  goal?: string;
  department?: string;
  projectManager?: string;
  businessPm?: string;
};
```

In every `DEMO_PROJECTS` entry:
- rename `businessPmName` to `businessPm`;
- delete the `businessPmPhone` and `businessPmEmail` properties, which now live on `DEMO_PEOPLE`.

Keep `projectManager` as it is: it now names a demo person.

Replace `toProjectInput` and `seedDemo` with:

```ts
export function toProjectInput(
  demo: DemoProject,
  idFor: (list: ListName, name: string) => number,
  personId: (name: string) => number,
): NewProjectInput {
  const { mainProject, projectType, goal, department, projectManager, businessPm, ...rest } = demo;
  const id = (list: ListName, name?: string) => (name ? idFor(list, name) : null);
  return {
    ...rest,
    mainProjectId: id('mainProject', mainProject),
    projectTypeId: id('projectType', projectType),
    goalId: id('goal', goal),
    departmentId: id('department', department),
    projectManagerId: projectManager ? personId(projectManager) : null,
    businessPmId: businessPm ? personId(businessPm) : null,
  };
}

/** Adds the demo people, then every demo project (and any list values they name), in one transaction. */
export function seedDemo(db: DatabaseSync, cal: WorkCalendar): number {
  transaction(db, () => {
    const idFor = (list: ListName, name: string) => addListValue(db, list, name).value.id;
    const people = new Map<string, number>();
    for (const p of DEMO_PEOPLE) {
      const data = resourceInputSchema.parse({
        name: p.name,
        side: p.side,
        roleId: p.role ? idFor('role', p.role) : null,
        specialisation: p.specialisation ?? null,
        capacity: p.capacity ?? 100,
        email: p.email ?? null,
        phone: p.phone ?? null,
      });
      people.set(p.name, createResource(db, data).id);
    }
    const personId = (name: string) => {
      const found = people.get(name);
      if (found === undefined) throw new Error(`Demo person missing from DEMO_PEOPLE: ${name}`);
      return found;
    };
    for (const demo of DEMO_PROJECTS) createProject(db, cal, newProjectSchema.parse(toProjectInput(demo, idFor, personId)));
  });
  return DEMO_PROJECTS.length;
}
```

- [ ] **Step 7: Client API, fixtures and the people hook**

In `client/api.ts`:
- Add `ResourceInput` to the type import from `../shared/schemas`, and `ResourceRecord` to the one from `../shared/types`.
- Add to `api`:

```ts
  listResources: () => request<ResourceRecord[]>('/api/resources'),
  createResource: (input: ResourceInput) => request<ResourceRecord>('/api/resources', withBody('POST', input)),
```

In `client/testing/mockFetch.ts`:
- Add `ResourceRecord` to the type import.
- In `sampleProject`, replace the four lines `projectManager: null,`, `businessPmName: null,`, `businessPmPhone: null,` and `businessPmEmail: null,` with `projectManager: null, businessPm: null,`.
- Append:

```ts
export function samplePeople(): ResourceRecord[] {
  const person = (p: Partial<ResourceRecord> & Pick<ResourceRecord, 'id' | 'name' | 'side'>): ResourceRecord => ({
    role: null, specialisation: null, email: null, phone: null, capacity: 100, active: true, leave: [], ...p,
  });
  return [
    person({ id: 70, name: 'Sara Ahmed', side: 'tech', role: { id: 60, name: 'Project manager' } }),
    person({ id: 71, name: 'Fatima Noor', side: 'tech', role: { id: 63, name: 'Developer' }, specialisation: 'front-end' }),
    person({ id: 72, name: 'Rami Saleh', side: 'tech', role: { id: 63, name: 'Developer' }, specialisation: 'back-end', capacity: 80 }),
    person({ id: 80, name: 'Mariam Al Suwaidi', side: 'business', phone: '+971 50 123 4567', email: 'mariam@example.com' }),
  ];
}
```

Create `client/useResources.ts`:

```ts
import { useCallback, useMemo, useState } from 'react';
import type { ResourceRecord } from '../shared/types';
import { api } from './api';
import { useAsync } from './useAsync';

/** Loads everyone in Resources. `remember` adds a person who was just created inline, so they show without a reload. */
export function useResources() {
  const loaded = useAsync(() => api.listResources(), []);
  const [added, setAdded] = useState<ResourceRecord[]>([]);

  const people = useMemo(() => {
    const base = loaded.data ?? [];
    return [...base, ...added.filter((a) => !base.some((b) => b.id === a.id))];
  }, [loaded.data, added]);

  const remember = useCallback((person: ResourceRecord) => setAdded((list) => [...list, person]), []);

  return { people, error: loaded.error, remember };
}
```

- [ ] **Step 8: Create `client/components/PersonPicker.tsx`**

```tsx
import { useState, type KeyboardEvent } from 'react';
import type { ResourceRecord, Side } from '../../shared/types';
import { ApiError, api } from '../api';

const NONE = '';
const ADD = '__add__';

interface PersonPickerProps {
  label: string;
  side: Side;
  /** Everyone in Resources; the picker offers this side's active people plus whoever is already chosen. */
  people: ResourceRecord[];
  value: number | null;
  onChange: (id: number | null) => void;
  /** Called with a person created inline, so the parent can show them straight away. */
  onAdded: (person: ResourceRecord) => void;
  noneLabel: string;
  /** Role given to someone added from here (tech side only), e.g. the "Project manager" role. */
  newPersonRoleId?: number | null;
}

/** A dropdown of people from Resources, with an inline way to add someone (and a business contact's phone and email). */
export function PersonPicker({ label, side, people, value, onChange, onAdded, noneLabel, newPersonRoleId = null }: PersonPickerProps) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const options = people
    .filter((p) => p.side === side && (p.active || p.id === value))
    .sort((a, b) => a.name.localeCompare(b.name));

  function closeAdd() {
    setAdding(false);
    setName('');
    setPhone('');
    setEmail('');
    setErrors([]);
  }

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    setErrors([]);
    try {
      const created = await api.createResource(
        side === 'business'
          ? { name, side, roleId: null, phone, email }
          : { name, side, roleId: newPersonRoleId, phone: '', email: '' },
      );
      onAdded(created);
      onChange(created.id);
      closeAdd();
    } catch (err) {
      setErrors(
        err instanceof ApiError && err.issues.length > 0
          ? err.issues.map((i) => i.message)
          : [err instanceof Error ? err.message : String(err)],
      );
    } finally {
      setSaving(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      void save();
    } else if (e.key === 'Escape') {
      closeAdd();
    }
  }

  if (adding) {
    return (
      <div className="option-add">
        <label>
          New {label.toLowerCase()}
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onKeyDown} />
        </label>
        {side === 'business' ? (
          <>
            <label>
              {label} phone (UAE mobile)
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} onKeyDown={onKeyDown} placeholder="+971 50 123 4567" />
            </label>
            <label>
              {label} email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={onKeyDown} placeholder="name@example.com" />
            </label>
          </>
        ) : null}
        <div className="option-add-actions">
          <button type="button" className="button" onClick={() => void save()} disabled={saving || !name.trim()}>
            Add
          </button>
          <button type="button" className="button secondary" onClick={closeAdd}>
            Cancel
          </button>
        </div>
        {errors.length > 0 ? (
          <ul className="field-error" role="alert">
            {errors.map((m) => <li key={m}>{m}</li>)}
          </ul>
        ) : null}
      </div>
    );
  }

  return (
    <label>
      {label}
      <select
        value={value === null ? NONE : String(value)}
        onChange={(e) => {
          if (e.target.value === ADD) setAdding(true);
          else onChange(e.target.value === NONE ? null : Number(e.target.value));
        }}
      >
        <option value={NONE}>{noneLabel}</option>
        {options.map((p) => (
          <option key={p.id} value={String(p.id)}>{p.active ? p.name : `${p.name} (inactive)`}</option>
        ))}
        <option value={ADD}>+ Add new person…</option>
      </select>
    </label>
  );
}
```

- [ ] **Step 9: Pick PMs in the form**

In `client/pages/manage/projectDraft.ts`:
- In `DetailsDraft`, replace `projectManager: string;` and the three `businessPm…: string;` lines with:

```ts
  projectManagerId: number | null;
  businessPmId: number | null;
```

- In `emptyDetails()`, replace the four matching lines with `projectManagerId: null,` and `businessPmId: null,`.
- In `detailsFromProject()`, replace the four matching lines with:

```ts
    projectManagerId: p.projectManager?.id ?? null,
    businessPmId: p.businessPm?.id ?? null,
```

- In `STEP_FIELDS`, replace `'projectManager', 'businessPmName', 'businessPmPhone', 'businessPmEmail'` with `'projectManagerId', 'businessPmId'`.

In `client/pages/manage/DetailsFields.tsx`:
- Add the imports:

```tsx
import type { ResourceRecord } from '../../../shared/types';
import { PersonPicker } from '../../components/PersonPicker';
```

- Add to `DetailsFieldsProps`:

```tsx
  people: ResourceRecord[];
  onPersonAdded: (person: ResourceRecord) => void;
```

- Destructure `people` and `onPersonAdded` in the function signature.
- Replace the whole `<div className="form-grid">…</div>` inside the **People** card with:

```tsx
        <div className="form-grid">
          <PersonPicker
            label="Project manager (tech)"
            side="tech"
            people={people}
            value={value.projectManagerId}
            onChange={(id) => onChange({ projectManagerId: id })}
            onAdded={onPersonAdded}
            noneLabel="Not set"
            newPersonRoleId={lists.role.find((r) => r.name === 'Project manager')?.id ?? null}
          />
          <PersonPicker
            label="Business project manager"
            side="business"
            people={people}
            value={value.businessPmId}
            onChange={(id) => onChange({ businessPmId: id })}
            onAdded={onPersonAdded}
            noneLabel="Not set"
          />
        </div>
```

In **both** `client/pages/manage/CreateProjectPage.tsx` and `client/pages/manage/EditProjectPage.tsx`:
- Import `useResources` from `../../useResources`.
- Next to the `useLists()` line, add:

```tsx
  const { people, error: peopleError, remember: rememberPerson } = useResources();
```

- Pass `people={people} onPersonAdded={rememberPerson}` to `<DetailsFields …/>`.
- After the "Could not load the dropdown lists" banner, add:

```tsx
        {peopleError ? (
          <div className="errors" role="alert">
            <AlertIcon />
            <span>Could not load people: {peopleError.message}</span>
          </div>
        ) : null}
```

In `client/pages/manage/ProjectPage.tsx`, replace the `Project manager (tech)` and `Business project manager` `<Detail>` elements with:

```tsx
          <Detail label="Project manager (tech)">{p.projectManager?.name ?? '—'}</Detail>
          <Detail label="Business project manager">
            <span>{p.businessPm?.name ?? '—'}</span>
            {p.businessPm?.phone ? (
              <a className="detail-line" href={`tel:${p.businessPm.phone.replace(/\s/g, '')}`}>{p.businessPm.phone}</a>
            ) : null}
            {p.businessPm?.email ? (
              <a className="detail-line" href={`mailto:${p.businessPm.email}`}>{p.businessPm.email}</a>
            ) : null}
          </Detail>
```

- [ ] **Step 10: Run the tests to verify they pass**

Run: `npx vitest run server client`
Expected: PASS.

- [ ] **Step 11: Run the whole suite and the type check**

Run: `npm test` → Expected: PASS (all tests).
Run: `npm run typecheck` → Expected: exit code 0.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: project managers picked from Resources, existing names moved into people"
```

---

### Task 3: The workload engine

A pure function, run on both server and client, that turns people, leave and assignments into weekly load.

**Files:**
- Create: `shared/capacity.ts`
- Test: `shared/capacity.test.ts` (new)

**Interfaces:**
- Consumes: `addDays`, `countWorkingDays`, `dayOfWeek`, `DateRange`, `ISODate`, `WorkCalendar`, `DEFAULT_CALENDAR` (M1).
- Produces:
  - `CapacityResource { id; name; capacity; leave: DateRange[] }`
  - `CapacityAssignment { id; resourceId; phaseId; projectId; projectName; phaseName; start; end; allocation }`
  - `WeekItem { assignmentId; phaseId; projectId; projectName; phaseName; allocation; days }`
  - `WeekLoad { weekStart; workingDays; leaveDays; load; available; overloaded; items }`. `load` and `available` are % of a full-time week, rounded to 0.1.
  - `PersonLoad { resourceId; name; weeks: WeekLoad[] }`
  - `weekStartOf(d)`: the Monday on or before `d`.
  - `weeksCovering(range)`: the Mondays from `weekStartOf(range.start)` up to `range.end`.
  - `computeWorkload(resources, assignments, range, cal): PersonLoad[]`, in the order of `resources`.
  - `OVERLOAD_TOLERANCE = 0.5`

- [ ] **Step 1: Write the failing test** `shared/capacity.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_CALENDAR } from './calendar';
import { computeWorkload, weekStartOf, weeksCovering, type CapacityAssignment, type CapacityResource } from './capacity';

const fatima: CapacityResource = { id: 1, name: 'Fatima', capacity: 100, leave: [] };

let nextId = 1;
function assign(p: Partial<CapacityAssignment> & Pick<CapacityAssignment, 'start' | 'end' | 'allocation'>): CapacityAssignment {
  return { id: nextId++, resourceId: 1, phaseId: 10, projectId: 100, projectName: 'Portal', phaseName: 'Development', ...p };
}

// 2026-10-05 is a Monday; 2026-10-10/11 are the weekend.
const oneWeek = { start: '2026-10-05', end: '2026-10-11' };
const weekOf = (resources: CapacityResource[], assignments: CapacityAssignment[], cal = DEFAULT_CALENDAR) =>
  computeWorkload(resources, assignments, oneWeek, cal)[0].weeks[0];

describe('weeks', () => {
  it('starts every week on the Monday on or before a date', () => {
    expect(weekStartOf('2026-10-05')).toBe('2026-10-05');
    expect(weekStartOf('2026-10-08')).toBe('2026-10-05');
    expect(weekStartOf('2026-10-11')).toBe('2026-10-05');
    expect(weekStartOf('2026-10-12')).toBe('2026-10-12');
  });

  it('lists the Mondays covering a range', () => {
    expect(weeksCovering({ start: '2026-10-07', end: '2026-10-19' })).toEqual(['2026-10-05', '2026-10-12', '2026-10-19']);
  });
});

describe('computeWorkload', () => {
  it('counts a full week at 100% as fully booked, not overbooked', () => {
    const w = weekOf([fatima], [assign({ start: '2026-10-05', end: '2026-10-09', allocation: 100 })]);
    expect(w).toMatchObject({ weekStart: '2026-10-05', workingDays: 5, leaveDays: 0, load: 100, available: 100, overloaded: false });
    expect(w.items).toEqual([expect.objectContaining({ projectName: 'Portal', phaseName: 'Development', allocation: 100, days: 5 })]);
  });

  it('adds up overlapping assignments and flags the overbooking', () => {
    const w = weekOf([fatima], [
      assign({ start: '2026-10-05', end: '2026-10-09', allocation: 60 }),
      assign({ start: '2026-09-28', end: '2026-10-16', allocation: 60, projectName: 'HR', phaseName: 'QA' }),
    ]);
    expect(w).toMatchObject({ load: 120, available: 100, overloaded: true });
    expect(w.items).toHaveLength(2);
  });

  it('weights a phase that covers only part of the week', () => {
    // Wednesday to Friday = 3 of 5 working days.
    expect(weekOf([fatima], [assign({ start: '2026-10-07', end: '2026-10-16', allocation: 100 })]).load).toBe(60);
  });

  it("uses the person's capacity", () => {
    const rami = { ...fatima, capacity: 80 };
    expect(weekOf([rami], [assign({ start: '2026-10-05', end: '2026-10-09', allocation: 100 })])).toMatchObject({
      load: 100, available: 80, overloaded: true,
    });
  });

  it('takes leave out of what the person can give, so work during leave is an overbooking', () => {
    const onLeave = { ...fatima, leave: [{ start: '2026-10-05', end: '2026-10-06' }] };
    expect(weekOf([onLeave], [])).toMatchObject({ leaveDays: 2, load: 0, available: 60, overloaded: false });
    expect(weekOf([onLeave], [assign({ start: '2026-10-05', end: '2026-10-09', allocation: 100 })])).toMatchObject({
      load: 100, available: 60, overloaded: true,
    });
  });

  it('ignores holidays and weekends when counting days', () => {
    const cal = { weekendDays: [0, 6], holidays: [{ start: '2026-10-05', end: '2026-10-05' }] };
    expect(weekOf([fatima], [assign({ start: '2026-10-05', end: '2026-10-11', allocation: 100 })], cal)).toMatchObject({
      workingDays: 4, load: 100, available: 100, overloaded: false,
    });
  });

  it('shows a week with no working days as empty', () => {
    const cal = { weekendDays: [0, 6], holidays: [{ start: '2026-10-05', end: '2026-10-09' }] };
    expect(weekOf([fatima], [assign({ start: '2026-10-05', end: '2026-10-09', allocation: 100 })], cal)).toMatchObject({
      workingDays: 0, load: 0, available: 0, overloaded: false, items: [],
    });
  });

  it('does not flag rounding noise', () => {
    const w = weekOf([fatima], [34, 33, 33.4].map((allocation) => assign({ start: '2026-10-05', end: '2026-10-09', allocation })));
    expect(w.overloaded).toBe(false);
  });

  it("only counts each person's own assignments, and keeps the order of the people given", () => {
    const rami: CapacityResource = { id: 2, name: 'Rami', capacity: 100, leave: [] };
    const loads = computeWorkload([rami, fatima], [assign({ start: '2026-10-05', end: '2026-10-09', allocation: 50 })], oneWeek, DEFAULT_CALENDAR);
    expect(loads.map((l) => [l.name, l.weeks[0].load])).toEqual([['Rami', 0], ['Fatima', 50]]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run shared/capacity.test.ts`
Expected: FAIL with "Failed to resolve import './capacity'".

- [ ] **Step 3: Create `shared/capacity.ts`**

```ts
import { addDays, countWorkingDays, dayOfWeek, type DateRange, type ISODate, type WorkCalendar } from './calendar';

export interface CapacityResource {
  id: number;
  name: string;
  /** % of a full working week this person can give. */
  capacity: number;
  leave: DateRange[];
}

export interface CapacityAssignment {
  id: number;
  resourceId: number;
  phaseId: number;
  projectId: number;
  projectName: string;
  phaseName: string;
  start: ISODate;
  end: ISODate;
  /** % of the person's day on this phase. */
  allocation: number;
}

export interface WeekItem {
  assignmentId: number;
  phaseId: number;
  projectId: number;
  projectName: string;
  phaseName: string;
  allocation: number;
  /** Working days of this week the assignment covers. */
  days: number;
}

export interface WeekLoad {
  /** Monday. */
  weekStart: ISODate;
  workingDays: number;
  leaveDays: number;
  /** Work booked this week, as % of a full-time week. */
  load: number;
  /** What the person can give this week, as % of a full-time week: capacity reduced by leave. */
  available: number;
  overloaded: boolean;
  items: WeekItem[];
}

export interface PersonLoad {
  resourceId: number;
  name: string;
  weeks: WeekLoad[];
}

/** Booked may exceed available by this many percentage points before it counts as overbooked (rounding noise). */
export const OVERLOAD_TOLERANCE = 0.5;

/** The Monday on or before the date. */
export function weekStartOf(d: ISODate): ISODate {
  return addDays(d, -((dayOfWeek(d) + 6) % 7));
}

/** The Mondays of every week that touches the range. */
export function weeksCovering(range: DateRange): ISODate[] {
  const weeks: ISODate[] = [];
  for (let w = weekStartOf(range.start); w <= range.end; w = addDays(w, 7)) weeks.push(w);
  return weeks;
}

function overlapWorkingDays(a: DateRange, b: DateRange, cal: WorkCalendar): number {
  const start = a.start > b.start ? a.start : b.start;
  const end = a.end < b.end ? a.end : b.end;
  return start > end ? 0 : countWorkingDays(start, end, cal);
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Weekly load for each person over the range. Booked % = Σ allocation × working days the assignment covers that week
 * ÷ that week's working days. Available % = capacity × (working days − leave days) ÷ working days.
 */
export function computeWorkload(
  resources: CapacityResource[],
  assignments: CapacityAssignment[],
  range: DateRange,
  cal: WorkCalendar,
): PersonLoad[] {
  const weeks = weeksCovering(range);
  return resources.map((person) => {
    const own = assignments.filter((a) => a.resourceId === person.id);
    return {
      resourceId: person.id,
      name: person.name,
      weeks: weeks.map((weekStart): WeekLoad => {
        const week = { start: weekStart, end: addDays(weekStart, 6) };
        const workingDays = countWorkingDays(week.start, week.end, cal);
        const leaveDays = Math.min(workingDays, person.leave.reduce((sum, l) => sum + overlapWorkingDays(week, l, cal), 0));
        const items: WeekItem[] = workingDays === 0 ? [] : own
          .map((a) => ({
            assignmentId: a.id,
            phaseId: a.phaseId,
            projectId: a.projectId,
            projectName: a.projectName,
            phaseName: a.phaseName,
            allocation: a.allocation,
            days: overlapWorkingDays(week, a, cal),
          }))
          .filter((i) => i.days > 0);
        const load = workingDays === 0 ? 0 : items.reduce((sum, i) => sum + (i.allocation * i.days) / workingDays, 0);
        const available = workingDays === 0 ? 0 : (person.capacity * (workingDays - leaveDays)) / workingDays;
        return {
          weekStart,
          workingDays,
          leaveDays,
          load: round1(load),
          available: round1(available),
          overloaded: load > available + OVERLOAD_TOLERANCE,
          items,
        };
      }),
    };
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run shared/capacity.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Run the whole suite and the type check**

Run: `npm test` → Expected: PASS (all tests).
Run: `npm run typecheck` → Expected: exit code 0.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: weekly workload engine with capacity and leave"
```

---

### Task 4: Assignments, workload data and overload decisions — storage and API

**Files:**
- Modify: `server/db.ts` (append migration 7), `shared/types.ts`, `shared/schemas.ts`, `server/projects/repo.ts`, `server/resources/repo.ts`, `server/app.ts`, `client/testing/mockFetch.ts`
- Create: `server/assignments/repo.ts`
- Test: `server/assignments/assignments.test.ts` (new)

**Interfaces:**
- Consumes: `CapacityResource`, `CapacityAssignment` (Task 3); `getCalendar` (M1); `USAGE` in `server/resources/repo.ts` (Tasks 1–2); `checkRefs` (Task 2); `transaction` (M3).
- Produces:
  - `shared/types.ts`:
    - `ASSIGNMENT_ROLES = ['responsible', 'contributor'] as const`, `AssignmentRole`
    - `AssignmentRecord { id; phaseId; resource: Ref; allocation; role }`
    - `ProjectRecord.assignments: AssignmentRecord[]`, ordered by phase, then id
    - `OVERLOAD_DECISIONS = ['split', 'reassign', 'accept'] as const`, `OverloadDecisionKind`
    - `OverloadDecision { id; resourceId; weekStart; decision; note; date }`
    - `WorkloadAssignment extends CapacityAssignment { role }`
    - `WorkloadData { calendar; resources: CapacityResource[]; assignments: WorkloadAssignment[]; decisions: OverloadDecision[] }`
  - `shared/schemas.ts`:
    - `assignmentInputSchema`:
      - `resourceId` is required, with the message "Choose a person".
      - `allocation` is 1–100: "Allocation must be between 1% and 100%".
      - `role` defaults to `'contributor'`.
    - `phaseAssignmentsSchema`: at most 50. A repeated person gives "The same person is assigned twice to this phase" on `[i].resourceId`.
    - `phaseInputSchema` gains `assignments` (default `[]`).
    - `assignmentsUpdateSchema = { assignments }`.
    - `overloadDecisionSchema`: `resourceId`; `weekStart` must be a Monday, otherwise "Week must start on a Monday"; `decision`; optional `note`.
    - Types `AssignmentInput`, `AssignmentData`, `OverloadDecisionInput`, `OverloadDecisionData`.
  - `server/assignments/repo.ts`:
    - `checkAssignmentPeople(db, list, path, alreadyOnPhase?)`. The messages are "Unknown person", "`<name>` is a business contact; only the tech team can be assigned" and "`<name>` is inactive" — but the last check is skipped for a resourceId already in `alreadyOnPhase`, so a person deactivated after being assigned doesn't block every later save of a phase they're already on (post-M4-review fix, 2026-09-25 — this reconciles the check with the "deactivate, don't delete, they stay on their projects" rule below). `POST /api/projects` calls it with no `alreadyOnPhase` (a brand-new phase has nothing to be lenient about); `PUT /api/phases/:id/assignments` passes the phase's current, pre-update resourceIds via `phaseAssignmentResourceIds(db, phaseId)`.
    - `saveAssignments`, `projectAssignments`, `assignmentsByProject`, `phaseProjectId`, `isTechPerson`, `workloadData`, `recordDecision`, `listDecisions`
  - HTTP:
    - `POST /api/projects` accepts `phases[].assignments`.
    - `PUT /api/phases/:id/assignments` `{ assignments }` replaces that phase's people and returns the updated `ProjectRecord`. It gives 400 `{ error: 'Invalid assignments', issues }`, or 404 `{ error: 'Phase not found' }`.
    - `GET /api/workload` → `WorkloadData`:
      - only **active tech** people, sorted by name, each with their leave as `{ start, end }`;
      - every assignment, ordered by phase start;
      - the calendar;
      - every decision.
    - `POST /api/overloads/decisions` → 201 `OverloadDecision`, where `date` is today. It gives 400 `{ error: 'Invalid decision', issues }`, or 404 `{ error: 'Person not found' }` for anyone who isn't a tech person.
  - Resources `USAGE` gains "they are assigned to N phase(s)".
  - `sampleProject()` gains `assignments: []`.

- [ ] **Step 1: Write the failing test** `server/assignments/assignments.test.ts`

```ts
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
      { id: people.fatima, name: 'Fatima Noor', capacity: 100, leave: [{ start: '2026-10-12', end: '2026-10-16' }] },
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

  it('will not delete someone who is assigned to a phase', async () => {
    await projectWith([{ resourceId: people.fatima, allocation: 60 }]);
    const res = await app.inject({ method: 'DELETE', url: `/api/resources/${people.fatima}` });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({
      error: "Fatima Noor can't be deleted because they are assigned to 1 phase. Make them inactive instead.",
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run server/assignments`
Expected: FAIL. `p.assignments` is undefined, and `/api/phases/…`, `/api/workload` and `/api/overloads/decisions` return 404.

- [ ] **Step 3: Append migration 7 to `server/db.ts`** (after migration 6)

```ts
  `
  CREATE TABLE assignments (
    id INTEGER PRIMARY KEY,
    phase_id INTEGER NOT NULL REFERENCES phases(id) ON DELETE CASCADE,
    resource_id INTEGER NOT NULL REFERENCES resources(id),
    allocation INTEGER NOT NULL,
    role TEXT NOT NULL
  );
  CREATE INDEX assignments_phase ON assignments(phase_id);
  CREATE INDEX assignments_resource ON assignments(resource_id);

  CREATE TABLE events (
    id INTEGER PRIMARY KEY,
    type TEXT NOT NULL,
    effective_date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    resource_id INTEGER REFERENCES resources(id) ON DELETE CASCADE,
    week_start TEXT,
    decision TEXT,
    note TEXT
  );
  CREATE INDEX events_type ON events(type);
  `,
```

- [ ] **Step 4: Types (`shared/types.ts`)**

Change the first import to `import type { ISODate, WorkCalendar } from './calendar';`, and add `import type { CapacityAssignment, CapacityResource } from './capacity';`.

Add after `BusinessContact`:

```ts
export const ASSIGNMENT_ROLES = ['responsible', 'contributor'] as const;
export type AssignmentRole = (typeof ASSIGNMENT_ROLES)[number];

/** A tech-team person working on a phase for part of their week. */
export interface AssignmentRecord {
  id: number;
  phaseId: number;
  resource: Ref;
  /** % of the person's day. */
  allocation: number;
  role: AssignmentRole;
}

export const OVERLOAD_DECISIONS = ['split', 'reassign', 'accept'] as const;
export type OverloadDecisionKind = (typeof OVERLOAD_DECISIONS)[number];

/** A recorded answer to an overbooked week. */
export interface OverloadDecision {
  id: number;
  resourceId: number;
  /** Monday of the overbooked week. */
  weekStart: ISODate;
  decision: OverloadDecisionKind;
  note: string | null;
  /** When the decision was made. */
  date: ISODate;
}

export interface WorkloadAssignment extends CapacityAssignment {
  role: AssignmentRole;
}

/** Everything the workload heatmap and the live warnings need; the browser runs computeWorkload on it. */
export interface WorkloadData {
  calendar: WorkCalendar;
  /** Active tech-team people only. */
  resources: CapacityResource[];
  assignments: WorkloadAssignment[];
  decisions: OverloadDecision[];
}
```

In `ProjectRecord`, add after `scopeItems`:

```ts
  /** Who works on which phase; each has the phaseId it belongs to. Ordered by phase, then id. */
  assignments: AssignmentRecord[];
```

In `client/testing/mockFetch.ts`, in `sampleProject`, add `assignments: [],` after `scopeItems: [],`.

- [ ] **Step 5: Input rules (`shared/schemas.ts`)**

- Change the `./calendar` import to `import { dayOfWeek, isISODate } from './calendar';`.
- Add `ASSIGNMENT_ROLES` and `OVERLOAD_DECISIONS` to the `./types` import.
- Add directly **above** `phaseInputSchema`:

```ts
export const assignmentInputSchema = z.object({
  resourceId: z
    .number({ required_error: 'Choose a person', invalid_type_error: 'Choose a person' })
    .int('Choose a person')
    .positive('Choose a person'),
  allocation: z
    .number({ invalid_type_error: 'Allocation must be a number' })
    .int('Allocation must be a whole number')
    .min(1, 'Allocation must be between 1% and 100%')
    .max(100, 'Allocation must be between 1% and 100%'),
  role: z.enum(ASSIGNMENT_ROLES).default('contributor'),
});

/** A phase's people: each person at most once. */
export const phaseAssignmentsSchema = z
  .array(assignmentInputSchema)
  .max(50)
  .superRefine((list, ctx) => {
    const seen = new Set<number>();
    list.forEach((a, i) => {
      if (seen.has(a.resourceId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'The same person is assigned twice to this phase', path: [i, 'resourceId'] });
      }
      seen.add(a.resourceId);
    });
  });
```

- In `phaseInputSchema`, add a third field after `durationDays`:

```ts
  assignments: phaseAssignmentsSchema.default([]),
```

- Append at the end of the file:

```ts
export const assignmentsUpdateSchema = z.object({ assignments: phaseAssignmentsSchema });

export const overloadDecisionSchema = z.object({
  resourceId: z.number().int().positive(),
  weekStart: isoDate.refine((d) => !isISODate(d) || dayOfWeek(d) === 1, 'Week must start on a Monday'),
  decision: z.enum(OVERLOAD_DECISIONS),
  note: optionalText(500),
});

export type AssignmentInput = z.input<typeof assignmentInputSchema>;
export type AssignmentData = z.output<typeof assignmentInputSchema>;
export type OverloadDecisionInput = z.input<typeof overloadDecisionSchema>;
export type OverloadDecisionData = z.output<typeof overloadDecisionSchema>;
```

- [ ] **Step 6: Create `server/assignments/repo.ts`**

```ts
import type { DatabaseSync } from 'node:sqlite';
import type { ISODate } from '../../shared/calendar';
import type { AssignmentData, OverloadDecisionData, ValidationIssue } from '../../shared/schemas';
import type {
  AssignmentRecord, AssignmentRole, OverloadDecision, OverloadDecisionKind, Side, WorkloadAssignment, WorkloadData,
} from '../../shared/types';
import { getCalendar } from '../settings';

interface AssignmentRow {
  id: number;
  phase_id: number;
  resource_id: number;
  allocation: number;
  role: AssignmentRole;
  resource_name: string;
  project_id: number;
}

interface EventRow {
  id: number;
  effective_date: string;
  resource_id: number;
  week_start: string;
  decision: OverloadDecisionKind;
  note: string | null;
}

const SELECT_ASSIGNMENTS = `
  SELECT a.*, r.name AS resource_name, p.project_id
  FROM assignments a
  JOIN resources r ON r.id = a.resource_id
  JOIN phases p ON p.id = a.phase_id`;

function toAssignment(row: AssignmentRow): AssignmentRecord {
  return {
    id: row.id,
    phaseId: row.phase_id,
    resource: { id: row.resource_id, name: row.resource_name },
    allocation: row.allocation,
    role: row.role,
  };
}

/** Everyone assigned must exist, be on the tech team and be active. `path` prefixes each issue, e.g. "phases.0.assignments". */
export function checkAssignmentPeople(db: DatabaseSync, list: { resourceId: number }[], path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  list.forEach((a, i) => {
    const person = db.prepare('SELECT name, side, active FROM resources WHERE id = ?').get(a.resourceId) as unknown as
      | { name: string; side: Side; active: number }
      | undefined;
    const at = `${path}.${i}.resourceId`;
    if (!person) issues.push({ path: at, message: 'Unknown person' });
    else if (person.side !== 'tech') issues.push({ path: at, message: `${person.name} is a business contact; only the tech team can be assigned` });
    else if (person.active !== 1) issues.push({ path: at, message: `${person.name} is inactive` });
  });
  return issues;
}

/** Replaces a phase's people. Call inside a transaction. */
export function saveAssignments(db: DatabaseSync, phaseId: number, list: AssignmentData[]): void {
  db.prepare('DELETE FROM assignments WHERE phase_id = ?').run(phaseId);
  const insert = db.prepare('INSERT INTO assignments (phase_id, resource_id, allocation, role) VALUES (?, ?, ?, ?)');
  for (const a of list) insert.run(phaseId, a.resourceId, a.allocation, a.role);
}

export function projectAssignments(db: DatabaseSync, projectId: number): AssignmentRecord[] {
  const rows = db
    .prepare(`${SELECT_ASSIGNMENTS} WHERE p.project_id = ? ORDER BY p.sort_order, a.id`)
    .all(projectId) as unknown as AssignmentRow[];
  return rows.map(toAssignment);
}

export function assignmentsByProject(db: DatabaseSync): Map<number, AssignmentRecord[]> {
  const rows = db.prepare(`${SELECT_ASSIGNMENTS} ORDER BY p.project_id, p.sort_order, a.id`).all() as unknown as AssignmentRow[];
  const grouped = new Map<number, AssignmentRecord[]>();
  for (const row of rows) grouped.set(row.project_id, [...(grouped.get(row.project_id) ?? []), toAssignment(row)]);
  return grouped;
}

/** The project a phase belongs to, or undefined when there is no such phase. */
export function phaseProjectId(db: DatabaseSync, phaseId: number): number | undefined {
  const row = db.prepare('SELECT project_id FROM phases WHERE id = ?').get(phaseId) as unknown as { project_id: number } | undefined;
  return row?.project_id;
}

export function isTechPerson(db: DatabaseSync, id: number): boolean {
  return db.prepare("SELECT id FROM resources WHERE id = ? AND side = 'tech'").get(id) !== undefined;
}

function toDecision(row: EventRow): OverloadDecision {
  return {
    id: row.id,
    resourceId: row.resource_id,
    weekStart: row.week_start,
    decision: row.decision,
    note: row.note,
    date: row.effective_date,
  };
}

export function listDecisions(db: DatabaseSync): OverloadDecision[] {
  const rows = db.prepare("SELECT * FROM events WHERE type = 'overload-resolved' ORDER BY id").all() as unknown as EventRow[];
  return rows.map(toDecision);
}

export function recordDecision(db: DatabaseSync, d: OverloadDecisionData, today: ISODate): OverloadDecision {
  const res = db
    .prepare(
      "INSERT INTO events (type, effective_date, created_at, resource_id, week_start, decision, note) VALUES ('overload-resolved', ?, ?, ?, ?, ?, ?)",
    )
    .run(today, new Date().toISOString(), d.resourceId, d.weekStart, d.decision, d.note);
  return toDecision(db.prepare('SELECT * FROM events WHERE id = ?').get(Number(res.lastInsertRowid)) as unknown as EventRow);
}

/** Active tech-team people with their leave, every assignment with its phase dates, the calendar, and every decision. */
export function workloadData(db: DatabaseSync): WorkloadData {
  const people = db
    .prepare("SELECT id, name, capacity FROM resources WHERE side = 'tech' AND active = 1 ORDER BY name COLLATE NOCASE, id")
    .all() as unknown as { id: number; name: string; capacity: number }[];
  const leave = db.prepare('SELECT resource_id, start_date, end_date FROM leave ORDER BY start_date, id').all() as unknown as {
    resource_id: number;
    start_date: string;
    end_date: string;
  }[];
  const assignments = db
    .prepare(
      `SELECT a.id, a.resource_id, a.phase_id, a.allocation, a.role, p.name AS phase_name, p.planned_start, p.planned_end,
              pr.id AS project_id, pr.name AS project_name
       FROM assignments a
       JOIN phases p ON p.id = a.phase_id
       JOIN projects pr ON pr.id = p.project_id
       ORDER BY p.planned_start, a.id`,
    )
    .all() as unknown as {
    id: number;
    resource_id: number;
    phase_id: number;
    allocation: number;
    role: AssignmentRole;
    phase_name: string;
    planned_start: string;
    planned_end: string;
    project_id: number;
    project_name: string;
  }[];

  return {
    calendar: getCalendar(db),
    resources: people.map((p) => ({
      id: p.id,
      name: p.name,
      capacity: p.capacity,
      leave: leave.filter((l) => l.resource_id === p.id).map((l) => ({ start: l.start_date, end: l.end_date })),
    })),
    assignments: assignments.map(
      (a): WorkloadAssignment => ({
        id: a.id,
        resourceId: a.resource_id,
        phaseId: a.phase_id,
        projectId: a.project_id,
        projectName: a.project_name,
        phaseName: a.phase_name,
        start: a.planned_start,
        end: a.planned_end,
        allocation: a.allocation,
        role: a.role,
      }),
    ),
    decisions: listDecisions(db),
  };
}
```

- [ ] **Step 7: Assignments on projects (`server/projects/repo.ts`)**

- Add `AssignmentRecord` to the type import from `../../shared/types`. Add:

```ts
import { assignmentsByProject, projectAssignments, saveAssignments } from '../assignments/repo';
```

- Add a last parameter `assignments: AssignmentRecord[]` to `toProject`, and the property `assignments,` after `scopeItems,` in the object it returns.
- In `createProject`, replace the line `for (const p of scheduled) insertPhase.run(projectId, p.name, p.order, p.durationDays, p.start, p.end);` with:

```ts
    scheduled.forEach((p, i) => {
      const phaseId = Number(insertPhase.run(projectId, p.name, p.order, p.durationDays, p.start, p.end).lastInsertRowid);
      saveAssignments(db, phaseId, input.phases[i].assignments);
    });
```

- In `getProject`, pass `projectAssignments(db, id)` as the last argument to `toProject`.
- In `listProjects`, add `const assignments = assignmentsByProject(db);` and pass `assignments.get(r.id) ?? []` as the last argument.

In `server/resources/repo.ts`, add a second entry to `USAGE`:

```ts
  {
    sql: 'SELECT COUNT(*) AS n FROM assignments WHERE resource_id = ?',
    reason: (n) => `they are assigned to ${n} phase${n === 1 ? '' : 's'}`,
  },
```

- [ ] **Step 8: Routes (`server/app.ts`)**

- Add `assignmentsUpdateSchema` and `overloadDecisionSchema` to the `../shared/schemas` import, and `transaction` from `./db`.
- Add:

```ts
import {
  checkAssignmentPeople, isTechPerson, phaseProjectId, recordDecision, saveAssignments, workloadData,
} from './assignments/repo';
```

- In `app.post('/api/projects', …)`, replace the line `const issues = checkRefs(db, parsed.data);` with:

```ts
    const issues = [
      ...checkRefs(db, parsed.data),
      ...parsed.data.phases.flatMap((p, i) => checkAssignmentPeople(db, p.assignments, `phases.${i}.assignments`)),
    ];
```

- Add these routes after the `PUT /api/projects/:id/details` route:

```ts
  app.put<{ Params: { id: string } }>('/api/phases/:id/assignments', async (req, reply) => {
    const phaseId = Number(req.params.id);
    const projectId = phaseProjectId(db, phaseId);
    if (projectId === undefined) return reply.code(404).send({ error: 'Phase not found' });
    const parsed = assignmentsUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid assignments', issues: toIssues(parsed.error) });
    const issues = checkAssignmentPeople(db, parsed.data.assignments, 'assignments');
    if (issues.length > 0) return reply.code(400).send({ error: 'Invalid assignments', issues });
    transaction(db, () => saveAssignments(db, phaseId, parsed.data.assignments));
    return getProject(db, projectId);
  });

  app.get('/api/workload', async () => workloadData(db));

  app.post('/api/overloads/decisions', async (req, reply) => {
    const parsed = overloadDecisionSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid decision', issues: toIssues(parsed.error) });
    if (!isTechPerson(db, parsed.data.resourceId)) return reply.code(404).send({ error: 'Person not found' });
    return reply.code(201).send(recordDecision(db, parsed.data, today()));
  });
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npx vitest run server`
Expected: PASS.

- [ ] **Step 10: Run the whole suite and the type check**

Run: `npm test` → Expected: PASS (all tests).
Run: `npm run typecheck` → Expected: exit code 0.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: assignments, workload data and overload decisions, storage and API"
```

---

### Task 5: Resources page and person form

**Files:**
- Modify: `client/api.ts`, `client/App.tsx`, `client/pages/manage/labels.ts`, `client/pages/manage/SettingsPage.tsx`, `client/pages/manage/ManageDashboardPage.tsx`, `client/styles.css`
- Create: `client/errors.ts`, `client/pages/manage/ResourcesPage.tsx`, `client/pages/manage/PersonPage.tsx`
- Test: `client/pages/manage/ResourcesPage.test.tsx` (new), `client/pages/manage/PersonPage.test.tsx` (new), `client/pages/manage/ManageDashboardPage.test.tsx` (one assertion)

**Interfaces:**
- Consumes: `api.listResources`, `api.createResource` (Task 2); `resourceInputSchema`, `ResourceInput`, `LeaveInput`, `toIssues` (Task 1); `ResourceRecord`, `Side`, `Specialisation`, `LeaveRecord` (Task 1); `samplePeople`, `sampleLists` (Tasks 1–2); `useAsync` (M1); `ApiError` (M3); `.list-editor*` styles (M3).
- Produces:
  - `api.updateResource(id, input)`, `api.deleteResource(id)`, `api.addLeave(resourceId, input)`, `api.deleteLeave(id)`.
  - `client/errors.ts`: `messagesOf(err): string[]`, which gives the server's issue messages, or the error's message.
  - `labels.ts`: `SIDE_LABEL`, `SPECIALISATION_LABEL`, `formatDate(d)` (e.g. "12 Oct 2026").
  - Routes:
    - `/manage/resources` → `ResourcesPage`: a "People" card with the filters "Side" and "Role" and a table. Task 7 adds the heatmap here.
    - `/manage/resources/new` and `/manage/resources/:id` → `PersonPage`.
  - `PersonPage` labels:
    - Radios "Tech team" and "Business side", in a fieldset with the legend "Side".
    - "Name".
    - Tech side only: "Role", "Specialisation", "Capacity (%)".
    - "Email", "Phone (UAE mobile)", "Active".
    - Buttons "Add person" or "Save changes", "Cancel" (new) or "Delete person" (existing).
  - `PersonPage` leave card (existing tech people):
    - "Leave from", "Leave to", "Note", and a button "Add leave".
    - Each entry reads "12 Oct 2026 → 16 Oct 2026 · Annual leave", with a button "Remove leave from 12 Oct 2026".
  - Settings has a "Roles" editor (singular "Role").
  - The dashboard header has a "Resources" link.

- [ ] **Step 1: Write the failing tests**

`client/pages/manage/ResourcesPage.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { mockFetch, sampleLists, samplePeople } from '../../testing/mockFetch';
import { ResourcesPage } from './ResourcesPage';

const routes = {
  'GET /api/resources': () => ({ body: samplePeople() }),
  'GET /api/lists': () => ({ body: sampleLists() }),
};

const renderPage = () => render(<MemoryRouter><ResourcesPage /></MemoryRouter>);
/** The people table (Task 7 adds a second table, the workload heatmap, to this page). */
const peopleTable = () => screen.findByRole('table', { name: 'People' });
const names = async () => within(await peopleTable()).getAllByRole('link').map((a) => a.textContent);

describe('ResourcesPage', () => {
  it('lists everyone with their side, role, capacity and contact', async () => {
    mockFetch(routes);
    renderPage();
    const table = within(await peopleTable());
    const rami = table.getByRole('link', { name: 'Rami Saleh' });
    expect(rami).toHaveAttribute('href', '/manage/resources/72');
    const row = rami.closest('tr')!;
    expect(within(row).getByText('Tech team')).toBeInTheDocument();
    expect(within(row).getByText('Developer · Back end')).toBeInTheDocument();
    expect(within(row).getByText('80%')).toBeInTheDocument();
    const mariam = table.getByRole('link', { name: 'Mariam Al Suwaidi' }).closest('tr')!;
    expect(within(mariam).getByText('Business side')).toBeInTheDocument();
    expect(within(mariam).getByText('+971 50 123 4567 · mariam@example.com')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add person' })).toHaveAttribute('href', '/manage/resources/new');
  });

  it('filters by side and by role', async () => {
    mockFetch(routes);
    const user = userEvent.setup();
    renderPage();
    await peopleTable();
    await user.selectOptions(screen.getByLabelText('Side'), 'Business side');
    expect(await names()).toEqual(['Mariam Al Suwaidi']);
    await user.selectOptions(screen.getByLabelText('Side'), 'Everyone');
    await user.selectOptions(screen.getByLabelText('Role'), 'Developer');
    expect(await names()).toEqual(['Fatima Noor', 'Rami Saleh']);
  });

  it('invites adding people when there are none', async () => {
    mockFetch({ ...routes, 'GET /api/resources': () => ({ body: [] }) });
    renderPage();
    expect(await screen.findByText('No one yet. Add your team and your business-side contacts.')).toBeInTheDocument();
  });
});
```

`client/pages/manage/PersonPage.test.tsx`:

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { LeaveRecord, ResourceRecord } from '../../../shared/types';
import { mockFetch, sampleLists, samplePeople, type MockHandler } from '../../testing/mockFetch';
import { PersonPage } from './PersonPage';

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/manage/resources" element={<div>Resources list</div>} />
        <Route path="/manage/resources/new" element={<PersonPage />} />
        <Route path="/manage/resources/:id" element={<PersonPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** A small in-memory stand-in for the people API, so reloads show changes. */
function fakeServer(): Record<string, MockHandler> {
  const people: ResourceRecord[] = samplePeople();
  let nextLeave = 900;
  const fatima = () => people.find((p) => p.id === 71)!;
  return {
    'GET /api/resources': () => ({ body: structuredClone(people) }),
    'GET /api/lists': () => ({ body: sampleLists() }),
    'POST /api/resources': (init) => ({ status: 201, body: { ...people[0], ...JSON.parse(init!.body as string), id: 99 } }),
    'PUT /api/resources/72': (init) => ({ body: { ...people[2], ...JSON.parse(init!.body as string) } }),
    'DELETE /api/resources/70': () => ({
      status: 409,
      body: { error: "Sara Ahmed can't be deleted because they are a project manager on 2 projects. Make them inactive instead." },
    }),
    'POST /api/resources/71/leave': (init) => {
      const leave: LeaveRecord = { id: nextLeave++, note: null, ...JSON.parse(init!.body as string) };
      fatima().leave.push(leave);
      return { status: 201, body: leave };
    },
    'DELETE /api/leave/900': () => {
      fatima().leave = [];
      return { status: 204, body: null };
    },
  };
}

describe('PersonPage', () => {
  it('adds a tech-team person', async () => {
    const fetchMock = mockFetch(fakeServer());
    const user = userEvent.setup();
    renderAt('/manage/resources/new');
    await user.type(screen.getByLabelText('Name'), 'Hassan Ali');
    await screen.findByRole('option', { name: 'Developer' });
    await user.selectOptions(screen.getByLabelText('Role'), 'Developer');
    await user.selectOptions(screen.getByLabelText('Specialisation'), 'Full stack');
    await user.clear(screen.getByLabelText('Capacity (%)'));
    await user.type(screen.getByLabelText('Capacity (%)'), '80');
    await user.click(screen.getByRole('button', { name: 'Add person' }));

    expect(await screen.findByText('Resources list')).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([url, init]) => url === '/api/resources' && init?.method === 'POST');
    expect(JSON.parse(post![1]!.body as string)).toMatchObject({
      name: 'Hassan Ali', side: 'tech', roleId: 63, specialisation: 'full-stack', capacity: 80, active: true,
    });
  });

  it('asks a business contact only for name, phone and email', async () => {
    const fetchMock = mockFetch(fakeServer());
    const user = userEvent.setup();
    renderAt('/manage/resources/new');
    await user.click(screen.getByRole('radio', { name: 'Business side' }));
    expect(screen.queryByLabelText('Role')).toBeNull();
    expect(screen.queryByLabelText('Capacity (%)')).toBeNull();
    await user.type(screen.getByLabelText('Name'), 'Noura Al Hammadi');
    await user.type(screen.getByLabelText('Phone (UAE mobile)'), '055 234 5678');
    await user.click(screen.getByRole('button', { name: 'Add person' }));

    expect(await screen.findByText('Resources list')).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([url, init]) => url === '/api/resources' && init?.method === 'POST');
    expect(JSON.parse(post![1]!.body as string)).toMatchObject({ name: 'Noura Al Hammadi', side: 'business', phone: '055 234 5678' });
  });

  it('shows what is wrong without saving', async () => {
    const fetchMock = mockFetch(fakeServer());
    const user = userEvent.setup();
    renderAt('/manage/resources/new');
    await user.type(screen.getByLabelText('Phone (UAE mobile)'), '04 123 4567');
    await user.click(screen.getByRole('button', { name: 'Add person' }));
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Enter a UAE mobile number, e.g. +971 50 123 4567')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('edits an existing person', async () => {
    const fetchMock = mockFetch(fakeServer());
    const user = userEvent.setup();
    renderAt('/manage/resources/72');
    expect(await screen.findByLabelText('Name')).toHaveValue('Rami Saleh');
    expect(screen.getByLabelText('Capacity (%)')).toHaveValue(80);
    await user.clear(screen.getByLabelText('Capacity (%)'));
    await user.type(screen.getByLabelText('Capacity (%)'), '100');
    await user.click(screen.getByRole('checkbox', { name: 'Active' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Resources list')).toBeInTheDocument();
    const put = fetchMock.mock.calls.find(([url, init]) => url === '/api/resources/72' && init?.method === 'PUT');
    expect(JSON.parse(put![1]!.body as string)).toMatchObject({ name: 'Rami Saleh', capacity: 100, active: false, roleId: 63 });
  });

  it('explains why someone in use cannot be deleted', async () => {
    mockFetch(fakeServer());
    const user = userEvent.setup();
    renderAt('/manage/resources/70');
    await user.click(await screen.findByRole('button', { name: 'Delete person' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Sara Ahmed can't be deleted because they are a project manager on 2 projects. Make them inactive instead.",
    );
  });

  it('books and removes leave', async () => {
    mockFetch(fakeServer());
    const user = userEvent.setup();
    renderAt('/manage/resources/71');
    expect(await screen.findByText('No leave booked.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Leave from'), { target: { value: '2026-10-12' } });
    fireEvent.change(screen.getByLabelText('Leave to'), { target: { value: '2026-10-16' } });
    await user.type(screen.getByLabelText('Note'), 'Annual leave');
    await user.click(screen.getByRole('button', { name: 'Add leave' }));
    expect(await screen.findByText('12 Oct 2026 → 16 Oct 2026 · Annual leave')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove leave from 12 Oct 2026' }));
    expect(await screen.findByText('No leave booked.')).toBeInTheDocument();
  });

  it('says when the person does not exist', async () => {
    mockFetch(fakeServer());
    renderAt('/manage/resources/999');
    expect(await screen.findByText('Person not found')).toBeInTheDocument();
  });
});
```

In `client/pages/manage/ManageDashboardPage.test.tsx`, test `'lists projects with links and dates'`, add:

```tsx
    expect(screen.getByRole('link', { name: 'Resources' })).toHaveAttribute('href', '/manage/resources');
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run client/pages/manage`
Expected: FAIL. It can't resolve `./ResourcesPage` or `./PersonPage`, and the dashboard has no "Resources" link.

- [ ] **Step 3: API calls, error messages and labels**

In `client/api.ts`:
- Add `LeaveInput` to the schemas type import, and `LeaveRecord` to the types import.
- Add to `api`:

```ts
  updateResource: (id: number, input: ResourceInput) => request<ResourceRecord>(`/api/resources/${id}`, withBody('PUT', input)),
  deleteResource: (id: number) => request<void>(`/api/resources/${id}`, { method: 'DELETE' }),
  addLeave: (resourceId: number, input: LeaveInput) =>
    request<LeaveRecord>(`/api/resources/${resourceId}/leave`, withBody('POST', input)),
  deleteLeave: (id: number) => request<void>(`/api/leave/${id}`, { method: 'DELETE' }),
```

Create `client/errors.ts`:

```ts
import { ApiError } from './api';

/** The server's field messages when there are any, otherwise the error's own message. */
export function messagesOf(err: unknown): string[] {
  if (err instanceof ApiError && err.issues.length > 0) return err.issues.map((i) => i.message);
  return [err instanceof Error ? err.message : String(err)];
}
```

Append to `client/pages/manage/labels.ts` (and add `Side`, `Specialisation` to its type import from `../../../shared/types`, plus `import type { ISODate } from '../../../shared/calendar';`):

```ts
export const SIDE_LABEL: Record<Side, string> = { tech: 'Tech team', business: 'Business side' };

export const SPECIALISATION_LABEL: Record<Specialisation, string> = {
  'front-end': 'Front end',
  'back-end': 'Back end',
  'full-stack': 'Full stack',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "12 Oct 2026". */
export function formatDate(d: ISODate): string {
  return `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
}
```

- [ ] **Step 4: Create `client/pages/manage/ResourcesPage.tsx`**

```tsx
import { useState } from 'react';
import { Link } from 'react-router';
import type { Side } from '../../../shared/types';
import { AlertIcon, ArrowLeftIcon, PlusIcon } from '../../icons';
import { api } from '../../api';
import { useAsync } from '../../useAsync';
import { SIDE_LABEL, SPECIALISATION_LABEL } from './labels';

export function ResourcesPage() {
  const people = useAsync(() => api.listResources(), []);
  const lists = useAsync(() => api.getLists(), []);
  const [side, setSide] = useState<Side | 'all'>('all');
  const [roleId, setRoleId] = useState<number | null>(null);

  const all = people.data ?? [];
  const shown = all.filter((p) => (side === 'all' || p.side === side) && (roleId === null || p.role?.id === roleId));

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <Link to="/manage" className="crumb"><ArrowLeftIcon />Projects</Link>
          <h1>Resources</h1>
          <p className="meta-line">Your tech team, who can be assigned to phases, and your business-side contacts.</p>
        </div>
        <Link to="/manage/resources/new" className="button"><PlusIcon />Add person</Link>
      </div>

      {people.error ? (
        <div className="errors" role="alert">
          <AlertIcon />
          <span>{people.error.message}</span>
        </div>
      ) : null}

      <section className="card">
        <h2>People</h2>
        <div className="filters">
          <label>
            Side
            <select value={side} onChange={(e) => setSide(e.target.value as Side | 'all')}>
              <option value="all">Everyone</option>
              <option value="tech">{SIDE_LABEL.tech}</option>
              <option value="business">{SIDE_LABEL.business}</option>
            </select>
          </label>
          <label>
            Role
            <select
              value={roleId === null ? '' : String(roleId)}
              onChange={(e) => setRoleId(e.target.value === '' ? null : Number(e.target.value))}
            >
              <option value="">All roles</option>
              {(lists.data?.role ?? []).map((r) => (
                <option key={r.id} value={String(r.id)}>{r.name}</option>
              ))}
            </select>
          </label>
        </div>

        {!people.data && !people.error ? <p className="muted">Loading…</p> : null}
        {people.data && all.length === 0 ? <p className="muted">No one yet. Add your team and your business-side contacts.</p> : null}
        {people.data && all.length > 0 && shown.length === 0 ? <p className="muted">No one matches these filters.</p> : null}

        {shown.length > 0 ? (
          <table aria-label="People">
            <thead>
              <tr><th>Name</th><th>Side</th><th>Role</th><th>Capacity</th><th>Contact</th><th>Status</th></tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id}>
                  <td><Link to={`/manage/resources/${p.id}`}>{p.name}</Link></td>
                  <td>{SIDE_LABEL[p.side]}</td>
                  <td>
                    {p.role?.name ?? '—'}
                    {p.specialisation ? ` · ${SPECIALISATION_LABEL[p.specialisation]}` : ''}
                  </td>
                  <td>{p.side === 'tech' ? `${p.capacity}%` : '—'}</td>
                  <td>{[p.phone, p.email].filter(Boolean).join(' · ') || '—'}</td>
                  <td>{p.active ? 'Active' : 'Inactive'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Create `client/pages/manage/PersonPage.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { resourceInputSchema, toIssues, type ResourceInput } from '../../../shared/schemas';
import type { ResourceRecord, Side, Specialisation } from '../../../shared/types';
import { AlertIcon, ArrowLeftIcon, PlusIcon, TrashIcon } from '../../icons';
import { api } from '../../api';
import { messagesOf } from '../../errors';
import { useAsync } from '../../useAsync';
import { SPECIALISATION_LABEL, formatDate } from './labels';

interface PersonDraft {
  name: string;
  side: Side;
  roleId: number | null;
  specialisation: Specialisation | null;
  capacity: number;
  email: string;
  phone: string;
  active: boolean;
}

const EMPTY_PERSON: PersonDraft = {
  name: '', side: 'tech', roleId: null, specialisation: null, capacity: 100, email: '', phone: '', active: true,
};

function draftFrom(p: ResourceRecord): PersonDraft {
  return {
    name: p.name,
    side: p.side,
    roleId: p.role?.id ?? null,
    specialisation: p.specialisation,
    capacity: p.capacity,
    email: p.email ?? '',
    phone: p.phone ?? '',
    active: p.active,
  };
}

function Errors({ messages }: { messages: string[] }) {
  if (messages.length === 0) return null;
  return (
    <div className="errors" role="alert">
      <AlertIcon />
      <ul>{messages.map((m) => <li key={m}>{m}</li>)}</ul>
    </div>
  );
}

/** Leave for one tech-team person: listed, added and removed right away. */
function LeaveCard({ person, onChanged }: { person: ResourceRecord; onChanged: () => void }) {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      await api.addLeave(person.id, { start, end, note });
      setStart('');
      setEnd('');
      setNote('');
      setErrors([]);
      onChanged();
    } catch (err) {
      setErrors(messagesOf(err));
    }
  }

  async function remove(id: number) {
    try {
      await api.deleteLeave(id);
      setErrors([]);
      onChanged();
    } catch (err) {
      setErrors(messagesOf(err));
    }
  }

  return (
    <section className="card">
      <h2>Leave</h2>
      <p className="muted">Days on leave count as unavailable on the workload heatmap.</p>
      <Errors messages={errors} />
      {person.leave.length === 0 ? (
        <p className="muted">No leave booked.</p>
      ) : (
        <ul className="list-editor">
          {person.leave.map((l) => (
            <li key={l.id} className="list-editor-row">
              <span className="list-editor-name">
                {formatDate(l.start)} → {formatDate(l.end)}{l.note ? ` · ${l.note}` : ''}
              </span>
              <button
                type="button"
                className="button ghost-icon"
                aria-label={`Remove leave from ${formatDate(l.start)}`}
                onClick={() => void remove(l.id)}
              >
                <TrashIcon />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="leave-add" onSubmit={add}>
        <label>Leave from<input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label>Leave to<input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
        <label>Note<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Annual leave" /></label>
        <button type="submit" className="button secondary" disabled={!start || !end}>
          <PlusIcon />Add leave
        </button>
      </form>
    </section>
  );
}

export function PersonPage() {
  const params = useParams();
  const isNew = params.id === undefined;
  const id = Number(params.id);
  const navigate = useNavigate();
  const [version, setVersion] = useState(0);
  const people = useAsync(() => api.listResources(), [version]);
  const lists = useAsync(() => api.getLists(), []);
  const [edited, setEdited] = useState<PersonDraft | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const existing = isNew ? undefined : people.data?.find((p) => p.id === id);
  const back = <Link to="/manage/resources" className="crumb"><ArrowLeftIcon />Resources</Link>;

  if (!isNew && people.error) {
    return <main className="page">{back}<Errors messages={[people.error.message]} /></main>;
  }
  if (!isNew && !people.data) return <main className="page"><p className="muted">Loading…</p></main>;
  if (!isNew && !existing) return <main className="page">{back}<Errors messages={['Person not found']} /></main>;

  // Until the user changes something, the form shows the saved person (or an empty one).
  const saved = existing ? draftFrom(existing) : EMPTY_PERSON;
  const draft = edited ?? saved;
  const patch = (changes: Partial<PersonDraft>) => setEdited((prev) => ({ ...(prev ?? saved), ...changes }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const input: ResourceInput = { ...draft };
    const parsed = resourceInputSchema.safeParse(input);
    if (!parsed.success) {
      setIssues(toIssues(parsed.error).map((i) => i.message));
      return;
    }
    setIssues([]);
    setSaving(true);
    try {
      if (existing) await api.updateResource(existing.id, input);
      else await api.createResource(input);
      navigate('/manage/resources');
    } catch (err) {
      setIssues(messagesOf(err));
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!existing) return;
    try {
      await api.deleteResource(existing.id);
      navigate('/manage/resources');
    } catch (err) {
      setIssues(messagesOf(err));
    }
  }

  return (
    <main className="page">
      <div className="page-header">
        <div>
          {back}
          <h1>{existing ? existing.name : 'Add person'}</h1>
        </div>
      </div>

      <form onSubmit={onSubmit} noValidate>
        <Errors messages={issues} />
        <section className="card">
          <h2>Details</h2>
          <fieldset className="check-group side-choice">
            <legend>Side</legend>
            <label className="check">
              <input type="radio" name="side" checked={draft.side === 'tech'} onChange={() => patch({ side: 'tech' })} />
              Tech team
            </label>
            <label className="check">
              <input type="radio" name="side" checked={draft.side === 'business'} onChange={() => patch({ side: 'business' })} />
              Business side
            </label>
          </fieldset>
          <div className="form-grid">
            <label>
              Name
              <input value={draft.name} onChange={(e) => patch({ name: e.target.value })} />
            </label>
            {draft.side === 'tech' ? (
              <>
                <label>
                  Role
                  <select
                    value={draft.roleId === null ? '' : String(draft.roleId)}
                    onChange={(e) => patch({ roleId: e.target.value === '' ? null : Number(e.target.value) })}
                  >
                    <option value="">Not set</option>
                    {(lists.data?.role ?? []).map((r) => (
                      <option key={r.id} value={String(r.id)}>{r.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Specialisation
                  <select
                    value={draft.specialisation ?? ''}
                    onChange={(e) => patch({ specialisation: e.target.value === '' ? null : (e.target.value as Specialisation) })}
                  >
                    <option value="">Not set</option>
                    {Object.entries(SPECIALISATION_LABEL).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Capacity (%)
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={Number.isNaN(draft.capacity) ? '' : draft.capacity}
                    onChange={(e) => patch({ capacity: e.target.valueAsNumber })}
                  />
                </label>
              </>
            ) : null}
            <label>
              Email
              <input type="email" value={draft.email} onChange={(e) => patch({ email: e.target.value })} />
            </label>
            <label>
              Phone (UAE mobile)
              <input type="tel" value={draft.phone} onChange={(e) => patch({ phone: e.target.value })} placeholder="+971 50 123 4567" />
            </label>
          </div>
          <label className="check active-toggle">
            <input type="checkbox" checked={draft.active} onChange={(e) => patch({ active: e.target.checked })} />
            Active
          </label>
          <p className="muted">
            {draft.side === 'tech'
              ? 'Only active tech-team people can be assigned to phases and appear on the workload heatmap.'
              : 'Business contacts can be chosen as a project’s business project manager. They are not counted in workload.'}
          </p>
        </section>

        <div className="wizard-actions">
          {existing ? (
            <button type="button" className="button danger" onClick={() => void onDelete()}>Delete person</button>
          ) : (
            <Link to="/manage/resources" className="button secondary">Cancel</Link>
          )}
          <button type="submit" className="button" disabled={saving}>
            {saving ? 'Saving…' : existing ? 'Save changes' : 'Add person'}
          </button>
        </div>
      </form>

      {existing && existing.side === 'tech' ? (
        <LeaveCard person={existing} onChanged={() => setVersion((v) => v + 1)} />
      ) : null}
    </main>
  );
}
```

- [ ] **Step 6: Routes, dashboard link and the Roles list**

In `client/App.tsx`, import `ResourcesPage` and `PersonPage` from `./pages/manage/…`, and add after the `/manage/settings` route:

```tsx
      <Route path="/manage/resources" element={<ResourcesPage />} />
      <Route path="/manage/resources/new" element={<PersonPage />} />
      <Route path="/manage/resources/:id" element={<PersonPage />} />
```

In `client/pages/manage/ManageDashboardPage.tsx`, inside `<div className="header-actions">`, add before the Settings link:

```tsx
          <Link to="/manage/resources" className="button secondary">Resources</Link>
```

In `client/pages/manage/SettingsPage.tsx`, append to `EDITORS`:

```ts
  { list: 'role', title: 'Roles', singular: 'Role' },
```

Append to `client/styles.css`:

```css
.filters { display: flex; flex-wrap: wrap; gap: var(--sp-4); margin-bottom: var(--sp-4); }
.filters label { min-width: min(12rem, 100%); }
.side-choice { margin-bottom: var(--sp-4); }
.active-toggle { margin-top: var(--sp-4); }
.leave-add {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(160px, 100%), 1fr));
  gap: var(--sp-3);
  align-items: end;
}
.button.danger { background: var(--danger); color: var(--on-primary); }
.button.danger:hover { filter: brightness(0.92); }
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run client/pages/manage`
Expected: PASS.

- [ ] **Step 8: Run the whole suite and the type check**

Run: `npm test` → Expected: PASS (all tests).
Run: `npm run typecheck` → Expected: exit code 0.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: resources page with people, person form and leave"
```

---

### Task 6: Assigning people — project page and wizard Step 4, with live overbooking warnings

**Files:**
- Modify: `client/api.ts`, `client/testing/mockFetch.ts`, `client/pages/manage/labels.ts`, `client/pages/manage/projectDraft.ts`, `client/pages/manage/CreateProjectPage.tsx`, `client/pages/manage/ProjectPage.tsx`, `client/styles.css`
- Create: `client/useWorkload.ts`, `client/overloads.ts`, `client/components/AssignmentsEditor.tsx`, `client/pages/manage/PeopleFields.tsx`, `client/pages/manage/ProjectPeople.tsx`
- Test: `client/overloads.test.ts` (new), `client/components/AssignmentsEditor.test.tsx` (new), `client/pages/manage/CreateProjectPage.test.tsx`, `client/pages/manage/ProjectPage.test.tsx`, `client/pages/manage/projectDraft.test.ts`

**Interfaces:**
- Consumes: `computeWorkload`, `WeekLoad`, `CapacityAssignment` (Task 3); `WorkloadData`, `AssignmentRole`, `AssignmentRecord`, `AssignmentInput` (Task 4); `useResources`, `samplePeople` (Task 2); `messagesOf` (Task 5); `schedulePhases`, `PhaseInput` (M1).
- Produces:
  - `api.setPhaseAssignments(phaseId, assignments): Promise<ProjectRecord>` and `api.getWorkload(): Promise<WorkloadData>`.
  - `useWorkload(): { workload, error, reload }`.
  - `client/overloads.ts`:
    - `DraftAssignment { resourceId: number | null; allocation: number; role }`
    - `PlannedAssignment`
    - `shortDate(d)`, e.g. "5 Oct"
    - `overloadsWith(data, planned, replacing?)`: `Map<resourceId, overbooked WeekLoad[]>`
    - `phaseWarnings(overloads, phase)`: `Map<resourceId, string[]>`, each line like "Week of 5 Oct: 150% booked, 100% available (2 days of leave)"
  - `AssignmentsEditor({ phaseName, dates, people, value, onChange, warnings })`:
    - Row labels are "`<phase>` person N", "`<phase>` allocation N" and "`<phase>` role N", plus a button "Remove `<phase>` person N".
    - The add button is "Add person to `<phase>`".
    - The person choices are "`<name>` · `<role>`", plus "Choose a person…".
  - `projectDraft.ts`:
    - `PhaseDraft extends PhaseInput { assignments?: DraftAssignment[] }`
    - `phasesToInput(phases)`. A row with no person is sent with `resourceId: 0`, so the server says "Choose a person".
    - `stepOfIssue` sends `phases.N.assignments…` errors to step 3 (People).
  - The wizard's `STEPS` become Basic info, Description & scope, Phases, People. "Create project" is on step 4.
  - Project page "People" card: per phase, an "Edit people on `<phase>`" button, then "Save people on `<phase>`" and "Cancel". Saved rows read "`<name>` — `<n>`% · Responsible/Contributor".
  - `labels.ts`: `ASSIGNMENT_ROLE_LABEL`.
  - Test fixture `sampleWorkload()`:
    - resources: Fatima (71, capacity 100), and Rami (72, capacity 80, on leave 19–20 Oct 2026);
    - assignment 500: Fatima 100% on "HR Self-Service · QA", 28 Sep–9 Oct 2026, phase 900;
    - assignment 501: Rami 60% on "Case Management · Development", 5–16 Oct 2026, phase 901.

- [ ] **Step 1: Write the failing tests**

`client/overloads.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { overloadsWith, phaseWarnings, shortDate } from './overloads';
import { sampleWorkload } from './testing/mockFetch';

const fatimaAt = (allocation: number, start = '2026-10-05', end = '2026-10-16') =>
  ({ resourceId: 71, start, end, allocation, projectName: 'Portal', phaseName: 'Requirements' });

describe('overloads', () => {
  it('writes short dates', () => {
    expect(shortDate('2026-10-05')).toBe('5 Oct');
    expect(shortDate('2026-12-31')).toBe('31 Dec');
  });

  it('adds planned work to what is already booked and keeps only the overbooked weeks', () => {
    // Fatima is already 100% on HR QA until 9 Oct.
    const overloads = overloadsWith(sampleWorkload(), [fatimaAt(50)]);
    expect([...overloads.keys()]).toEqual([71]);
    expect(overloads.get(71)!.map((w) => [w.weekStart, w.load])).toEqual([['2026-10-05', 150]]);
  });

  it('leaves out saved assignments that are being replaced', () => {
    expect(overloadsWith(sampleWorkload(), [fatimaAt(50)], [500]).size).toBe(0);
  });

  it('checks nothing when nothing is planned', () => {
    expect(overloadsWith(sampleWorkload(), []).size).toBe(0);
  });

  it("writes one line per overbooked week that touches the phase, mentioning leave", () => {
    const data = sampleWorkload();
    // Rami: 60% on Case Management until 16 Oct, capacity 80, on leave 19–20 Oct.
    const rami = { resourceId: 72, start: '2026-10-05', end: '2026-10-23', allocation: 40, projectName: 'Portal', phaseName: 'Dev' };
    const overloads = overloadsWith(data, [rami]);
    expect(phaseWarnings(overloads, { start: '2026-10-05', end: '2026-10-23' }).get(72)).toEqual([
      'Week of 5 Oct: 100% booked, 80% available',
      'Week of 12 Oct: 100% booked, 80% available',
    ]);
    const heavy = overloadsWith(data, [{ ...rami, allocation: 80 }]);
    expect(phaseWarnings(heavy, { start: '2026-10-19', end: '2026-10-23' }).get(72)).toEqual([
      'Week of 19 Oct: 80% booked, 48% available (2 days of leave)',
    ]);
  });
});
```

`client/components/AssignmentsEditor.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ResourceRecord } from '../../shared/types';
import type { DraftAssignment } from '../overloads';
import { samplePeople } from '../testing/mockFetch';
import { AssignmentsEditor } from './AssignmentsEditor';

function Harness({ spy, warnings = new Map(), people = samplePeople() }: {
  spy?: (v: DraftAssignment[]) => void; warnings?: Map<number, string[]>; people?: ResourceRecord[];
}) {
  const [value, setValue] = useState<DraftAssignment[]>([]);
  return (
    <AssignmentsEditor
      phaseName="Development"
      dates="5 Oct – 16 Oct"
      people={people}
      value={value}
      onChange={(v) => {
        spy?.(v);
        setValue(v);
      }}
      warnings={warnings}
    />
  );
}

describe('AssignmentsEditor', () => {
  it('adds, edits and removes people on a phase', async () => {
    const spy = vi.fn();
    const user = userEvent.setup();
    render(<Harness spy={spy} />);
    expect(screen.getByText('No one assigned.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add person to Development' }));
    await user.selectOptions(screen.getByLabelText('Development person 1'), 'Fatima Noor · Developer');
    await user.clear(screen.getByLabelText('Development allocation 1'));
    await user.type(screen.getByLabelText('Development allocation 1'), '60');
    expect(spy).toHaveBeenLastCalledWith([{ resourceId: 71, allocation: 60, role: 'responsible' }]);

    await user.click(screen.getByRole('button', { name: 'Add person to Development' }));
    expect(screen.getByLabelText('Development role 2')).toHaveValue('contributor');
    await user.click(screen.getByRole('button', { name: 'Remove Development person 1' }));
    expect(spy).toHaveBeenLastCalledWith([{ resourceId: null, allocation: 100, role: 'contributor' }]);
  });

  it('offers only active tech-team people', async () => {
    const user = userEvent.setup();
    render(<Harness people={[...samplePeople(), { ...samplePeople()[1], id: 79, name: 'Gone', active: false }]} />);
    await user.click(screen.getByRole('button', { name: 'Add person to Development' }));
    const options = within(screen.getByLabelText('Development person 1')).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Choose a person…', 'Fatima Noor · Developer', 'Rami Saleh · Developer', 'Sara Ahmed · Project manager']);
  });

  it("shows a person's overbooking warnings under their row", async () => {
    const user = userEvent.setup();
    render(<Harness warnings={new Map([[71, ['Week of 5 Oct: 150% booked, 100% available']]])} />);
    await user.click(screen.getByRole('button', { name: 'Add person to Development' }));
    expect(screen.queryByText('Week of 5 Oct: 150% booked, 100% available')).toBeNull();
    await user.selectOptions(screen.getByLabelText('Development person 1'), 'Fatima Noor · Developer');
    expect(screen.getByText('Week of 5 Oct: 150% booked, 100% available')).toBeInTheDocument();
  });
});
```

In `client/pages/manage/projectDraft.test.ts`:
- Add `phasesToInput` to the import from `./projectDraft`.
- Inside the `describe`, add:

```ts
  it('sends each phase with its people, a row with no person as 0 so the server asks for one', () => {
    expect(phasesToInput([
      { name: 'Build', durationDays: 5, assignments: [{ resourceId: 71, allocation: 60, role: 'responsible' }, { resourceId: null, allocation: 100, role: 'contributor' }] },
      { name: 'QA', durationDays: 3 },
    ])).toEqual([
      { name: 'Build', durationDays: 5, assignments: [{ resourceId: 71, allocation: 60, role: 'responsible' }, { resourceId: 0, allocation: 100, role: 'contributor' }] },
      { name: 'QA', durationDays: 3, assignments: [] },
    ]);
  });

  it('sends people errors to the People step', () => {
    expect(stepOfIssue({ path: 'phases.2.assignments.0.resourceId', message: '' })).toBe(3);
    expect(stepOfIssue({ path: 'phases.2.name', message: '' })).toBe(2);
  });
```

In `client/pages/manage/CreateProjectPage.test.tsx`:
- Import `sampleWorkload`.
- Add to `baseRoutes`:

```tsx
  'GET /api/workload': () => ({ body: sampleWorkload() }),
```

- Add after `openPhasesStep`:

```tsx
async function openPeopleStep(user: User) {
  await openPhasesStep(user);
  await user.click(screen.getByRole('button', { name: 'Next' }));
}
```

- In `'creates a project with its details, scope and phases'`, directly after `expect(screen.getByRole('heading', { name: 'Phases' })).toBeInTheDocument();`, add:

```tsx
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: 'People' })).toBeInTheDocument();
```

- In `'sends the user back to the step with a server-side error'`, replace `await openPhasesStep(user);` with `await openPeopleStep(user);`.
- Add this test:

```tsx
  it('assigns people on Step 4, flags overbooking straight away, and sends the assignments', async () => {
    const fetchMock = mockFetch({
      ...baseRoutes,
      'POST /api/projects': () => ({ status: 201, body: sampleProject({ id: 7 }) }),
    });
    const user = userEvent.setup();
    renderPage();
    await openPhasesStep(user);
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-10-05' } });
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: 'People' })).toBeInTheDocument();

    // Requirements gathering runs 5–16 Oct; Fatima is already 100% on HR QA until 9 Oct.
    await user.click(screen.getByRole('button', { name: 'Add person to Requirements gathering' }));
    await screen.findByRole('option', { name: 'Fatima Noor · Developer' });
    await user.selectOptions(screen.getByLabelText('Requirements gathering person 1'), 'Fatima Noor · Developer');
    expect(await screen.findByText('Week of 5 Oct: 200% booked, 100% available')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Requirements gathering allocation 1'));
    await user.type(screen.getByLabelText('Requirements gathering allocation 1'), '50');
    expect(await screen.findByText('Week of 5 Oct: 150% booked, 100% available')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Create project' }));
    expect(await screen.findByText('Project page 7')).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([url, init]) => url === '/api/projects' && init?.method === 'POST');
    const sent = JSON.parse(post![1]!.body as string);
    expect(sent.phases[0].assignments).toEqual([{ resourceId: 71, allocation: 50, role: 'responsible' }]);
    expect(sent.phases[1].assignments).toEqual([]);
  });
```

In `client/pages/manage/ProjectPage.test.tsx`:
- Import `userEvent` from `@testing-library/user-event`, add `waitFor` to the Testing Library import, and add `samplePeople` and `sampleWorkload` to the mockFetch import.
- Add:

```tsx
  it('edits the people on a phase, warning about overbooking before saving', async () => {
    const withTeam = sampleProject({
      phases: [{ id: 11, name: 'Requirements', order: 0, durationDays: 5, start: '2026-10-05', end: '2026-10-09' }],
      assignments: [{ id: 300, phaseId: 11, resource: { id: 72, name: 'Rami Saleh' }, allocation: 50, role: 'responsible' }],
    });
    const workload = sampleWorkload();
    workload.assignments.push({
      id: 300, resourceId: 72, phaseId: 11, projectId: 1, projectName: 'Portal', phaseName: 'Requirements',
      start: '2026-10-05', end: '2026-10-09', allocation: 50, role: 'responsible',
    });
    const fetchMock = mockFetch({
      'GET /api/projects/1': () => ({ body: withTeam }),
      'GET /api/settings/calendar': () => ({ body: { weekendDays: [0, 6], holidays: [] } }),
      'GET /api/resources': () => ({ body: samplePeople() }),
      'GET /api/workload': () => ({ body: workload }),
      'PUT /api/phases/11/assignments': () => ({
        body: { ...withTeam, assignments: [{ id: 301, phaseId: 11, resource: { id: 72, name: 'Rami Saleh' }, allocation: 20, role: 'responsible' }] },
      }),
    });
    const user = userEvent.setup();
    renderAt('/manage/projects/1');

    expect(await screen.findByText(/50% · Responsible/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit people on Requirements' }));
    // Rami (capacity 80) is also 60% on Case Management that week: 60 + 50 = 110.
    expect(await screen.findByText('Week of 5 Oct: 110% booked, 80% available')).toBeInTheDocument();

    const allocation = screen.getByLabelText('Requirements allocation 1');
    await user.clear(allocation);
    await user.type(allocation, '20');
    await waitFor(() => expect(screen.queryByText(/Week of 5 Oct/)).toBeNull());

    await user.click(screen.getByRole('button', { name: 'Save people on Requirements' }));
    expect(await screen.findByText(/20% · Responsible/)).toBeInTheDocument();
    const put = fetchMock.mock.calls.find(([url, init]) => url === '/api/phases/11/assignments' && init?.method === 'PUT');
    expect(JSON.parse(put![1]!.body as string)).toEqual({ assignments: [{ resourceId: 72, allocation: 20, role: 'responsible' }] });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run client`
Expected: FAIL. It can't resolve `./overloads`, `./AssignmentsEditor` or `phasesToInput`, the wizard has no People step, and the project page has no People card.

- [ ] **Step 3: API, the workload hook, labels and fixtures**

In `client/api.ts`:
- Add `AssignmentInput` to the schemas type import, and `WorkloadData` to the types import.
- Add to `api`:

```ts
  setPhaseAssignments: (phaseId: number, assignments: AssignmentInput[]) =>
    request<ProjectRecord>(`/api/phases/${phaseId}/assignments`, withBody('PUT', { assignments })),
  getWorkload: () => request<WorkloadData>('/api/workload'),
```

Create `client/useWorkload.ts`:

```ts
import { useCallback, useState } from 'react';
import { api } from './api';
import { useAsync } from './useAsync';

/** Loads the workload data (people, leave, assignments, calendar, decisions); `reload` fetches it again after a change. */
export function useWorkload() {
  const [version, setVersion] = useState(0);
  const loaded = useAsync(() => api.getWorkload(), [version]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { workload: loaded.data, error: loaded.error, reload };
}
```

Append to `client/pages/manage/labels.ts` (add `AssignmentRole` to its type import):

```ts
export const ASSIGNMENT_ROLE_LABEL: Record<AssignmentRole, string> = { responsible: 'Responsible', contributor: 'Contributor' };
```

In `client/testing/mockFetch.ts`, add `WorkloadData` to the type import and append:

```ts
export function sampleWorkload(): WorkloadData {
  return {
    calendar: { weekendDays: [0, 6], holidays: [] },
    resources: [
      { id: 71, name: 'Fatima Noor', capacity: 100, leave: [] },
      { id: 72, name: 'Rami Saleh', capacity: 80, leave: [{ start: '2026-10-19', end: '2026-10-20' }] },
    ],
    assignments: [
      {
        id: 500, resourceId: 71, phaseId: 900, projectId: 90, projectName: 'HR Self-Service', phaseName: 'QA',
        start: '2026-09-28', end: '2026-10-09', allocation: 100, role: 'responsible',
      },
      {
        id: 501, resourceId: 72, phaseId: 901, projectId: 91, projectName: 'Case Management', phaseName: 'Development',
        start: '2026-10-05', end: '2026-10-16', allocation: 60, role: 'contributor',
      },
    ],
    decisions: [],
  };
}
```

- [ ] **Step 4: Create `client/overloads.ts`**

```ts
import { addDays, type DateRange, type ISODate } from '../shared/calendar';
import { computeWorkload, type CapacityAssignment, type WeekLoad } from '../shared/capacity';
import type { AssignmentRole, WorkloadData } from '../shared/types';

/** An assignment as a form holds it: the person may not be chosen yet. */
export interface DraftAssignment {
  resourceId: number | null;
  allocation: number;
  role: AssignmentRole;
}

/** Work that is about to be booked, with its dates. */
export interface PlannedAssignment {
  resourceId: number;
  start: ISODate;
  end: ISODate;
  allocation: number;
  projectName: string;
  phaseName: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "5 Oct". */
export function shortDate(d: ISODate): string {
  return `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;
}

/**
 * The weeks each person would be overbooked in if `planned` were added to the saved workload, with the saved
 * assignments whose ids are in `replacing` taken out (they are being edited). Only people in `planned` are checked.
 */
export function overloadsWith(data: WorkloadData, planned: PlannedAssignment[], replacing: number[] = []): Map<number, WeekLoad[]> {
  const result = new Map<number, WeekLoad[]>();
  if (planned.length === 0) return result;
  const range: DateRange = {
    start: planned.reduce((min, p) => (p.start < min ? p.start : min), planned[0].start),
    end: planned.reduce((max, p) => (p.end > max ? p.end : max), planned[0].end),
  };
  const extra: CapacityAssignment[] = planned.map((p, i) => ({
    id: -(i + 1),
    resourceId: p.resourceId,
    phaseId: -1,
    projectId: -1,
    projectName: p.projectName,
    phaseName: p.phaseName,
    start: p.start,
    end: p.end,
    allocation: p.allocation,
  }));
  const kept = data.assignments.filter((a) => !replacing.includes(a.id));
  const people = data.resources.filter((r) => planned.some((p) => p.resourceId === r.id));
  for (const load of computeWorkload(people, [...kept, ...extra], range, data.calendar)) {
    const weeks = load.weeks.filter((w) => w.overloaded);
    if (weeks.length > 0) result.set(load.resourceId, weeks);
  }
  return result;
}

/** One line per overbooked week that touches the phase, e.g. "Week of 5 Oct: 150% booked, 100% available". */
export function phaseWarnings(overloads: Map<number, WeekLoad[]>, phase: DateRange): Map<number, string[]> {
  const out = new Map<number, string[]>();
  for (const [resourceId, weeks] of overloads) {
    const lines = weeks
      .filter((w) => w.weekStart <= phase.end && addDays(w.weekStart, 6) >= phase.start)
      .map((w) => {
        const leave = w.leaveDays > 0 ? ` (${w.leaveDays} day${w.leaveDays === 1 ? '' : 's'} of leave)` : '';
        return `Week of ${shortDate(w.weekStart)}: ${Math.round(w.load)}% booked, ${Math.round(w.available)}% available${leave}`;
      });
    if (lines.length > 0) out.set(resourceId, lines);
  }
  return out;
}

/** Draft rows that have a person and a number, as planned work over the given dates. */
export function plannedFrom(drafts: DraftAssignment[], dates: DateRange, projectName: string, phaseName: string): PlannedAssignment[] {
  return drafts.flatMap((a) =>
    a.resourceId === null || !Number.isFinite(a.allocation)
      ? []
      : [{ resourceId: a.resourceId, start: dates.start, end: dates.end, allocation: a.allocation, projectName, phaseName }],
  );
}
```

- [ ] **Step 5: Create `client/components/AssignmentsEditor.tsx`**

```tsx
import type { AssignmentRole, ResourceRecord } from '../../shared/types';
import { PlusIcon, TrashIcon } from '../icons';
import type { DraftAssignment } from '../overloads';

interface AssignmentsEditorProps {
  phaseName: string;
  /** Shown next to the phase name, e.g. "5 Oct – 16 Oct". */
  dates: string;
  /** Everyone in Resources; the editor offers active tech-team people plus whoever is already chosen. */
  people: ResourceRecord[];
  value: DraftAssignment[];
  onChange: (value: DraftAssignment[]) => void;
  /** Overbooking warning lines per person, for this phase. */
  warnings: Map<number, string[]>;
}

/** The people on one phase: who, how much of their week, and whether they are responsible or contributing. */
export function AssignmentsEditor({ phaseName, dates, people, value, onChange, warnings }: AssignmentsEditorProps) {
  const update = (index: number, patch: Partial<DraftAssignment>) =>
    onChange(value.map((a, i) => (i === index ? { ...a, ...patch } : a)));

  return (
    <div className="phase-people">
      <h3>
        {phaseName} <span className="muted phase-dates">{dates}</span>
      </h3>
      {value.length === 0 ? <p className="muted item-empty">No one assigned.</p> : null}
      {value.map((a, i) => {
        const options = people
          .filter((p) => p.side === 'tech' && (p.active || p.id === a.resourceId))
          .sort((x, y) => x.name.localeCompare(y.name));
        const lines = a.resourceId === null ? [] : warnings.get(a.resourceId) ?? [];
        return (
          <div className="assignment" key={i}>
            <div className="assignment-row">
              <select
                aria-label={`${phaseName} person ${i + 1}`}
                value={a.resourceId === null ? '' : String(a.resourceId)}
                onChange={(e) => update(i, { resourceId: e.target.value === '' ? null : Number(e.target.value) })}
              >
                <option value="">Choose a person…</option>
                {options.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.name}{p.role ? ` · ${p.role.name}` : ''}{p.active ? '' : ' (inactive)'}
                  </option>
                ))}
              </select>
              <span className="inline-number">
                <input
                  aria-label={`${phaseName} allocation ${i + 1}`}
                  type="number"
                  min={1}
                  max={100}
                  value={Number.isNaN(a.allocation) ? '' : a.allocation}
                  onChange={(e) => update(i, { allocation: e.target.valueAsNumber })}
                />
                <span aria-hidden="true">%</span>
              </span>
              <select
                aria-label={`${phaseName} role ${i + 1}`}
                value={a.role}
                onChange={(e) => update(i, { role: e.target.value as AssignmentRole })}
              >
                <option value="responsible">Responsible</option>
                <option value="contributor">Contributor</option>
              </select>
              <button
                type="button"
                className="button ghost-icon"
                aria-label={`Remove ${phaseName} person ${i + 1}`}
                onClick={() => onChange(value.filter((_, j) => j !== i))}
              >
                <TrashIcon />
              </button>
            </div>
            {lines.length > 0 ? (
              <ul className="warning-lines">
                {lines.map((line) => <li key={line}>{line}</li>)}
              </ul>
            ) : null}
          </div>
        );
      })}
      <button
        type="button"
        className="button secondary"
        onClick={() => onChange([...value, { resourceId: null, allocation: 100, role: value.length === 0 ? 'responsible' : 'contributor' }])}
      >
        <PlusIcon />Add person to {phaseName}
      </button>
    </div>
  );
}
```

- [ ] **Step 6: Phases with people in the form state (`client/pages/manage/projectDraft.ts`)**

- Add the imports:

```ts
import type { PhaseInput } from '../../../shared/scheduler';
import type { DraftAssignment } from '../../overloads';
```

- Add after `detailsToInput`:

```ts
/** A wizard phase: its name, working days and, from Step 4, the people on it. */
export interface PhaseDraft extends PhaseInput {
  assignments?: DraftAssignment[];
}

/** Phases as the API takes them. A row with no person yet is sent as 0 so the server answers "Choose a person". */
export function phasesToInput(phases: PhaseDraft[]) {
  return phases.map(({ name, durationDays, assignments = [] }) => ({
    name,
    durationDays,
    assignments: assignments.map((a) => ({ resourceId: a.resourceId ?? 0, allocation: a.allocation, role: a.role })),
  }));
}
```

- Replace `stepOfIssue` with:

```ts
/** The step (0–3) whose field has this issue, or -1 when no step owns it (e.g. a general server error). */
export function stepOfIssue(issue: ValidationIssue): number {
  if (/^phases\.\d+\.assignments/.test(issue.path)) return 3;
  const field = issue.path.split('.')[0];
  return STEP_FIELDS.findIndex((fields) => fields.includes(field));
}
```

- [ ] **Step 7: Create `client/pages/manage/PeopleFields.tsx`** (wizard Step 4)

```tsx
import { DEFAULT_CALENDAR, isISODate } from '../../../shared/calendar';
import { schedulePhases } from '../../../shared/scheduler';
import type { ResourceRecord, WorkloadData } from '../../../shared/types';
import { AssignmentsEditor } from '../../components/AssignmentsEditor';
import { overloadsWith, phaseWarnings, plannedFrom, shortDate } from '../../overloads';
import type { PhaseDraft } from './projectDraft';

interface PeopleFieldsProps {
  projectName: string;
  startDate: string;
  phases: PhaseDraft[];
  onPhases: (phases: PhaseDraft[]) => void;
  people: ResourceRecord[];
  workload: WorkloadData | undefined;
}

/** Wizard Step 4: who works on each phase, with overbooking flagged against everything already booked. */
export function PeopleFields({ projectName, startDate, phases, onPhases, people, workload }: PeopleFieldsProps) {
  const cal = workload?.calendar ?? DEFAULT_CALENDAR;
  const scheduled = isISODate(startDate) ? schedulePhases(startDate, phases, cal) : [];
  const name = projectName.trim() || 'This project';
  // Every phase of this new project counts together, so two phases booking the same person in one week add up.
  const planned = scheduled.flatMap((s, i) => plannedFrom(phases[i].assignments ?? [], s, name, s.name));
  const overloads = workload ? overloadsWith(workload, planned) : new Map();

  return (
    <section className="card">
      <h2>People</h2>
      <p className="field-hint">Who works on each phase, and how much of their week. Anyone who would be overbooked is flagged straight away.</p>
      {scheduled.map((s, i) => (
        <AssignmentsEditor
          key={i}
          phaseName={s.name}
          dates={`${shortDate(s.start)} – ${shortDate(s.end)}`}
          people={people}
          value={phases[i].assignments ?? []}
          onChange={(value) => onPhases(phases.map((p, j) => (j === i ? { ...p, assignments: value } : p)))}
          warnings={phaseWarnings(overloads, s)}
        />
      ))}
    </section>
  );
}
```

- [ ] **Step 8: The wizard gets Step 4 (`client/pages/manage/CreateProjectPage.tsx`)**

- Change `STEPS` to `const STEPS = ['Basic info', 'Description & scope', 'Phases', 'People'];`.
- Change the `projectDraft` import to also bring in `phasesToInput` and `type PhaseDraft`. Remove the `PhaseInput` import if it is now unused.
- Add `import { PeopleFields } from './PeopleFields';` and `import { useWorkload } from '../../useWorkload';`.
- Change the phases state to `const [phases, setPhases] = useState<PhaseDraft[]>(DEFAULT_PHASES);`.
- Add `const { workload, error: workloadError } = useWorkload();` after the `useResources()` line.
- Change `input` to:

```tsx
  const input = (): NewProjectInput => ({ ...detailsToInput(details), startDate, phases: phasesToInput(phases) });
```

- After the "Could not load people" banner, add:

```tsx
        {workloadError ? (
          <div className="errors" role="alert">
            <AlertIcon />
            <span>Could not load everyone's workload: {workloadError.message}</span>
          </div>
        ) : null}
```

- After the `{step === 2 ? (<PhasesFields …/>) : null}` block, add:

```tsx
        {step === 3 ? (
          <PeopleFields
            projectName={details.name}
            startDate={startDate}
            phases={phases}
            onPhases={setPhases}
            people={people}
            workload={workload}
          />
        ) : null}
```

- [ ] **Step 9: Create `client/pages/manage/ProjectPeople.tsx`** (project page card)

```tsx
import { useState } from 'react';
import type { ProjectRecord, ResourceRecord, WorkloadData } from '../../../shared/types';
import { AssignmentsEditor } from '../../components/AssignmentsEditor';
import { AlertIcon } from '../../icons';
import { api } from '../../api';
import { messagesOf } from '../../errors';
import { overloadsWith, phaseWarnings, plannedFrom, shortDate, type DraftAssignment } from '../../overloads';
import { ASSIGNMENT_ROLE_LABEL } from './labels';

interface ProjectPeopleProps {
  project: ProjectRecord;
  people: ResourceRecord[];
  workload: WorkloadData | undefined;
  /** Called with the project as saved, so the page shows it and reloads the workload. */
  onSaved: (project: ProjectRecord) => void;
}

/** The people on each phase, editable one phase at a time, with overbooking flagged before saving. */
export function ProjectPeople({ project, people, workload, onSaved }: ProjectPeopleProps) {
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<DraftAssignment[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function startEdit(phaseId: number) {
    setEditing(phaseId);
    setErrors([]);
    setDraft(
      project.assignments
        .filter((a) => a.phaseId === phaseId)
        .map((a) => ({ resourceId: a.resource.id, allocation: a.allocation, role: a.role })),
    );
  }

  async function save(phaseId: number) {
    setSaving(true);
    setErrors([]);
    try {
      const updated = await api.setPhaseAssignments(
        phaseId,
        draft.map((a) => ({ resourceId: a.resourceId ?? 0, allocation: a.allocation, role: a.role })),
      );
      setEditing(null);
      onSaved(updated);
    } catch (err) {
      setErrors(messagesOf(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card">
      <h2>People</h2>
      {project.phases.map((phase) => {
        const saved = project.assignments.filter((a) => a.phaseId === phase.id);
        const dates = `${shortDate(phase.start)} – ${shortDate(phase.end)}`;

        if (editing === phase.id) {
          const planned = plannedFrom(draft, phase, project.name, phase.name);
          const warnings = workload
            ? phaseWarnings(overloadsWith(workload, planned, saved.map((a) => a.id)), phase)
            : new Map<number, string[]>();
          return (
            <div key={phase.id} className="phase-people-edit">
              {errors.length > 0 ? (
                <div className="errors" role="alert">
                  <AlertIcon />
                  <ul>{errors.map((m) => <li key={m}>{m}</li>)}</ul>
                </div>
              ) : null}
              <AssignmentsEditor
                phaseName={phase.name}
                dates={dates}
                people={people}
                value={draft}
                onChange={setDraft}
                warnings={warnings}
              />
              <div className="option-add-actions">
                <button
                  type="button"
                  className="button"
                  disabled={saving}
                  aria-label={`Save people on ${phase.name}`}
                  onClick={() => void save(phase.id)}
                >
                  Save
                </button>
                <button type="button" className="button secondary" onClick={() => setEditing(null)}>Cancel</button>
              </div>
            </div>
          );
        }

        return (
          <div key={phase.id} className="phase-people">
            <div className="phase-people-head">
              <h3>
                {phase.name} <span className="muted phase-dates">{dates}</span>
              </h3>
              <button
                type="button"
                className="button secondary"
                aria-label={`Edit people on ${phase.name}`}
                disabled={editing !== null}
                onClick={() => startEdit(phase.id)}
              >
                Edit
              </button>
            </div>
            {saved.length === 0 ? (
              <p className="muted item-empty">No one assigned.</p>
            ) : (
              <ul className="people-list">
                {saved.map((a) => (
                  <li key={a.id}>
                    <span>{a.resource.name}</span> — {a.allocation}% · {ASSIGNMENT_ROLE_LABEL[a.role]}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </section>
  );
}
```

- [ ] **Step 10: Show the People card on the project page (`client/pages/manage/ProjectPage.tsx`)**

- Add `useState` to a React import (`import { useState, type ReactNode } from 'react';`), `ProjectRecord` as a type import from `../../../shared/types`, and:

```tsx
import { useResources } from '../../useResources';
import { useWorkload } from '../../useWorkload';
import { ProjectPeople } from './ProjectPeople';
```

- Directly after the existing `useElementWidth` line (before any early return), add:

```tsx
  const { people } = useResources();
  const { workload, reload: reloadWorkload } = useWorkload();
  const [saved, setSaved] = useState<ProjectRecord | null>(null);
```

- Change `const p = project.data;` to `const p = saved ?? project.data;`.
- After the closing `</section>` of the **Phases** table card, add:

```tsx
      <ProjectPeople
        project={p}
        people={people}
        workload={workload}
        onSaved={(updated) => {
          setSaved(updated);
          reloadWorkload();
        }}
      />
```

- [ ] **Step 11: Styles** (append to `client/styles.css`)

```css
.phase-people, .phase-people-edit { padding: var(--sp-3) 0; border-bottom: 1px solid var(--border); }
.phase-people:last-child, .phase-people-edit:last-child { border-bottom: 0; }
.phase-people h3 { margin-bottom: var(--sp-2); }
.phase-people-head { display: flex; justify-content: space-between; align-items: center; gap: var(--sp-3); }
.phase-dates { font-weight: 400; font-size: var(--fs-sm); }
.people-list { margin: 0; padding-left: 1.2em; }
.assignment { margin-bottom: var(--sp-2); }
.assignment-row { display: grid; grid-template-columns: 1fr 6.5rem 10rem auto; gap: var(--sp-2); align-items: center; }
.inline-number { display: flex; align-items: center; gap: var(--sp-1); }
.inline-number input { width: 100%; }
.warning-lines {
  margin: var(--sp-1) 0 0;
  padding: var(--sp-2) var(--sp-3) var(--sp-2) 1.8em;
  background: var(--warning-wash);
  border-radius: var(--radius-sm);
  font-size: var(--fs-sm);
}
@media (max-width: 640px) {
  .assignment-row { grid-template-columns: 1fr 5.5rem; }
}
```

- [ ] **Step 12: Run the tests to verify they pass**

Run: `npx vitest run client`
Expected: PASS.

- [ ] **Step 13: Run the whole suite and the type check**

Run: `npm test` → Expected: PASS (all tests).
Run: `npm run typecheck` → Expected: exit code 0.

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "feat: assign people to phases on the project page and in the wizard, with live overbooking warnings"
```

---

### Task 7: Workload heatmap and the overload decision prompt

This task adds the heatmap and its decision panel to the Resources page. The heatmap shows people by weeks, and clicking a week opens a panel. When the week is overbooked, the panel asks what to do:
- **Split the time:** change the allocations for that week's work.
- **Reassign work:** move one piece of work to someone else, whose load that week is shown next to their name.
- **Accept the risk:** record an optional reason.

"Pause a project" and "Delay a phase" are shown but disabled. Every decision is recorded. The manage dashboard also gets a notice when anyone is overbooked in the next 4 weeks and that overbooking hasn't been accepted.

**Files:**
- Modify: `client/api.ts`, `client/testing/mockFetch.ts`, `client/pages/manage/ResourcesPage.tsx`, `client/pages/manage/ManageDashboardPage.tsx`, `client/styles.css`
- Create: `client/pages/manage/heatmap.ts`, `client/pages/manage/WorkloadHeatmap.tsx`, `client/pages/manage/OverloadPanel.tsx`
- Test: `client/pages/manage/heatmap.test.ts` (new), `client/pages/manage/WorkloadHeatmap.test.tsx` (new), `client/pages/manage/OverloadPanel.test.tsx` (new), `client/pages/manage/ResourcesPage.test.tsx`, `client/pages/manage/ManageDashboardPage.test.tsx`

**Interfaces:**
- Consumes: `computeWorkload`, `weekStartOf`, `PersonLoad`, `WeekLoad` (Task 3); `WorkloadData`, `WorkloadAssignment`, `OverloadDecision`, `OverloadDecisionKind` (Task 4); `OverloadDecisionInput`, `AssignmentInput` (Task 4); `api.setPhaseAssignments`, `useWorkload`, `shortDate` (Task 6); `messagesOf` (Task 5); `sampleWorkload` (Task 6); `addDays`, `todayLocal` (M1).
- Produces:
  - `api.recordOverloadDecision(input)`.
  - `heatmap.ts`:
    - `HeatLevel = 'none' | 'off' | 'low' | 'mid' | 'full' | 'over' | 'accepted'`
    - `heatLevel(week, accepted)`
    - `isAccepted(decisions, resourceId, weekStart)`: true when the **latest** decision for that person and week is "accept".
  - `WorkloadHeatmap({ loads, decisions, selected, onSelect })`:
    - A table where each cell is a button labelled "`<name>`, week of `<5 Oct>`: `<n>`% booked of `<m>`% available, `<state>`".
    - The states are: free, not working, lightly booked, booked, fully booked, overbooked, overbooked (accepted).
  - `OverloadPanel({ data, person, week, onClose, onChanged })`:
    - The heading is "`<name>` · week of `<5 Oct>`".
    - Buttons: "Split the time", "Reassign work", "Accept the risk", and the disabled "Pause a project" and "Delay a phase".
    - The forms have the fields "Allocation for `<project>` · `<phase>` (%)", "Work to move", "Give it to" and "Why is this OK? (optional)".
    - Their submit buttons are "Save new allocations", "Reassign" and "Record the decision".
  - `ResourcesPage` gains a "Workload" card above "People":
    - 13 weeks, starting 2 weeks before this week.
    - Navigation: "Earlier weeks", "This week" and "Later weeks", which move 4 weeks at a time.
  - Dashboard notice, `role="status"`:
    - "`<name>` is overbooked in the next 4 weeks." for one person, or "`<n>` people are overbooked in the next 4 weeks." for several.
    - It has a link "See the workload".
  - Test fixture `overbookedWorkload()`: `sampleWorkload()` plus assignment 502, which puts Fatima (71) at 60% on "Portal · Development" (phase 902, project 92, contributor) from 5 to 9 Oct 2026. That makes her week of 5 Oct 160%.

- [ ] **Step 1: Write the failing tests**

In `client/testing/mockFetch.ts`, append:

```ts
/** sampleWorkload plus 60% more for Fatima in the week of 5 Oct 2026 (160% booked). */
export function overbookedWorkload(): WorkloadData {
  const data = sampleWorkload();
  data.assignments.push({
    id: 502, resourceId: 71, phaseId: 902, projectId: 92, projectName: 'Portal', phaseName: 'Development',
    start: '2026-10-05', end: '2026-10-09', allocation: 60, role: 'contributor',
  });
  return data;
}
```

`client/pages/manage/heatmap.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { WeekLoad } from '../../../shared/capacity';
import type { OverloadDecision } from '../../../shared/types';
import { heatLevel, isAccepted } from './heatmap';

const week = (p: Partial<WeekLoad>): WeekLoad => ({
  weekStart: '2026-10-05', workingDays: 5, leaveDays: 0, load: 0, available: 100, overloaded: false, items: [], ...p,
});

const decision = (id: number, decisionKind: OverloadDecision['decision']): OverloadDecision => ({
  id, resourceId: 71, weekStart: '2026-10-05', decision: decisionKind, note: null, date: '2026-10-01',
});

describe('heatmap', () => {
  it('grades a week by how much of what is available is booked', () => {
    expect(heatLevel(week({ load: 0 }), false)).toBe('none');
    expect(heatLevel(week({ load: 40 }), false)).toBe('low');
    expect(heatLevel(week({ load: 80 }), false)).toBe('mid');
    expect(heatLevel(week({ load: 100 }), false)).toBe('full');
    expect(heatLevel(week({ load: 160, overloaded: true }), false)).toBe('over');
    expect(heatLevel(week({ load: 160, overloaded: true }), true)).toBe('accepted');
  });

  it('marks weeks with no working days, or fully on leave, as not working', () => {
    expect(heatLevel(week({ workingDays: 0, available: 0 }), false)).toBe('off');
    expect(heatLevel(week({ leaveDays: 5, available: 0 }), false)).toBe('off');
  });

  it('counts a week as accepted only when the latest decision about it is to accept', () => {
    expect(isAccepted([decision(1, 'accept')], 71, '2026-10-05')).toBe(true);
    expect(isAccepted([decision(1, 'accept'), decision(2, 'split')], 71, '2026-10-05')).toBe(false);
    expect(isAccepted([decision(1, 'accept')], 72, '2026-10-05')).toBe(false);
    expect(isAccepted([decision(1, 'accept')], 71, '2026-10-12')).toBe(false);
  });
});
```

`client/pages/manage/WorkloadHeatmap.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { computeWorkload } from '../../../shared/capacity';
import { overbookedWorkload } from '../../testing/mockFetch';
import { WorkloadHeatmap } from './WorkloadHeatmap';

const data = overbookedWorkload();
const loads = computeWorkload(data.resources, data.assignments, { start: '2026-10-05', end: '2026-10-25' }, data.calendar);

describe('WorkloadHeatmap', () => {
  it('shows each person by week, with how much is booked', () => {
    render(<MemoryRouter><WorkloadHeatmap loads={loads} decisions={[]} selected={null} onSelect={() => {}} /></MemoryRouter>);
    expect(screen.getByRole('columnheader', { name: '5 Oct' })).toBeInTheDocument();
    const over = screen.getByRole('button', { name: 'Fatima Noor, week of 5 Oct: 160% booked of 100% available, overbooked' });
    expect(over).toHaveTextContent('160%');
    expect(over).toHaveClass('heat-over');
    expect(screen.getByRole('button', { name: 'Rami Saleh, week of 5 Oct: 60% booked of 80% available, booked' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fatima Noor, week of 12 Oct: 0% booked of 100% available, free' })).toHaveTextContent('');
    expect(screen.getByRole('link', { name: 'Rami Saleh' })).toHaveAttribute('href', '/manage/resources/72');
  });

  it('shows an accepted overbooking differently, and reports clicks', async () => {
    const onSelect = vi.fn();
    const decisions = [{ id: 1, resourceId: 71, weekStart: '2026-10-05', decision: 'accept' as const, note: null, date: '2026-10-01' }];
    render(<MemoryRouter><WorkloadHeatmap loads={loads} decisions={decisions} selected={null} onSelect={onSelect} /></MemoryRouter>);
    const cell = screen.getByRole('button', { name: /^Fatima Noor, week of 5 Oct: .* overbooked \(accepted\)$/ });
    expect(cell).toHaveClass('heat-accepted');
    await userEvent.click(cell);
    expect(onSelect).toHaveBeenCalledWith(71, '2026-10-05');
  });
});
```

`client/pages/manage/OverloadPanel.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { computeWorkload } from '../../../shared/capacity';
import { mockFetch, overbookedWorkload, sampleProject } from '../../testing/mockFetch';
import { OverloadPanel } from './OverloadPanel';

const data = overbookedWorkload();
const fatima = computeWorkload(data.resources, data.assignments, { start: '2026-10-05', end: '2026-10-11' }, data.calendar)[0];
const week = fatima.weeks[0];

const decisionRoute = {
  'POST /api/overloads/decisions': (init?: RequestInit) => ({
    status: 201, body: { id: 1, date: '2026-10-01', note: null, ...JSON.parse(init!.body as string) },
  }),
};

function renderPanel(onChanged = vi.fn()) {
  render(<OverloadPanel data={data} person={fatima} week={week} onClose={() => {}} onChanged={onChanged} />);
  return onChanged;
}

const bodyOf = (fetchMock: ReturnType<typeof mockFetch>, method: string, url: string) =>
  JSON.parse(fetchMock.mock.calls.find(([u, init]) => u === url && init?.method === method)![1]!.body as string);

describe('OverloadPanel', () => {
  it("lists the week's work and offers split, reassign and accept, with pause and delay not yet available", () => {
    renderPanel();
    expect(screen.getByRole('heading', { name: 'Fatima Noor · week of 5 Oct' })).toBeInTheDocument();
    expect(screen.getByText('160% booked of 100% available')).toBeInTheDocument();
    expect(screen.getByText('HR Self-Service · QA: 100% for 5 days')).toBeInTheDocument();
    expect(screen.getByText('Portal · Development: 60% for 5 days')).toBeInTheDocument();
    for (const name of ['Split the time', 'Reassign work', 'Accept the risk']) {
      expect(screen.getByRole('button', { name })).toBeEnabled();
    }
    expect(screen.getByRole('button', { name: 'Pause a project' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delay a phase' })).toBeDisabled();
  });

  it('accepts the risk with a reason', async () => {
    const fetchMock = mockFetch(decisionRoute);
    const user = userEvent.setup();
    const onChanged = renderPanel();
    await user.click(screen.getByRole('button', { name: 'Accept the risk' }));
    await user.type(screen.getByLabelText('Why is this OK? (optional)'), 'Deadline week');
    await user.click(screen.getByRole('button', { name: 'Record the decision' }));
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(bodyOf(fetchMock, 'POST', '/api/overloads/decisions')).toEqual({
      resourceId: 71, weekStart: '2026-10-05', decision: 'accept', note: 'Deadline week',
    });
  });

  it("splits the time by changing one piece of work's allocation", async () => {
    const fetchMock = mockFetch({ ...decisionRoute, 'PUT /api/phases/902/assignments': () => ({ body: sampleProject() }) });
    const user = userEvent.setup();
    const onChanged = renderPanel();
    await user.click(screen.getByRole('button', { name: 'Split the time' }));
    const portal = screen.getByLabelText('Allocation for Portal · Development (%)');
    await user.clear(portal);
    await user.type(portal, '20');
    await user.click(screen.getByRole('button', { name: 'Save new allocations' }));
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(bodyOf(fetchMock, 'PUT', '/api/phases/902/assignments')).toEqual({
      assignments: [{ resourceId: 71, allocation: 20, role: 'contributor' }],
    });
    expect(bodyOf(fetchMock, 'POST', '/api/overloads/decisions')).toMatchObject({ decision: 'split', weekStart: '2026-10-05' });
    expect(fetchMock.mock.calls.some(([u]) => u === '/api/phases/900/assignments')).toBe(false);
  });

  it('reassigns a piece of work to someone else, showing their load that week', async () => {
    const fetchMock = mockFetch({ ...decisionRoute, 'PUT /api/phases/902/assignments': () => ({ body: sampleProject() }) });
    const user = userEvent.setup();
    const onChanged = renderPanel();
    await user.click(screen.getByRole('button', { name: 'Reassign work' }));
    await user.selectOptions(screen.getByLabelText('Work to move'), 'Portal · Development (60%)');
    await user.selectOptions(screen.getByLabelText('Give it to'), 'Rami Saleh (60% booked this week)');
    await user.click(screen.getByRole('button', { name: 'Reassign' }));
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(bodyOf(fetchMock, 'PUT', '/api/phases/902/assignments')).toEqual({
      assignments: [{ resourceId: 72, allocation: 60, role: 'contributor' }],
    });
    expect(bodyOf(fetchMock, 'POST', '/api/overloads/decisions')).toMatchObject({ decision: 'reassign' });
  });

  it("shows the server's message when a change is refused", async () => {
    mockFetch({
      'PUT /api/phases/902/assignments': () => ({
        status: 400,
        body: { error: 'Invalid assignments', issues: [{ path: 'assignments.0.resourceId', message: 'The same person is assigned twice to this phase' }] },
      }),
    });
    const user = userEvent.setup();
    const onChanged = renderPanel();
    await user.click(screen.getByRole('button', { name: 'Reassign work' }));
    await user.selectOptions(screen.getByLabelText('Work to move'), 'Portal · Development (60%)');
    await user.selectOptions(screen.getByLabelText('Give it to'), 'Rami Saleh (60% booked this week)');
    await user.click(screen.getByRole('button', { name: 'Reassign' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The same person is assigned twice to this phase');
    expect(onChanged).not.toHaveBeenCalled();
  });
});
```

In `client/pages/manage/ResourcesPage.test.tsx`:
- Import `afterEach` and `vi` from `vitest`, and `overbookedWorkload` from the mockFetch module.
- Add `'GET /api/workload': () => ({ body: overbookedWorkload() }),` to `routes`.
- Add:

```tsx
afterEach(() => {
  vi.useRealTimers();
});
```

- Add inside the `describe`:

```tsx
  it('shows the workload heatmap from two weeks back, and opens a week', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T09:00:00'));
    mockFetch(routes);
    const user = userEvent.setup();
    renderPage();
    // This week starts 12 Oct, so the heatmap starts 28 Sep.
    expect(await screen.findByRole('columnheader', { name: '28 Sep' })).toBeInTheDocument();
    const cell = screen.getByRole('button', { name: 'Fatima Noor, week of 5 Oct: 160% booked of 100% available, overbooked' });
    await user.click(cell);
    expect(screen.getByRole('heading', { name: 'Fatima Noor · week of 5 Oct' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Later weeks' }));
    expect(screen.getByRole('columnheader', { name: '26 Oct' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: '28 Sep' })).toBeNull();
  });
```

In `client/pages/manage/ManageDashboardPage.test.tsx`:
- Import `afterEach` and `vi`, and `overbookedWorkload` and `sampleWorkload`.
- Add `'GET /api/workload': () => ({ body: sampleWorkload() }),` to the routes of the existing tests.
- Add `afterEach(() => { vi.useRealTimers(); });` and:

```tsx
  it('warns when someone is overbooked in the next four weeks', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-01T09:00:00'));
    mockFetch({
      'GET /api/projects': () => ({ body: [sampleProject()] }),
      'GET /api/workload': () => ({ body: overbookedWorkload() }),
    });
    renderPage();
    expect(await screen.findByRole('status')).toHaveTextContent('Fatima Noor is overbooked in the next 4 weeks.');
    expect(screen.getByRole('link', { name: 'See the workload' })).toHaveAttribute('href', '/manage/resources');
  });

  it('stays quiet when the only overbooking has been accepted', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-01T09:00:00'));
    const accepted = overbookedWorkload();
    accepted.decisions.push({ id: 1, resourceId: 71, weekStart: '2026-10-05', decision: 'accept', note: null, date: '2026-10-01' });
    mockFetch({
      'GET /api/projects': () => ({ body: [sampleProject()] }),
      'GET /api/workload': () => ({ body: accepted }),
    });
    renderPage();
    expect(await screen.findByRole('link', { name: 'Portal' })).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run client/pages/manage`
Expected: FAIL. It can't resolve `./heatmap`, `./WorkloadHeatmap` or `./OverloadPanel`, the Resources page has no heatmap, and the dashboard shows no notice.

- [ ] **Step 3: API call** (`client/api.ts`)

Add `OverloadDecisionInput` to the schemas type import and `OverloadDecision` to the types import, then add to `api`:

```ts
  recordOverloadDecision: (input: OverloadDecisionInput) =>
    request<OverloadDecision>('/api/overloads/decisions', withBody('POST', input)),
```

- [ ] **Step 4: Create `client/pages/manage/heatmap.ts`**

```ts
import type { WeekLoad } from '../../../shared/capacity';
import type { OverloadDecision } from '../../../shared/types';

export type HeatLevel = 'none' | 'off' | 'low' | 'mid' | 'full' | 'over' | 'accepted';

/** True when the latest decision about this person's week is to accept the overbooking. */
export function isAccepted(decisions: OverloadDecision[], resourceId: number, weekStart: string): boolean {
  const latest = decisions.filter((d) => d.resourceId === resourceId && d.weekStart === weekStart).at(-1);
  return latest?.decision === 'accept';
}

/** How a week's cell is coloured: by how much of what the person can give is booked. */
export function heatLevel(week: WeekLoad, accepted: boolean): HeatLevel {
  if (week.overloaded) return accepted ? 'accepted' : 'over';
  if (week.workingDays === 0 || week.available === 0) return 'off';
  if (week.load === 0) return 'none';
  const share = week.load / week.available;
  if (share <= 0.5) return 'low';
  return share < 1 ? 'mid' : 'full';
}
```

- [ ] **Step 5: Create `client/pages/manage/WorkloadHeatmap.tsx`**

```tsx
import { Link } from 'react-router';
import type { PersonLoad } from '../../../shared/capacity';
import type { OverloadDecision } from '../../../shared/types';
import { shortDate } from '../../overloads';
import { heatLevel, isAccepted, type HeatLevel } from './heatmap';

const LEVEL_TEXT: Record<HeatLevel, string> = {
  none: 'free',
  off: 'not working',
  low: 'lightly booked',
  mid: 'booked',
  full: 'fully booked',
  over: 'overbooked',
  accepted: 'overbooked (accepted)',
};

interface WorkloadHeatmapProps {
  loads: PersonLoad[];
  decisions: OverloadDecision[];
  selected: { resourceId: number; weekStart: string } | null;
  onSelect: (resourceId: number, weekStart: string) => void;
}

/** People by weeks, each cell coloured by how much of that week is booked. */
export function WorkloadHeatmap({ loads, decisions, selected, onSelect }: WorkloadHeatmapProps) {
  if (loads.length === 0) return <p className="muted">No active tech-team people yet.</p>;
  const weeks = loads[0].weeks.map((w) => w.weekStart);

  return (
    <div className="heatmap-scroll">
      <table className="heatmap" aria-label="Workload">
        <thead>
          <tr>
            <th scope="col">Person</th>
            {weeks.map((w) => <th key={w} scope="col">{shortDate(w)}</th>)}
          </tr>
        </thead>
        <tbody>
          {loads.map((person) => (
            <tr key={person.resourceId}>
              <th scope="row"><Link to={`/manage/resources/${person.resourceId}`}>{person.name}</Link></th>
              {person.weeks.map((w) => {
                const level = heatLevel(w, isAccepted(decisions, person.resourceId, w.weekStart));
                const isSelected = selected?.resourceId === person.resourceId && selected.weekStart === w.weekStart;
                const classes = ['heat', `heat-${level}`, w.leaveDays > 0 ? 'has-leave' : '', isSelected ? 'selected' : '']
                  .filter(Boolean)
                  .join(' ');
                return (
                  <td key={w.weekStart}>
                    <button
                      type="button"
                      className={classes}
                      aria-pressed={isSelected}
                      aria-label={`${person.name}, week of ${shortDate(w.weekStart)}: ${Math.round(w.load)}% booked of ${Math.round(w.available)}% available, ${LEVEL_TEXT[level]}`}
                      onClick={() => onSelect(person.resourceId, w.weekStart)}
                    >
                      {level === 'off' ? '—' : w.load > 0 ? `${Math.round(w.load)}%` : ''}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 6: Create `client/pages/manage/OverloadPanel.tsx`**

```tsx
import { useState } from 'react';
import { addDays } from '../../../shared/calendar';
import { computeWorkload, type PersonLoad, type WeekLoad } from '../../../shared/capacity';
import type { AssignmentInput } from '../../../shared/schemas';
import type { OverloadDecisionKind, WorkloadAssignment, WorkloadData } from '../../../shared/types';
import { AlertIcon } from '../../icons';
import { api } from '../../api';
import { messagesOf } from '../../errors';
import { shortDate } from '../../overloads';
import { isAccepted } from './heatmap';

interface OverloadPanelProps {
  data: WorkloadData;
  person: PersonLoad;
  week: WeekLoad;
  onClose: () => void;
  /** Called after a change is saved, so the page reloads the workload. */
  onChanged: () => void;
}

type Mode = 'split' | 'reassign' | 'accept' | null;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const keep = (a: WorkloadAssignment): AssignmentInput => ({ resourceId: a.resourceId, allocation: a.allocation, role: a.role });

/** One person's week: what is booked, and, when it is overbooked, a prompt to split, reassign or accept. */
export function OverloadPanel({ data, person, week, onClose, onChanged }: OverloadPanelProps) {
  const [mode, setMode] = useState<Mode>(null);
  const [allocations, setAllocations] = useState<Record<number, number>>({});
  const [moving, setMoving] = useState<number | null>(null);
  const [to, setTo] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const accepted = isAccepted(data.decisions, person.resourceId, week.weekStart);
  // Everyone else's load this week, to help choose who to reassign to.
  const others = computeWorkload(
    data.resources.filter((r) => r.id !== person.resourceId),
    data.assignments,
    { start: week.weekStart, end: addDays(week.weekStart, 6) },
    data.calendar,
  );

  /** The whole phase's people as the API expects them, with one assignment changed. */
  const phaseList = (phaseId: number, change: (a: WorkloadAssignment) => AssignmentInput) =>
    data.assignments.filter((a) => a.phaseId === phaseId).map(change);

  const decide = (decision: OverloadDecisionKind, reason?: string) =>
    api.recordOverloadDecision({ resourceId: person.resourceId, weekStart: week.weekStart, decision, note: reason });

  async function run(action: () => Promise<unknown>) {
    setSaving(true);
    setErrors([]);
    try {
      await action();
      setMode(null);
      onChanged();
    } catch (err) {
      setErrors(messagesOf(err));
    } finally {
      setSaving(false);
    }
  }

  const saveSplit = () =>
    run(async () => {
      for (const item of week.items) {
        const next = allocations[item.assignmentId];
        if (next === undefined || next === item.allocation) continue;
        await api.setPhaseAssignments(
          item.phaseId,
          phaseList(item.phaseId, (a) => (a.id === item.assignmentId ? { ...keep(a), allocation: next } : keep(a))),
        );
      }
      await decide('split');
    });

  const saveReassign = () =>
    run(async () => {
      const item = week.items.find((i) => i.assignmentId === moving);
      if (!item || to === null) return;
      await api.setPhaseAssignments(
        item.phaseId,
        phaseList(item.phaseId, (a) => (a.id === item.assignmentId ? { ...keep(a), resourceId: to } : keep(a))),
      );
      await decide('reassign');
    });

  const saveAccept = () => run(() => decide('accept', note));

  return (
    <aside className="card overload-panel">
      <div className="panel-head">
        <h2>{person.name} · week of {shortDate(week.weekStart)}</h2>
        <button type="button" className="button secondary" onClick={onClose}>Close</button>
      </div>
      <p>
        {Math.round(week.load)}% booked of {Math.round(week.available)}% available
        {week.leaveDays > 0 ? ` · ${plural(week.leaveDays, 'day')} of leave` : ''}
      </p>
      {week.items.length === 0 ? (
        <p className="muted">Nothing booked this week.</p>
      ) : (
        <ul className="people-list">
          {week.items.map((i) => (
            <li key={i.assignmentId}>{i.projectName} · {i.phaseName}: {i.allocation}% for {plural(i.days, 'day')}</li>
          ))}
        </ul>
      )}

      {errors.length > 0 ? (
        <div className="errors" role="alert">
          <AlertIcon />
          <ul>{errors.map((m) => <li key={m}>{m}</li>)}</ul>
        </div>
      ) : null}

      {week.overloaded ? (
        <div className="decision">
          <h3>{accepted ? 'Overbooked, and accepted' : 'This week is overbooked. What do you want to do?'}</h3>
          <div className="decision-options">
            <button type="button" className="button secondary" aria-pressed={mode === 'split'} onClick={() => setMode('split')}>
              Split the time
            </button>
            <button
              type="button"
              className="button secondary"
              aria-pressed={mode === 'reassign'}
              disabled={week.items.length === 0}
              onClick={() => setMode('reassign')}
            >
              Reassign work
            </button>
            <button type="button" className="button secondary" aria-pressed={mode === 'accept'} onClick={() => setMode('accept')}>
              Accept the risk
            </button>
            <button type="button" className="button secondary" disabled>Pause a project</button>
            <button type="button" className="button secondary" disabled>Delay a phase</button>
          </div>
          <p className="muted">Pausing a project and delaying a phase arrive with holds and phase changes in later milestones.</p>

          {mode === 'split' ? (
            <div className="decision-form">
              {week.items.map((i) => (
                <label key={i.assignmentId}>
                  Allocation for {i.projectName} · {i.phaseName} (%)
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={Number.isNaN(allocations[i.assignmentId]) ? '' : allocations[i.assignmentId] ?? i.allocation}
                    onChange={(e) => setAllocations((s) => ({ ...s, [i.assignmentId]: e.target.valueAsNumber }))}
                  />
                </label>
              ))}
              <button type="button" className="button" disabled={saving} onClick={() => void saveSplit()}>Save new allocations</button>
            </div>
          ) : null}

          {mode === 'reassign' ? (
            <div className="decision-form">
              <label>
                Work to move
                <select value={moving ?? ''} onChange={(e) => setMoving(e.target.value === '' ? null : Number(e.target.value))}>
                  <option value="">Choose…</option>
                  {week.items.map((i) => (
                    <option key={i.assignmentId} value={i.assignmentId}>{i.projectName} · {i.phaseName} ({i.allocation}%)</option>
                  ))}
                </select>
              </label>
              <label>
                Give it to
                <select value={to ?? ''} onChange={(e) => setTo(e.target.value === '' ? null : Number(e.target.value))}>
                  <option value="">Choose a person…</option>
                  {others.map((o) => (
                    <option key={o.resourceId} value={o.resourceId}>
                      {o.name} ({Math.round(o.weeks[0]?.load ?? 0)}% booked this week)
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="button"
                disabled={saving || moving === null || to === null}
                onClick={() => void saveReassign()}
              >
                Reassign
              </button>
            </div>
          ) : null}

          {mode === 'accept' ? (
            <div className="decision-form">
              <label>
                Why is this OK? (optional)
                <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
              <button type="button" className="button" disabled={saving} onClick={() => void saveAccept()}>Record the decision</button>
            </div>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
```

- [ ] **Step 7: Heatmap on the Resources page (`client/pages/manage/ResourcesPage.tsx`)**

- Add the imports:

```tsx
import { addDays, todayLocal } from '../../../shared/calendar';
import { computeWorkload, weekStartOf } from '../../../shared/capacity';
import { useWorkload } from '../../useWorkload';
import { OverloadPanel } from './OverloadPanel';
import { WorkloadHeatmap } from './WorkloadHeatmap';
```

- Add above the component:

```tsx
const WEEKS_SHOWN = 13;
const defaultStart = () => addDays(weekStartOf(todayLocal()), -14);
```

- Add inside the component, after the existing hooks:

```tsx
  const { workload, error: workloadError, reload } = useWorkload();
  const [from, setFrom] = useState(defaultStart);
  const [selected, setSelected] = useState<{ resourceId: number; weekStart: string } | null>(null);

  const range = { start: from, end: addDays(from, WEEKS_SHOWN * 7 - 1) };
  const loads = workload ? computeWorkload(workload.resources, workload.assignments, range, workload.calendar) : [];
  const selectedPerson = selected ? loads.find((l) => l.resourceId === selected.resourceId) : undefined;
  const selectedWeek = selected ? selectedPerson?.weeks.find((w) => w.weekStart === selected.weekStart) : undefined;
```

- Insert before the **People** `<section>`:

```tsx
      <section className="card">
        <div className="card-head">
          <h2>Workload</h2>
          <div className="year-nav">
            <button type="button" className="button secondary" aria-label="Earlier weeks" onClick={() => setFrom((f) => addDays(f, -28))}>‹</button>
            <button type="button" className="button secondary" onClick={() => setFrom(defaultStart())}>This week</button>
            <button type="button" className="button secondary" aria-label="Later weeks" onClick={() => setFrom((f) => addDays(f, 28))}>›</button>
          </div>
        </div>
        <p className="muted">How much of each week is booked. Click a week to see what is in it and to sort out an overbooking.</p>
        <div className="heat-legend" aria-hidden="true">
          <span className="heat heat-low">Light</span>
          <span className="heat heat-mid">Booked</span>
          <span className="heat heat-full">Full</span>
          <span className="heat heat-over">Overbooked</span>
          <span className="heat heat-accepted">Accepted</span>
          <span className="heat has-leave">Leave</span>
        </div>
        {workloadError ? (
          <div className="errors" role="alert">
            <AlertIcon />
            <span>{workloadError.message}</span>
          </div>
        ) : null}
        {!workload && !workloadError ? <p className="muted">Loading…</p> : null}
        {workload ? (
          <WorkloadHeatmap
            loads={loads}
            decisions={workload.decisions}
            selected={selected}
            onSelect={(resourceId, weekStart) => setSelected({ resourceId, weekStart })}
          />
        ) : null}
      </section>

      {workload && selectedPerson && selectedWeek ? (
        <OverloadPanel
          data={workload}
          person={selectedPerson}
          week={selectedWeek}
          onClose={() => setSelected(null)}
          onChanged={reload}
        />
      ) : null}
```

- [ ] **Step 8: Dashboard notice (`client/pages/manage/ManageDashboardPage.tsx`)**

- Add the imports:

```tsx
import { addDays } from '../../../shared/calendar';
import { computeWorkload, weekStartOf } from '../../../shared/capacity';
import { useWorkload } from '../../useWorkload';
import { isAccepted } from './heatmap';
```

Merge `addDays` into the existing `../../../shared/calendar` import.

- After the existing `const today = todayLocal();` line, add:

```tsx
  const { workload } = useWorkload();
  const thisWeek = weekStartOf(today);
  const overbooked = workload
    ? computeWorkload(workload.resources, workload.assignments, { start: thisWeek, end: addDays(thisWeek, 27) }, workload.calendar)
        .filter((p) => p.weeks.some((w) => w.overloaded && !isAccepted(workload.decisions, p.resourceId, w.weekStart)))
    : [];
```

- Directly after the `projects.error` banner, add:

```tsx
      {overbooked.length > 0 ? (
        <div className="notice" role="status">
          <AlertIcon />
          <span>
            {overbooked.length === 1 ? `${overbooked[0].name} is` : `${overbooked.length} people are`} overbooked in the next 4 weeks.
          </span>
          <Link to="/manage/resources">See the workload</Link>
        </div>
      ) : null}
```

- [ ] **Step 9: Styles** (append to `client/styles.css`)

```css
.card-head { display: flex; justify-content: space-between; align-items: center; gap: var(--sp-3); flex-wrap: wrap; margin-bottom: var(--sp-2); }
.card-head h2 { margin: 0; }

.heatmap-scroll { overflow-x: auto; margin: 0 calc(var(--sp-2) * -1); padding: 0 var(--sp-2); }
.heatmap { border-collapse: separate; border-spacing: 3px; width: auto; font-size: var(--fs-sm); }
.heatmap th, .heatmap td { border: 0; padding: 0; white-space: nowrap; }
.heatmap thead th { font-weight: 500; color: var(--muted); padding: 0 var(--sp-1) var(--sp-1); text-align: center; }
.heatmap tbody th { padding-right: var(--sp-3); font-weight: 500; }
.heat {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 3.4rem;
  height: 2rem;
  padding: 0 var(--sp-1);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--ink);
  font: inherit;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}
button.heat:hover { border-color: var(--border-strong); }
.heat-low { background: var(--primary-wash); border-color: transparent; }
.heat-mid { background: oklch(0.82 0.08 230); border-color: transparent; }
.heat-full { background: oklch(0.70 0.12 230); border-color: transparent; color: var(--on-primary); }
.heat-over { background: var(--danger); border-color: transparent; color: var(--on-primary); font-weight: 600; }
.heat-accepted { background: var(--warning-wash); border: 2px dashed var(--warning); font-weight: 600; }
.heat-off { background: var(--surface-2); color: var(--muted); }
.has-leave { background-image: repeating-linear-gradient(135deg, transparent 0 5px, oklch(0.23 0.02 235 / 0.12) 5px 7px); }
.heat.selected { outline: 3px solid var(--primary); outline-offset: 1px; }
.heat-legend { display: flex; flex-wrap: wrap; gap: var(--sp-2); margin-bottom: var(--sp-3); }
.heat-legend .heat { cursor: default; min-width: auto; height: 1.6rem; padding: 0 var(--sp-2); font-size: var(--fs-xs); }

.overload-panel .panel-head { display: flex; justify-content: space-between; align-items: center; gap: var(--sp-3); }
.overload-panel .panel-head h2 { margin: 0; }
.decision { margin-top: var(--sp-4); padding-top: var(--sp-4); border-top: 1px solid var(--border); }
.decision-options { display: flex; flex-wrap: wrap; gap: var(--sp-2); margin: var(--sp-3) 0 var(--sp-2); }
.decision-options .button[aria-pressed='true'] { border-color: var(--primary); background: var(--primary-wash); }
.decision-form { display: flex; flex-direction: column; gap: var(--sp-3); max-width: 32rem; margin-top: var(--sp-3); }
.decision-form .button { align-self: flex-start; }

.notice {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  flex-wrap: wrap;
  padding: var(--sp-3) var(--sp-4);
  margin-bottom: var(--sp-5);
  border-radius: var(--radius-md);
  background: var(--warning-wash);
  border: 1px solid var(--warning);
}
.notice svg { width: 18px; height: 18px; color: var(--warning); flex: none; }
```

- [ ] **Step 10: Run the tests to verify they pass**

Run: `npx vitest run client`
Expected: PASS.

- [ ] **Step 11: Run the whole suite and the type check**

Run: `npm test` → Expected: PASS (all tests).
Run: `npm run typecheck` → Expected: exit code 0.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: workload heatmap with overload decisions, and an overbooking notice on the dashboard"
```

---

### Task 8: Demo team, leave and assignments (completes M4)

The demo gets a full tech team, two leave bookings and people on every demo phase. With these, the heatmap shows real overbookings in the weeks after the demo date:
- **Aisha Khan (Business analyst), week of 5 Oct 2026: 150%.** Case Management UAT (50%) overlaps E-Services requirements gathering (100%).
- **Jonas Weber (InfoSec), week of 19 Oct 2026.** He has 100% on Case Management security testing while on 3 days' training leave, so only 40% is available.
- **Fatima Noor, week of 12 Oct 2026:** a full week of annual leave, shown as "not working".

**Files:**
- Modify: `server/demoData.ts`
- Test: `server/demoData.test.ts`

**Interfaces:**
- Consumes: `DEMO_PEOPLE`, `DemoPerson`, `toProjectInput`, `seedDemo` (Task 2); `addLeave`, `createResource` (Task 1); `leaveInputSchema` (Task 1); `workloadData` (Task 4); `computeWorkload` (Task 3); `AssignmentRole` (Task 4).
- Produces:
  - `DEMO_PEOPLE` adds the tech team:

    | Name | Role | Specialisation | Capacity |
    |---|---|---|---|
    | Hassan Ali | Tech lead | full-stack | 100% |
    | Fatima Noor | Developer | front-end | 100% |
    | Rami Saleh | Developer | back-end | 80% |
    | Aisha Khan | Business analyst | — | 100% |
    | Mei Chen | Designer | — | 100% |
    | Priya Das | QA | — | 100% |
    | Jonas Weber | InfoSec | — | 100% |

  - `DEMO_LEAVE`: Fatima Noor 2026-10-12 → 2026-10-16 "Annual leave"; Jonas Weber 2026-10-19 → 2026-10-21 "Training".
  - `TEAM_BY_PHASE`: who works on each standard phase name, with allocation and role. `toProjectInput` gives every demo phase its people from it.
  - `seedDemo` adds the leave after the people.

- [ ] **Step 1: Write the failing test**

In `server/demoData.test.ts`:
- Add the imports:

```ts
import { computeWorkload } from '../shared/capacity';
import { workloadData } from './assignments/repo';
```

- Import `DEMO_PEOPLE` from `./demoData` alongside the others.
- In `'are all valid projects with unique names'`, replace `toProjectInput(demo, () => 1, () => 1)` with:

```ts
toProjectInput(demo, () => 1, (name) => DEMO_PEOPLE.findIndex((p) => p.name === name) + 1)
```

Every person needs a different id, because a phase refuses the same person twice.

- Add this test inside `describe('seedDemo', …)`:

```ts
  it('staffs every demo phase and shows real overbookings and leave around October 2026', () => {
    const db = openDb(':memory:');
    seedDemo(db, DEFAULT_CALENDAR);
    for (const p of listProjects(db)) {
      for (const ph of p.phases) expect(p.assignments.some((a) => a.phaseId === ph.id)).toBe(true);
    }

    const data = workloadData(db);
    expect(data.resources.map((r) => r.name)).not.toContain('Mariam Al Suwaidi');
    expect(data.resources.find((r) => r.name === 'Rami Saleh')?.capacity).toBe(80);

    const loads = computeWorkload(data.resources, data.assignments, { start: '2026-10-05', end: '2026-10-25' }, data.calendar);
    const week = (name: string, weekStart: string) => loads.find((l) => l.name === name)!.weeks.find((w) => w.weekStart === weekStart)!;

    // Case Management UAT (50%) + E-Services requirements gathering (100%).
    expect(week('Aisha Khan', '2026-10-05')).toMatchObject({ load: 150, available: 100, overloaded: true });
    // Case Management security testing (100%) during 3 days of training leave.
    expect(week('Jonas Weber', '2026-10-19')).toMatchObject({ leaveDays: 3, load: 100, available: 40, overloaded: true });
    // A full week of annual leave with nothing booked.
    expect(week('Fatima Noor', '2026-10-12')).toMatchObject({ leaveDays: 5, available: 0, overloaded: false });
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run server/demoData.test.ts`
Expected: FAIL. There are no assignments on the demo phases, and `Aisha Khan` is not in the workload.

- [ ] **Step 3: Demo team, leave and who works on which phase (`server/demoData.ts`)**

- Add `leaveInputSchema` to the `../shared/schemas` import, `AssignmentRole` to the `../shared/types` import, and `addLeave` to the `./resources/repo` import.
- Append these entries to the end of the `DEMO_PEOPLE` array, after the business contacts:

```ts
  { name: 'Hassan Ali', side: 'tech', role: 'Tech lead', specialisation: 'full-stack', email: 'hassan.ali@example.com' },
  { name: 'Fatima Noor', side: 'tech', role: 'Developer', specialisation: 'front-end' },
  { name: 'Rami Saleh', side: 'tech', role: 'Developer', specialisation: 'back-end', capacity: 80 },
  { name: 'Aisha Khan', side: 'tech', role: 'Business analyst' },
  { name: 'Mei Chen', side: 'tech', role: 'Designer' },
  { name: 'Priya Das', side: 'tech', role: 'QA' },
  { name: 'Jonas Weber', side: 'tech', role: 'InfoSec' },
```

- Add after `DEMO_PEOPLE`:

```ts
/** Leave booked for the demo team. */
export const DEMO_LEAVE: { person: string; start: string; end: string; note: string }[] = [
  { person: 'Fatima Noor', start: '2026-10-12', end: '2026-10-16', note: 'Annual leave' },
  { person: 'Jonas Weber', start: '2026-10-19', end: '2026-10-21', note: 'Training' },
];

/** Who works on each standard phase in the demo, and how much of their week. */
export const TEAM_BY_PHASE: Record<string, { person: string; allocation: number; role: AssignmentRole }[]> = {
  'Requirements gathering': [{ person: 'Aisha Khan', allocation: 100, role: 'responsible' }],
  'Business analysis': [{ person: 'Aisha Khan', allocation: 100, role: 'responsible' }],
  'Development plan': [{ person: 'Hassan Ali', allocation: 50, role: 'responsible' }],
  Design: [{ person: 'Mei Chen', allocation: 100, role: 'responsible' }],
  Development: [
    { person: 'Hassan Ali', allocation: 30, role: 'responsible' },
    { person: 'Fatima Noor', allocation: 60, role: 'contributor' },
    { person: 'Rami Saleh', allocation: 60, role: 'contributor' },
  ],
  QA: [{ person: 'Priya Das', allocation: 100, role: 'responsible' }],
  UAT: [
    { person: 'Aisha Khan', allocation: 50, role: 'responsible' },
    { person: 'Priya Das', allocation: 30, role: 'contributor' },
  ],
  'Security testing': [{ person: 'Jonas Weber', allocation: 100, role: 'responsible' }],
  Deployment: [{ person: 'Hassan Ali', allocation: 50, role: 'responsible' }],
  Launch: [{ person: 'Hassan Ali', allocation: 30, role: 'responsible' }],
};
```

- In `toProjectInput`, add a `phases` property to the returned object, after `...rest,`:

```ts
    phases: rest.phases.map((ph) => ({
      ...ph,
      assignments: (TEAM_BY_PHASE[ph.name] ?? []).map((t) => ({ resourceId: personId(t.person), allocation: t.allocation, role: t.role })),
    })),
```

- In `seedDemo`, add after the `personId` helper, before the projects loop:

```ts
    for (const l of DEMO_LEAVE) addLeave(db, personId(l.person), leaveInputSchema.parse({ start: l.start, end: l.end, note: l.note }));
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run server/demoData.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the whole suite and the type check**

Run: `npm test` → Expected: PASS (all tests).
Run: `npm run typecheck` → Expected: exit code 0.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: demo team with leave and assignments that show real overbookings"
```

---

### Task 9: Weekday labels, and leave shown on the days it falls on (M4 review feedback, 2026-09-25)

**Why:** in review the user found the week labels confusing. People work Monday to Friday, but each heatmap week showed only its Monday ("12 Oct"). Fatima's leave from Mon 12 to Fri 16 Oct appeared as "week of 12 Oct · 5 days of leave", which reads as five days of leave on the 12th alone. The data was right; the labels were not. Every week and date shown in M4's workload views now carries its weekday, and a week is labelled by its working days.

**Files:**
- Modify: `client/overloads.ts`, `client/pages/manage/WorkloadHeatmap.tsx`, `client/pages/manage/OverloadPanel.tsx`, `client/pages/manage/PersonPage.tsx`, `client/pages/manage/PeopleFields.tsx`, `client/pages/manage/ProjectPeople.tsx`, `client/pages/manage/labels.ts`, `client/styles.css` (header wraps on two lines)
- Test: `client/overloads.test.ts`, `client/pages/manage/WorkloadHeatmap.test.tsx`, `client/pages/manage/OverloadPanel.test.tsx`, `client/pages/manage/PersonPage.test.tsx`, plus the existing tests whose expected strings change

**Interfaces:**
- Consumes: `WorkCalendar`, `dayOfWeek`, `addDays`, `countWorkingDays` (`shared/calendar.ts`); `WeekLoad` (Task 3); `WorkloadData.resources[].leave` (Task 4).
- Produces, in `client/overloads.ts`:
  - `dayDate(d)` → `"Mon 12 Oct"` (weekday + day + month). This replaces `shortDate` everywhere it labels a date in the UI.
  - `weekLabel(weekStart, cal)` → `"Mon 12 Oct – Fri 16 Oct"`: the first and last day of that Monday-to-Sunday week that is not in `cal.weekendDays` (holidays are ignored, so a holiday Monday does not shift the label). With the default calendar this is always Monday to Friday. When all seven days are weekend days, it falls back to `dayDate(weekStart)`.
  - `leaveInWeek(leave, weekStart)` → the person's leave ranges that overlap the week, each clipped to the week, as `{ start, end, note }[]`.
  - `phaseWarnings(...)` gains a calendar parameter, and each line starts with the week label: `"Mon 5 Oct – Fri 9 Oct: 150% booked, 100% available"`.
- In `client/pages/manage/labels.ts`: `formatDate` gains the weekday (`"Mon 12 Oct 2026"`).

**Where each label appears:**
1. **Heatmap column headers** (`WorkloadHeatmap`): two lines, `Mon 12 Oct` over `– Fri 16 Oct`. Each cell's aria-label says `"<name>, Mon 12 Oct – Fri 16 Oct: …"` instead of `"week of 12 Oct"`. The heatmap receives the calendar as a new `calendar` prop from `ResourcesPage`.
2. **Decision prompt** (`OverloadPanel`): the heading reads `"Fatima Noor · Mon 12 Oct – Fri 16 Oct"`. Under the summary, each overlapping leave range is its own line, e.g. `"On leave Mon 12 Oct – Fri 16 Oct · Annual leave"`, or `"On leave Mon 19 Oct – Wed 21 Oct · Training"` for Jonas. A single day reads `"On leave Tue 13 Oct"`. The existing "N days of leave" count stays.
3. **Overbooking warnings** on the project page and wizard Step 4 use the new `phaseWarnings` text. The phase date range above them uses `dayDate`: `"Mon 5 Oct – Fri 23 Oct"`.
4. **Leave day slices on the heatmap** (user decision, 2026-09-25): each cell gets a strip of day slices along its bottom edge, one per working weekday of that week (the days of Mon–Sun not in `cal.weekendDays`, so five by default). A slice is striped when the person is on leave that day. Fatima's week of 12 Oct has all five striped; Jonas's week of 19 Oct has Mon, Tue and Wed striped and Thu and Fri plain. This replaces the whole-cell `has-leave` stripe. Add `leaveDaysInWeek(leave, weekStart, cal)` to `client/overloads.ts`, returning each working weekday of the week as `{ date, onLeave }`. The heatmap needs each person's `leave`, so pass `WorkloadData.resources` to it. The strip is `aria-hidden`; the cell's aria-label adds `", on leave Mon 19 Oct – Wed 21 Oct"` so screen readers get the same information. The legend's **Leave** sample shows a striped slice. Keep the slices at least 3px tall so they are visible on a phone.
5. **Person page leave list**: `"Mon 12 Oct 2026 → Fri 16 Oct 2026 · Annual leave · 5 working days"` (use `countWorkingDays` with the workload calendar; write "1 working day" in the singular). The remove button's aria-label uses the new `formatDate`.

- [ ] **Step 1: Write the failing tests**
  - `client/overloads.test.ts`:
    - `dayDate('2026-10-12')` is `'Mon 12 Oct'`.
    - `weekLabel('2026-10-12', DEFAULT_CALENDAR)` is `'Mon 12 Oct – Fri 16 Oct'`.
    - `weekLabel('2026-09-28', DEFAULT_CALENDAR)` is `'Mon 28 Sep – Fri 2 Oct'`, across a month end.
    - With `{ weekendDays: [5, 6], holidays: [] }` (Friday and Saturday off), `weekLabel('2026-10-12', …)` is `'Mon 12 Oct – Sun 18 Oct'`.
    - `leaveInWeek` clips a leave range that runs past the week.
    - Update the existing `phaseWarnings` expectations to the new wording.
  - `WorkloadHeatmap.test.tsx`: the column header shows `Mon 12 Oct` and `Fri 16 Oct`. A cell's accessible name contains `Mon 12 Oct – Fri 16 Oct`.
  - `OverloadPanel.test.tsx`: for a week with leave, the heading contains the week label and the text `On leave Mon 12 Oct – Fri 16 Oct · Annual leave` is shown. This fixture needs leave on the person; add it.
  - `WorkloadHeatmap.test.tsx`: in Jonas's week of 19 Oct, three of the five slices carry the leave class (query them with `container.querySelectorAll` inside that cell), and the cell's accessible name contains `on leave Mon 19 Oct – Wed 21 Oct`.
  - `client/overloads.test.ts`: `leaveDaysInWeek` for Jonas's leave in the week of 19 Oct gives `[true, true, true, false, false]`. Leave ending on a Sunday does not add a slice.
  - `PersonPage.test.tsx`: the leave row shows `Mon 12 Oct 2026 → Fri 16 Oct 2026` and `5 working days`.
- [ ] **Step 2:** Run `npx vitest run client` and confirm the new tests FAIL.
- [ ] **Step 3:** Implement the helpers and the four places above. `dayOfWeek` returns 0 for Sunday, so use `const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']`. Remove `shortDate` once nothing uses it. Update any other test that asserted the old `"Week of 5 Oct"`, `"week of 5 Oct"` or `"12 Oct 2026"` text.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`, and confirm both pass.
- [ ] **Step 5:** Commit with `feat: label weeks and dates with their weekdays, and show leave on the days it falls on`.

---

### Task 10: Resources table — Projects column, sorting on every column, "Working on" filter (M4 review feedback, 2026-09-25)

**Why:** the user wants to see which people are on the same projects, and to sort the People table by any column.

**Files:**
- Modify: `shared/types.ts`, `server/resources/repo.ts`, `client/pages/manage/ResourcesPage.tsx`, `client/styles.css`, `client/testing/fixtures.ts` (the `samplePeople()` fixture gains `projects`)
- Create: `client/pages/manage/peopleTable.ts` (pure sort and filter helpers)
- Test: `server/resources/resources.test.ts`, `client/pages/manage/peopleTable.test.ts` (new), `client/pages/manage/ResourcesPage.test.tsx`

**Interfaces:**
- Produces:
  - `shared/types.ts`: `PersonProject { id: number; name: string; finished: boolean }`. `ResourceRecord.projects: PersonProject[]`, ordered by name.
  - `server/resources/repo.ts`: `listResources(db, today = todayLocal())` and `getResource` fill `projects`. `today` is a parameter so tests can fix it.
  - `client/pages/manage/peopleTable.ts`:
    - `type SortKey = 'name' | 'side' | 'role' | 'capacity' | 'contact' | 'status' | 'projects'`
    - `sortPeople(people, key, dir: 'asc' | 'desc')`
    - `workingOn(person, projectId)`

**The rule for which projects a person is "on"** (the user's decision):
1. A person is on a project when they are **assigned to one of its phases** or are its **tech PM or business PM**.
2. Each link has an end date: an assignment ends at its phase's planned end, and a PM role ends at the project's last phase end. A project with no phases counts as current for its PMs.
3. **Current** means that end date is today or later. List every project with at least one current link, with `finished: false`.
4. **If there are none, keep the most recent one.** List only the project whose link ended most recently, with `finished: true`, so the person still groups with that team. Break a tie on date by project name.
5. **No links at all:** the list is empty.

Do this with two queries and a small TypeScript fold in `server/resources/repo.ts`: one query gets every (resource id, project id, project name, end date) from assignments joined to phases, and the other gets the same for PM links, using `MAX(phases.planned_end)` per project. Then fold them per person.

**Table (`ResourcesPage`):**
- **Projects column.** Add it after Role. Each project is a link to `/manage/projects/:id`, with projects separated by commas. A finished one is muted, with a small "finished" note after the name. An empty list shows "—".
- **Sortable headers.** Every column header, Projects included, is a `<button>` inside its `<th>`. The `<th>` carries `aria-sort="ascending"`, `"descending"` or `"none"`. Clicking a header sorts ascending by it; clicking the same header again flips the direction. The default is Name, ascending. Show a small ▲ or ▼ on the active column.
- **Sort keys:**
  - name, side, role and status sort by their text, compared without regard to case;
  - capacity sorts numerically;
  - contact sorts by phone, then email;
  - projects sorts by the person's project names joined in order, so people on the same project sit together. People with no projects come last in both directions.
  - Ties are broken by name.
- **Working on filter.** Add a `<select>` labelled "Working on", beside the Side and Role filters. It offers "Any project" plus every project that appears in anyone's list, sorted by name. Picking one shows only the people whose `projects` include it, whether current or finished.

- [ ] **Step 1: Write the failing tests**
  - Server (`resources.test.ts`), with today fixed at `2026-10-01`. Set up a person assigned to a phase ending `2026-10-20`, and to a phase of a second project ending `2026-09-10`. Check that:
    - that person lists only the first project, with `finished: false`;
    - a person whose only assignment ended on `2026-09-10` lists that project with `finished: true`;
    - a tech PM of a project whose last phase ends in the future lists it as current;
    - a person with no links has `[]`.
  - `peopleTable.test.ts`:
    - sorting by projects groups two people who share a project and puts a person with no projects last, in both directions;
    - sorting by capacity is numeric (80 before 100);
    - ties are broken by name.
  - `ResourcesPage.test.tsx`:
    - clicking the Projects header sets `aria-sort="ascending"` on it and reorders the rows; clicking it again sets `"descending"`;
    - choosing a project in "Working on" shows only its people.

  These tests are scoped to the `People` table, as in Task 5.
- [ ] **Step 2:** Run the new tests and confirm they FAIL.
- [ ] **Step 3:** Implement the server fold, the helpers and the table.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`, and confirm both pass.
- [ ] **Step 5:** Commit with `feat: projects column, sortable columns and a working-on filter on the people table`.

---

### Task 11: Days / Weeks switch on the workload heatmap (M4 second review, 2026-09-25)

**Why:** the user read each week column ("MON 12 OCT – FRI 16 OCT") as a day with two dates, and expected a week to be five blocks. Task 9's thin day-slice strip was too small to notice, so Fatima's full week of leave still looked like one block on one day. The user chose a **Days | Weeks** switch.

**Files:**
- Modify: `shared/capacity.ts` (a day-level function next to `computeWorkload`), `client/pages/manage/WorkloadHeatmap.tsx`, `client/pages/manage/ResourcesPage.tsx`, `client/pages/manage/heatmap.ts`, `client/styles.css`
- Create: `client/pages/manage/DayHeatmap.tsx` (or a `mode` prop on `WorkloadHeatmap`, whichever keeps each file focused)
- Test: `shared/capacity.test.ts`, `client/pages/manage/heatmap.test.ts`, `client/pages/manage/WorkloadHeatmap.test.tsx` and/or `DayHeatmap.test.tsx`, `client/pages/manage/ResourcesPage.test.tsx`

**Interfaces:**
- Consumes: `computeWorkload`, `WeekLoad`, `OVERLOAD_TOLERANCE`, `CapacityResource`, `CapacityAssignment` (Task 3); `isWorkingDay`, `addDays`, `WorkCalendar` (`shared/calendar.ts`); `dayDate`, `weekLabel`, `leaveInWeek`, `leaveDaysInWeek` (Task 9); `isAccepted`, `heatLevel` (Task 7).
- Produces:
  - `shared/capacity.ts`:
    - `DayLoad { date; working: boolean; onLeave: boolean; load: number; available: number; overloaded: boolean; items: { assignmentId; projectName; phaseName; allocation }[] }`
    - `computeDailyLoad(resources, assignments, range, cal): { resourceId; name; days: DayLoad[] }[]`
    - The rules for each day:
      - `load` = the sum of the allocations of the person's assignments whose start ≤ day ≤ end;
      - `available` = `capacity`, or `0` when the day is a leave day;
      - `overloaded` = `load > available + OVERLOAD_TOLERANCE`;
      - a non-working day (weekend or holiday) has `working: false`, and is not rendered.
  - `client/pages/manage/heatmap.ts`: `dayLevel(day, accepted)` returns a `HeatLevel`, using the same bands as `heatLevel`. A leave day with no load is `'off'`. A leave day that has load is `'over'`.
  - `isoWeek(date)`: the ISO-8601 week number, used for the "Week 42" heading.

**Days view (the default):**
- **Headings:**
  - The first header row gives each week one `<th colSpan={n}>` reading "12–16 Oct" (or "28 Sep – 2 Oct" across months), with `n` = its working days.
  - The second row has one `<th>` per day, with the weekday letter over the date ("M" over "12"). Each has an `aria-label` like "Mon 12 Oct".
- **Cells:** one `<button>` per person per working day.
  - The text inside is the rounded load % (e.g. "150"), "Leave" on a leave day with no load, or empty when the day is free.
  - Leave days get a `leave` class, drawn as diagonal stripes over the whole block.
  - The aria-label reads like "Fatima Noor, Mon 12 Oct: on leave" or "Aisha Khan, Tue 6 Oct: 150% booked of 100% available, overbooked".
- **Range and navigation:** 4 weeks at a time, starting from this week's Monday minus one week. The arrows move 1 week, and "This week" resets.
- **Clicking a day** selects that person's week and opens the existing `OverloadPanel` for that week.
  - The panel now also lists the days in that week that are overbooked on their own, e.g. "Tue 6 Oct: 150% booked, 100% available".
  - In a week that is accepted (`isAccepted` for that week), the days that are overloaded show the accepted style, and the other days keep their normal colour (controller decision at build time).
- **Legend:** Light, Booked, Full, Overbooked, Accepted, Leave, each as a small block in its real style.

**Weeks view:**
- Today's heatmap, with these changes:
  - The column header is two lines: "Week 42" (from `isoWeek`) over "12–16 Oct".
  - Task 9's thin strip becomes a row of five **visible** day squares inside the cell, at least 8px each, with leave days striped. It sits under the booked % text.
- 13 weeks at a time, as now; the arrows move 4 weeks.

**Switch:** a two-button group, **Days | Weeks**, with `aria-pressed`, beside the arrows. It is stored in `localStorage` under `pvp.workloadView`. Wrap every read and write in try/catch and fall back to Days.

**Dashboard notice:** unchanged. It stays weekly, and single-day clashes don't count toward it.

- [ ] **Step 1: Write the failing tests**
  - `shared/capacity.test.ts`, for `computeDailyLoad`:
    - Fatima with leave 12–16 Oct has five working days with `onLeave: true`, and `available` is 0 on each.
    - A person at 50% Mon–Fri plus 100% on Monday only has `load: 150` and `overloaded: true` on Monday, and `load: 50` on Tuesday. Their weekly `computeWorkload` for the same week is 70% and not overloaded; the Days view shows the day clash that the weekly average hides.
    - Weekend days have `working: false`.
  - `heatmap.test.ts`:
    - `dayLevel` for a free leave day is `'off'`;
    - for a leave day with load it is `'over'`;
    - `isoWeek('2026-10-12')` is `42`.
  - The Days heatmap test:
    - the "12–16 Oct" group header spans 5 columns;
    - Fatima's row has five buttons labelled "on leave" in that week;
    - Jonas has three in the week of 19 Oct;
    - clicking a day calls `onSelect` with that week's Monday.
  - The Weeks heatmap test: the header shows "Week 42" and "12–16 Oct"; Jonas's week-of-19-Oct cell has 3 striped and 2 plain day squares.
  - `ResourcesPage.test.tsx`:
    - Days is pressed by default;
    - clicking Weeks switches views and the choice persists across a re-render;
    - the People-table tests are unaffected.
- [ ] **Step 2:** Run the new tests and confirm they FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`, and confirm both pass.
- [ ] **Step 5:** Commit with `feat: days and weeks views on the workload heatmap, with leave covering the days it falls on`.

---

### ✅ M4 checkpoint: stop and demo to the user

Start from a fresh demo database. An existing `data/pm.db` upgrades automatically: migration 6 moves the typed PM names into Resources. A fresh one shows the full demo team.
1. Stop `npm run dev`.
2. Delete `data/pm.db`.
3. Run `npm run seed`. Expected: "Added 6 demo projects."
4. Run `npm run dev` and open http://localhost:5173, or `http://<this PC's LAN IP>:5173` from a phone.

The user should be able to:
1. **Projects** shows a notice when someone is overbooked in the next 4 weeks. Around late September 2026 this is Aisha Khan, for the week of 5 Oct. **See the workload** opens Resources.
2. **Resources** shows the **Workload** heatmap: people by weeks.
   - Aisha's week of 5 Oct is red (150%).
   - Jonas's week of 19 Oct is red (leave).
   - Fatima's week of 12 Oct is striped and marked as not working. The column header reads "Mon 12 Oct – Fri 16 Oct", and clicking the cell shows "On leave Mon 12 Oct – Fri 16 Oct · Annual leave". In the **Days** view (the default) her row shows five striped "Leave" blocks under 12–16 Oct, and Jonas has three under 19–21 Oct. **Weeks** shows one block per week, headed "Week 42" over "12–16 Oct", with five visible day squares inside.
   - **‹ This week ›** moves 4 weeks at a time.
3. Click Aisha's red week. The panel lists her Case Management UAT and E-Services work, then:
   - **Split the time** down to 50% for one of them. The cell stops being red, and the decision is recorded.
   - Or **Reassign work** to someone else. Their load that week shows next to each name.
   - Or **Accept the risk** with a reason. The cell turns amber-dashed and the dashboard notice goes away.
   - **Pause a project** and **Delay a phase** are visible but disabled, until M8 and M7.
4. The **People** table filters by side, role and **Working on**. It has a **Projects** column, and every header sorts when clicked; clicking Projects puts people on the same project next to each other. **Add person**:
   - A tech-team person has a role, specialisation and capacity.
   - A business contact has a UAE mobile, and `04 123 4567` is refused.
5. On a tech person's page, add and remove leave, and see the heatmap change.
6. On a project, the **People** card edits who is on each phase. Setting someone above what they can give shows "Week of …: N% booked, M% available" before saving.
7. **New project** has a fourth step, **People**, with the same live warnings. In Step 1, the PM fields are now pickers from Resources:
   - "+ Add new person…" adds someone inline;
   - a business PM's phone and email come from their Resources entry.
8. **Settings** has a **Roles** list.

**Ask the user for feedback. When M4 is approved, fast-forward `main` and every other branch to `build/m4`, then write the M5 plan (Sub-phases and to-dos).**
