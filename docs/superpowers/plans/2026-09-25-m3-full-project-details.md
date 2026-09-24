# Milestone 3: Full Project Details — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture every project field from spec §3.2 Steps 1–2 in a 3-step create wizard (with editable dropdown lists, "+ Add new" inline, and four numbered, reorderable scope tables), let the user edit those details later, manage the lists in Settings, and group the presentation portfolio by main project.

**Architecture:**
- **Storage:** one new schema version (migration 2) adds:
  - a `list_values` table that holds all four editable dropdown lists: main projects, project types, goals and departments;
  - the new project columns;
  - a `scope_items` table.
- **Server:** list CRUD lives in `server/lists/repo.ts`, and project details in `server/projects/repo.ts`. All HTTP routes stay in `server/app.ts`.
- **Client:**
  - The create page becomes a 3-step wizard built from three field components. The Edit page reuses the first two of them.
  - Drag-and-drop plus keyboard reordering moves into one hook, `useReorder`, shared by the phase list and the scope tables.
  - The portfolio Gantt gains group rows with a summary bar.

**Tech Stack:** Node 24, TypeScript 5, React 19, React Router 7, Vite 6, Fastify 5, zod 3, `node:sqlite` (built in), Vitest 3, Testing Library, jsdom.

**Spec:** `docs/superpowers/specs/2026-09-24-visual-project-portfolio-design.md` (§2 Data model, §3.2 Steps 1–2, §3.4, §3.9, §4.2)

**Decisions confirmed with the user (2026-09-25):**
- **Editing:** project details can be edited after creation (Steps 1–2 fields and the scope tables). Phases stay create-only until M8 (change requests and baselines).
- **People fields:** Project manager and Business owner are free text for now. M4 turns them into pickers from the Resources list.
- **Create page layout:** a 3-step wizard: Basic info → Description & scope → Phases. The People and History steps (spec Steps 4–5) come in later milestones.
- **After the M3 demo (2026-09-25), Tasks 9–10:**
  - **Two project managers:** "Project manager (tech)" from the technical team, and a "Business project manager" (the business owner's representative) with an optional UAE mobile and an optional email.
  - **Phase names from a dropdown:** names come from an editable Phases list with "Other…".
  - **New default phases:** Requirements gathering, Business analysis, Development plan, Development, QA, UAT, Security testing, Deployment, Launch. "Design" stays in the list but is not a default.

**Deliberate deviations and choices (flag if you disagree):**
- **Main projects are stored as a list.** The spec models `MainProject` as its own entity with just a name. It is stored in `list_values` next to the other dropdown lists, so one table, one API and one Settings editor cover all four.
- **Priority and Categorisation are fixed:** Priority is High / Medium / Low, default Medium; the spec names the field but not its values. Categorisation is Strategic / Operational, exactly as the spec lists it. Neither is an editable list, and only the four dropdowns below are.
- **Settings is lists only in M3:** main projects, project types, goals and business users (departments). Weekend days, holidays, attachment types, roles and waiting-clock thresholds arrive with the milestones that use them.
- **Duplicate names return the existing value.** Adding a list value whose name already exists (ignoring case) returns the existing value instead of an error, so "+ Add new" never creates duplicates.

## Global Constraints

- **Branch:** all work happens on `build/m3`, created from `main`. **Never commit to `main`.** Merging to `main` happens only after the user approves the milestone.
- **Node:** 24.x or later is required (for `node:sqlite`). No native or compiled npm dependencies, because it runs on Windows.
- **Database:** use `node:sqlite` with raw SQL and versioned migrations (`PRAGMA user_version`). **Never edit a shipped migration — append a new one.**
- **Dates:** always ISO `YYYY-MM-DD` strings. "Today" is the local date (`todayLocal()`), never a UTC slice.
- **Tests:** every client test file starts with `// @vitest-environment jsdom`. Server and shared tests run in the default Node environment.
- **Presentation side is read-only:** no create or edit controls under `/present`.
- **Reordering:** reordering is drag-and-drop on a dedicated handle button, plus ArrowUp/ArrowDown on that handle. There are no up/down buttons. Only the handle is `draggable`, never the whole row.
- **Gantt bar colours:** bar colours come from the phase name (`phaseColorFor`). The project's own `colour` field does not colour bars.
- **Dropdown lists:** the four lists are `mainProject`, `projectType`, `goal` and `department`.
  - Names are unique within a list, ignoring case.
  - A value used by a project can be renamed but not deleted (409).
- **Defaults on a fresh database:**
  - Project types: `Criminal`, `Customer`, `Management`.
  - Goals: `Digitalisation of internal operations`.
  - Main projects and departments start empty.
- **Scope items:** every scope item keeps the date it was first added (`dateAdded`) across edits, because M8's scope-growth views depend on it.

## Where M3 sits

M1 (create a project, see its Gantt) and M2 (portfolio presentation) are merged to `main`. The roadmap row for M3 reads: *"All wizard fields: classification, main projects (with grouping on the portfolio), scope, out-of-scope, problems and objectives tables, dropdowns with '+ Add new', Settings lists."*

## File Structure (after M3)

```
shared/
  types.ts           + LIST_NAMES, ListValue, Lists, Ref, PRIORITIES, CATEGORIES, SCOPE_KINDS, ScopeItem; ProjectRecord gains details
  schemas.ts         + projectDetailsSchema, scopeItemInputSchema, listValueInputSchema; newProjectSchema extends details
server/
  db.ts              + migration 2; MIGRATIONS exported; transaction() can nest
  db.test.ts         new: upgrade from version 1, nested transactions
  lists/repo.ts      new: getLists, getListValue, addListValue, renameListValue, deleteListValue, isListName
  lists/lists.test.ts new
  projects/repo.ts   + details, scope items, checkListRefs, updateProjectDetails
  projects/details.test.ts new
  app.ts             + /api/lists routes, PUT /api/projects/:id/details
  demoData.ts        demo projects name their list values; seedDemo()
  seed.ts            uses seedDemo()
client/
  api.ts             + list and details calls; no JSON content type on bodiless requests
  useReorder.ts      new: drag-and-drop + keyboard reordering hook, moveItem()
  useLists.ts        new: loads the lists, remembers values added inline
  icons.tsx          + GripIcon
  components/ItemTable.tsx     new: auto-numbered, editable, reorderable item list
  components/OptionPicker.tsx  new: dropdown with inline "+ Add new" / "Other…"
  pages/manage/labels.ts       new: display labels shared by wizard, edit and project pages
  pages/manage/projectDraft.ts new: form state <-> API input, error → wizard step
  pages/manage/DetailsFields.tsx new: Step 1 (basic info + classification)
  pages/manage/ScopeFields.tsx   new: Step 2 (description + four scope tables)
  pages/manage/PhasesFields.tsx  new: Step 3 (start date, phases, live preview) — moved out of CreateProjectPage
  pages/manage/CreateProjectPage.tsx  rewritten as the 3-step wizard
  pages/manage/EditProjectPage.tsx    new
  pages/manage/ProjectPage.tsx        + Details, Description, Scope cards and "Edit details"
  pages/manage/ListEditor.tsx         new
  pages/manage/SettingsPage.tsx       new
  gantt/Gantt.tsx    + group and child rows (summary bar, not clickable, indented children)
  gantt/rows.ts      + groupedPortfolioRows()
  pages/present/PortfolioPage.tsx  uses groupedPortfolioRows()
```

---

### Task 1: Dropdown lists — storage and API

This task adds migration 2, which holds the whole M3 schema: `list_values`, the new project columns and `scope_items`. Putting it all in one migration keeps a single schema version for the milestone. The lists code in this task uses the new `projects.*_id` columns to refuse deleting a value that is in use. The details and `scope_items` columns are first read and written in Task 2.

**Files:**
- Modify: `server/db.ts` (export `MIGRATIONS`, append migration 2)
- Modify: `shared/types.ts` (add list types)
- Modify: `shared/schemas.ts` (add `listValueInputSchema`)
- Create: `server/lists/repo.ts`
- Modify (replace whole file): `server/app.ts`
- Test: `server/db.test.ts` (new), `server/lists/lists.test.ts` (new)

**Interfaces:**
- Consumes: `openDb`, `migrate`, `transaction` (M1); `buildApp(db, opts?)` (M2).
- Produces:
  - `shared/types.ts`:
    - `LIST_NAMES = ['mainProject', 'projectType', 'goal', 'department'] as const`, `type ListName`
    - `interface ListValue { id: number; list: ListName; name: string; order: number }`
    - `type Lists = Record<ListName, ListValue[]>`
  - `shared/schemas.ts`: `listValueInputSchema` (`{ name }`, trimmed, 1–100 chars, empty → "Name is required").
  - `server/db.ts`: `export const MIGRATIONS: string[]`.
  - `server/lists/repo.ts`:
    - `isListName(v: string): v is ListName`
    - `getLists(db): Lists`
    - `getListValue(db, id): ListValue | undefined`
    - `addListValue(db, list, name): { value: ListValue; created: boolean }`
    - `renameListValue(db, list, id, name): ListChange`
    - `deleteListValue(db, list, id): ListChange`
    - `type ListChange = { ok: true; value?: ListValue } | { ok: false; status: 404 | 409; error: string }`
  - HTTP:
    - `GET /api/lists` → `Lists`
    - `POST /api/lists/:list` `{ name }` → 201 new value, or 200 with the existing value of the same name
    - `PUT /api/lists/:list/:id` `{ name }` → 200 value, or 404 / 409
    - `DELETE /api/lists/:list/:id` → 204, or 404 / 409
    - Unknown `:list` → 404 `{ error: 'Unknown list' }`. Invalid body → 400 `{ error: 'Invalid value', issues }`.
    - Error texts: `'Value not found'`, `'"<existing name>" already exists'`, `'"<name>" is used by N project(s)'`. The count uses "project" when N is 1, and "projects" otherwise.

- [ ] **Step 1: Write the failing migration test** `server/db.test.ts`

```ts
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { MIGRATIONS, migrate } from './db';

describe('migrate', () => {
  it('upgrades a version-1 database and keeps its projects', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(MIGRATIONS[0]);
    db.exec('PRAGMA user_version = 1');
    db.prepare(
      "INSERT INTO projects (name, jira_key, color, start_date, created_at) VALUES ('Old', NULL, '#000000', '2026-01-05', 'x')",
    ).run();

    migrate(db);

    const version = db.prepare('PRAGMA user_version').get() as unknown as { user_version: number };
    expect(version.user_version).toBe(MIGRATIONS.length);
    const row = db
      .prepare('SELECT name, priority, background, summary, requester_internal, main_project_id FROM projects')
      .get();
    expect({ ...row }).toEqual({
      name: 'Old', priority: 'medium', background: '', summary: '', requester_internal: 0, main_project_id: null,
    });
  });
});
```

- [ ] **Step 2: Write the failing API test** `server/lists/lists.test.ts`

```ts
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
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run server/db.test.ts server/lists`
Expected: FAIL. `db.test.ts` fails because `MIGRATIONS` is not exported. `lists.test.ts` fails with 404s because `GET /api/lists` does not exist.

- [ ] **Step 4: Add the list types to `shared/types.ts`**

Add this block directly after the two `import` lines, and keep the rest of the file as it is:

```ts
/** The editable dropdown lists (managed in Settings). A main project is just a name, so it is a list too. */
export const LIST_NAMES = ['mainProject', 'projectType', 'goal', 'department'] as const;
export type ListName = (typeof LIST_NAMES)[number];

export interface ListValue {
  id: number;
  list: ListName;
  name: string;
  order: number;
}

export type Lists = Record<ListName, ListValue[]>;
```

- [ ] **Step 5: Add `listValueInputSchema` to `shared/schemas.ts`**

Append at the end of the file:

```ts
export const listValueInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name is too long'),
});
```

- [ ] **Step 6: Export `MIGRATIONS` and append migration 2 in `server/db.ts`**

Change `const MIGRATIONS: string[] = [` to `export const MIGRATIONS: string[] = [`. Then append this second entry to the array, after the existing first migration string (before the closing `];`):

```ts
  `
  CREATE TABLE list_values (
    id INTEGER PRIMARY KEY,
    list TEXT NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL
  );
  CREATE UNIQUE INDEX list_values_name ON list_values(list, name COLLATE NOCASE);
  INSERT INTO list_values (list, name, sort_order) VALUES
    ('projectType', 'Criminal', 0),
    ('projectType', 'Customer', 1),
    ('projectType', 'Management', 2),
    ('goal', 'Digitalisation of internal operations', 0);

  ALTER TABLE projects ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium';
  ALTER TABLE projects ADD COLUMN project_manager TEXT;
  ALTER TABLE projects ADD COLUMN business_owner TEXT;
  ALTER TABLE projects ADD COLUMN main_project_id INTEGER REFERENCES list_values(id);
  ALTER TABLE projects ADD COLUMN category TEXT;
  ALTER TABLE projects ADD COLUMN project_type_id INTEGER REFERENCES list_values(id);
  ALTER TABLE projects ADD COLUMN goal_id INTEGER REFERENCES list_values(id);
  ALTER TABLE projects ADD COLUMN department_id INTEGER REFERENCES list_values(id);
  ALTER TABLE projects ADD COLUMN requester_internal INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE projects ADD COLUMN requester_external INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE projects ADD COLUMN beneficiary_employees INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE projects ADD COLUMN beneficiary_customers INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE projects ADD COLUMN background TEXT NOT NULL DEFAULT '';
  ALTER TABLE projects ADD COLUMN summary TEXT NOT NULL DEFAULT '';

  CREATE TABLE scope_items (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    text TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    date_added TEXT NOT NULL
  );
  CREATE INDEX scope_items_project ON scope_items(project_id);
  `,
```

- [ ] **Step 7: Create `server/lists/repo.ts`**

```ts
import type { DatabaseSync } from 'node:sqlite';
import { LIST_NAMES, type ListName, type ListValue, type Lists } from '../../shared/types';

interface ListRow {
  id: number;
  list: ListName;
  name: string;
  sort_order: number;
}

/** The projects column that points at each list, used to refuse deleting a value that is in use. */
const USAGE_COLUMN: Record<ListName, string> = {
  mainProject: 'main_project_id',
  projectType: 'project_type_id',
  goal: 'goal_id',
  department: 'department_id',
};

export type ListChange = { ok: true; value?: ListValue } | { ok: false; status: 404 | 409; error: string };

function toValue(row: ListRow): ListValue {
  return { id: row.id, list: row.list, name: row.name, order: row.sort_order };
}

function findByName(db: DatabaseSync, list: ListName, name: string): ListRow | undefined {
  return db
    .prepare('SELECT * FROM list_values WHERE list = ? AND name = ? COLLATE NOCASE')
    .get(list, name) as unknown as ListRow | undefined;
}

export function isListName(value: string): value is ListName {
  return (LIST_NAMES as readonly string[]).includes(value);
}

export function getLists(db: DatabaseSync): Lists {
  const lists: Lists = { mainProject: [], projectType: [], goal: [], department: [] };
  const rows = db.prepare('SELECT * FROM list_values ORDER BY sort_order, id').all() as unknown as ListRow[];
  for (const row of rows) lists[row.list].push(toValue(row));
  return lists;
}

export function getListValue(db: DatabaseSync, id: number): ListValue | undefined {
  const row = db.prepare('SELECT * FROM list_values WHERE id = ?').get(id) as unknown as ListRow | undefined;
  return row ? toValue(row) : undefined;
}

/** Adds a value at the end of a list, or returns the existing value with the same name (ignoring case). */
export function addListValue(db: DatabaseSync, list: ListName, name: string): { value: ListValue; created: boolean } {
  const existing = findByName(db, list, name);
  if (existing) return { value: toValue(existing), created: false };
  const { next } = db
    .prepare('SELECT COALESCE(MAX(sort_order) + 1, 0) AS next FROM list_values WHERE list = ?')
    .get(list) as unknown as { next: number };
  const res = db.prepare('INSERT INTO list_values (list, name, sort_order) VALUES (?, ?, ?)').run(list, name, next);
  return { value: getListValue(db, Number(res.lastInsertRowid))!, created: true };
}

export function renameListValue(db: DatabaseSync, list: ListName, id: number, name: string): ListChange {
  const current = getListValue(db, id);
  if (!current || current.list !== list) return { ok: false, status: 404, error: 'Value not found' };
  const clash = findByName(db, list, name);
  if (clash && clash.id !== id) return { ok: false, status: 409, error: `"${clash.name}" already exists` };
  db.prepare('UPDATE list_values SET name = ? WHERE id = ?').run(name, id);
  return { ok: true, value: getListValue(db, id) };
}

export function deleteListValue(db: DatabaseSync, list: ListName, id: number): ListChange {
  const current = getListValue(db, id);
  if (!current || current.list !== list) return { ok: false, status: 404, error: 'Value not found' };
  const { n } = db
    .prepare(`SELECT COUNT(*) AS n FROM projects WHERE ${USAGE_COLUMN[list]} = ?`)
    .get(id) as unknown as { n: number };
  if (n > 0) return { ok: false, status: 409, error: `"${current.name}" is used by ${n} project${n === 1 ? '' : 's'}` };
  db.prepare('DELETE FROM list_values WHERE id = ?').run(id);
  return { ok: true };
}
```

- [ ] **Step 8: Replace `server/app.ts`** (the existing routes are unchanged; the four list routes are new)

```ts
import Fastify from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { todayLocal, type ISODate } from '../shared/calendar';
import { overlapsYear, portfolioStats } from '../shared/portfolio';
import { projectSpan } from '../shared/scheduler';
import { listValueInputSchema, newProjectSchema, toIssues } from '../shared/schemas';
import type { PortfolioResponse } from '../shared/types';
import { addListValue, deleteListValue, getLists, isListName, renameListValue } from './lists/repo';
import { createProject, getProject, listProjects } from './projects/repo';
import { getCalendar } from './settings';

export interface AppOptions {
  /** Injectable clock so tests can fix "today". */
  today?: () => ISODate;
}

export function buildApp(db: DatabaseSync, opts: AppOptions = {}) {
  const today = opts.today ?? todayLocal;
  const app = Fastify();

  app.get('/api/health', async () => ({ ok: true }));

  app.get('/api/settings/calendar', async () => getCalendar(db));

  app.get('/api/lists', async () => getLists(db));

  app.post<{ Params: { list: string } }>('/api/lists/:list', async (req, reply) => {
    if (!isListName(req.params.list)) return reply.code(404).send({ error: 'Unknown list' });
    const parsed = listValueInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid value', issues: toIssues(parsed.error) });
    const { value, created } = addListValue(db, req.params.list, parsed.data.name);
    return reply.code(created ? 201 : 200).send(value);
  });

  app.put<{ Params: { list: string; id: string } }>('/api/lists/:list/:id', async (req, reply) => {
    if (!isListName(req.params.list)) return reply.code(404).send({ error: 'Unknown list' });
    const parsed = listValueInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid value', issues: toIssues(parsed.error) });
    const result = renameListValue(db, req.params.list, Number(req.params.id), parsed.data.name);
    return result.ok ? result.value : reply.code(result.status).send({ error: result.error });
  });

  app.delete<{ Params: { list: string; id: string } }>('/api/lists/:list/:id', async (req, reply) => {
    if (!isListName(req.params.list)) return reply.code(404).send({ error: 'Unknown list' });
    const result = deleteListValue(db, req.params.list, Number(req.params.id));
    return result.ok ? reply.code(204).send() : reply.code(result.status).send({ error: result.error });
  });

  app.get('/api/projects', async () => listProjects(db));

  app.get<{ Params: { id: string } }>('/api/projects/:id', async (req, reply) => {
    const project = getProject(db, Number(req.params.id));
    if (!project) return reply.code(404).send({ error: 'Project not found' });
    return project;
  });

  app.post('/api/projects', async (req, reply) => {
    const parsed = newProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid project', issues: toIssues(parsed.error) });
    }
    return reply.code(201).send(createProject(db, getCalendar(db), parsed.data));
  });

  app.get<{ Querystring: { year?: string } }>('/api/portfolio', async (req, reply) => {
    const now = today();
    const year = req.query.year === undefined ? Number(now.slice(0, 4)) : Number(req.query.year);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return reply.code(400).send({ error: 'year must be a whole number between 2000 and 2100' });
    }
    const all = listProjects(db);
    const inYear = all.filter((p) => {
      const span = projectSpan(p.phases);
      return span !== null && overlapsYear(span, year);
    });
    const body: PortfolioResponse = { year, today: now, stats: portfolioStats(all, year, now), projects: inYear };
    return body;
  });

  return app;
}
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npx vitest run server/db.test.ts server/lists`
Expected: PASS (7 tests).

- [ ] **Step 10: Run the whole suite and the type check**

Run: `npm test` → Expected: PASS (all tests).
Run: `npm run typecheck` → Expected: exit code 0.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: editable dropdown lists with storage and API"
```

---

### Task 2: Project details and scope items — storage and API

**Files:**
- Modify (replace whole file): `shared/types.ts`, `shared/schemas.ts`, `server/projects/repo.ts`, `server/app.ts`
- Modify: `client/testing/mockFetch.ts` (`sampleProject` gains the new fields)
- Modify: `client/gantt/rows.test.ts` (its fixture uses `sampleProject`)
- Test: `server/projects/details.test.ts` (new)

**Interfaces:**
- Consumes: `LIST_NAMES`, `ListName`, `ListValue`, `Lists` (Task 1); `getListValue` (Task 1); `schedulePhases` (M1); `todayLocal`, `ISODate`, `WorkCalendar` (M1).
- Produces:
  - `shared/types.ts`:
    - `interface Ref { id: number; name: string }`
    - `PRIORITIES = ['high', 'medium', 'low'] as const`, `type Priority`
    - `CATEGORIES = ['strategic', 'operational'] as const`, `type Category`
    - `SCOPE_KINDS = ['scope', 'out-of-scope', 'problem', 'objective'] as const`, `type ScopeKind`
    - `interface ScopeItem { id: number; kind: ScopeKind; text: string; order: number; dateAdded: ISODate }`
    - `ProjectRecord` gains:
      - `priority: Priority`, `projectManager: string | null`, `businessOwner: string | null`
      - `mainProject: Ref | null`, `category: Category | null`, `projectType: Ref | null`, `goal: Ref | null`, `department: Ref | null`
      - `requester: { internal: boolean; external: boolean }`, `beneficiary: { employees: boolean; customers: boolean }`
      - `background: string`, `summary: string`, `scopeItems: ScopeItem[]`
    - `scopeItems` are ordered by kind, then by order within the kind.
  - `shared/schemas.ts`:
    - `scopeItemInputSchema` = `{ id?: number; kind; text }`. An empty `text` gives "Item text cannot be empty".
    - `projectDetailsSchema`: every non-schedule field. Every new field has a default, so old callers stay valid.
    - `newProjectSchema = projectDetailsSchema.extend({ startDate, phases })`.
    - Types `ProjectDetailsInput`, `ProjectDetails` (plus the existing `NewProjectInput`, `NewProject`).
  - `server/projects/repo.ts`:
    - `createProject(db, cal, input: NewProject, today?: ISODate)`
    - `updateProjectDetails(db, id, details: ProjectDetails, today?: ISODate): ProjectRecord | undefined`
    - `checkListRefs(db, details: ProjectDetails): ValidationIssue[]`
    - `getProject`, `listProjects` (unchanged signatures)
  - HTTP:
    - `POST /api/projects` accepts the details and returns the full record. A list id that is missing, or that belongs to another list, gives 400 with an issue on that field, e.g. `{ path: 'projectTypeId', message: 'Unknown project type' }`.
    - `PUT /api/projects/:id/details` with `projectDetailsSchema` → 200 full record, 400 on invalid input, or 404 `{ error: 'Project not found' }`. Phases are never changed by this route.
  - Scope item rules for create and update:
    - `order` counts from 0 within each kind, in the order the items are sent.
    - An item sent with the `id` of an item already on this project keeps its `dateAdded`.
    - Items without such an id are new and get today's date.
    - Saved items that are not sent are deleted.

- [ ] **Step 1: Write the failing test** `server/projects/details.test.ts`

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run server/projects/details.test.ts`
Expected: FAIL. The details fields are missing from the response, e.g. `priority` is `undefined`.

- [ ] **Step 3: Replace `shared/types.ts`**

```ts
import type { ISODate } from './calendar';
import type { PortfolioStats } from './portfolio';

/** The editable dropdown lists (managed in Settings). A main project is just a name, so it is a list too. */
export const LIST_NAMES = ['mainProject', 'projectType', 'goal', 'department'] as const;
export type ListName = (typeof LIST_NAMES)[number];

export interface ListValue {
  id: number;
  list: ListName;
  name: string;
  order: number;
}

export type Lists = Record<ListName, ListValue[]>;

/** A reference to a list value, with its name resolved for display. */
export interface Ref {
  id: number;
  name: string;
}

export const PRIORITIES = ['high', 'medium', 'low'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const CATEGORIES = ['strategic', 'operational'] as const;
export type Category = (typeof CATEGORIES)[number];

export const SCOPE_KINDS = ['scope', 'out-of-scope', 'problem', 'objective'] as const;
export type ScopeKind = (typeof SCOPE_KINDS)[number];

export interface ScopeItem {
  id: number;
  kind: ScopeKind;
  text: string;
  /** Position within its kind, from 0. */
  order: number;
  /** When the item was first added; kept across edits (feeds scope-growth views later). */
  dateAdded: ISODate;
}

export interface PhaseRecord {
  id: number;
  name: string;
  order: number;
  durationDays: number;
  start: ISODate;
  end: ISODate;
}

export interface ProjectRecord {
  id: number;
  name: string;
  jiraKey: string | null;
  color: string;
  startDate: ISODate;
  priority: Priority;
  projectManager: string | null;
  businessOwner: string | null;
  mainProject: Ref | null;
  category: Category | null;
  projectType: Ref | null;
  goal: Ref | null;
  department: Ref | null;
  requester: { internal: boolean; external: boolean };
  beneficiary: { employees: boolean; customers: boolean };
  background: string;
  summary: string;
  /** Ordered by kind, then by order within the kind. */
  scopeItems: ScopeItem[];
  phases: PhaseRecord[];
}

export interface PortfolioResponse {
  year: number;
  today: ISODate;
  stats: PortfolioStats;
  projects: ProjectRecord[];
}
```

- [ ] **Step 4: Replace `shared/schemas.ts`**

```ts
import { z } from 'zod';
import { isISODate } from './calendar';
import { CATEGORIES, PRIORITIES, SCOPE_KINDS } from './types';

export const isoDate = z.string().refine(isISODate, 'Must be a valid date (YYYY-MM-DD)');

/** Optional free text: blank becomes null. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

/** Optional reference to a list value. */
const optionalId = z
  .number()
  .int()
  .positive()
  .nullish()
  .transform((v) => v ?? null);

export const phaseInputSchema = z.object({
  name: z.string().trim().min(1, 'Phase name is required').max(200),
  durationDays: z
    .number({ invalid_type_error: 'Duration must be a number' })
    .int('Duration must be a whole number of days')
    .min(1, 'Duration must be at least 1 working day')
    .max(2000, 'Duration is too long'),
});

export const scopeItemInputSchema = z.object({
  /** Sent when editing an item that is already saved, so it keeps its date added. */
  id: z.number().int().positive().optional(),
  kind: z.enum(SCOPE_KINDS),
  text: z.string().trim().min(1, 'Item text cannot be empty').max(2000),
});

/** Everything about a project except its schedule (start date and phases). Used by create and by edit. */
export const projectDetailsSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required').max(200),
  jiraKey: optionalText(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Colour must look like #3b82f6'),
  priority: z.enum(PRIORITIES).default('medium'),
  projectManager: optionalText(200),
  businessOwner: optionalText(200),
  mainProjectId: optionalId,
  category: z
    .enum(CATEGORIES)
    .nullish()
    .transform((v) => v ?? null),
  projectTypeId: optionalId,
  goalId: optionalId,
  departmentId: optionalId,
  requester: z.object({ internal: z.boolean(), external: z.boolean() }).default({ internal: false, external: false }),
  beneficiary: z.object({ employees: z.boolean(), customers: z.boolean() }).default({ employees: false, customers: false }),
  background: z.string().trim().max(10000).default(''),
  summary: z.string().trim().max(10000).default(''),
  scopeItems: z.array(scopeItemInputSchema).max(1000).default([]),
});

export const newProjectSchema = projectDetailsSchema.extend({
  startDate: isoDate,
  phases: z.array(phaseInputSchema).min(1, 'Add at least one phase'),
});

export const listValueInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name is too long'),
});

export type ProjectDetailsInput = z.input<typeof projectDetailsSchema>;
export type ProjectDetails = z.output<typeof projectDetailsSchema>;
export type NewProjectInput = z.input<typeof newProjectSchema>;
export type NewProject = z.output<typeof newProjectSchema>;

export interface ValidationIssue {
  path: string;
  message: string;
}

export function toIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
}
```

- [ ] **Step 5: Replace `server/projects/repo.ts`**

```ts
import type { DatabaseSync } from 'node:sqlite';
import { todayLocal, type ISODate, type WorkCalendar } from '../../shared/calendar';
import type { NewProject, ProjectDetails, ValidationIssue } from '../../shared/schemas';
import { schedulePhases } from '../../shared/scheduler';
import type {
  Category, ListName, PhaseRecord, Priority, ProjectRecord, Ref, ScopeItem, ScopeKind,
} from '../../shared/types';
import { transaction } from '../db';
import { getListValue } from '../lists/repo';

interface ProjectRow {
  id: number;
  name: string;
  jira_key: string | null;
  color: string;
  start_date: string;
  priority: Priority;
  project_manager: string | null;
  business_owner: string | null;
  main_project_id: number | null;
  category: Category | null;
  project_type_id: number | null;
  goal_id: number | null;
  department_id: number | null;
  requester_internal: number;
  requester_external: number;
  beneficiary_employees: number;
  beneficiary_customers: number;
  background: string;
  summary: string;
}

interface PhaseRow {
  id: number;
  project_id: number;
  name: string;
  sort_order: number;
  duration_days: number;
  planned_start: string;
  planned_end: string;
}

interface ScopeRow {
  id: number;
  project_id: number;
  kind: ScopeKind;
  text: string;
  sort_order: number;
  date_added: string;
}

/** Columns written from ProjectDetails, in the same order as detailValues(). */
const DETAIL_COLUMNS = [
  'name', 'jira_key', 'color', 'priority', 'project_manager', 'business_owner', 'main_project_id', 'category',
  'project_type_id', 'goal_id', 'department_id', 'requester_internal', 'requester_external',
  'beneficiary_employees', 'beneficiary_customers', 'background', 'summary',
];

function detailValues(d: ProjectDetails) {
  return [
    d.name, d.jiraKey, d.color, d.priority, d.projectManager, d.businessOwner, d.mainProjectId, d.category,
    d.projectTypeId, d.goalId, d.departmentId, d.requester.internal ? 1 : 0, d.requester.external ? 1 : 0,
    d.beneficiary.employees ? 1 : 0, d.beneficiary.customers ? 1 : 0, d.background, d.summary,
  ];
}

const LIST_REFS: { field: 'mainProjectId' | 'projectTypeId' | 'goalId' | 'departmentId'; list: ListName; label: string }[] = [
  { field: 'mainProjectId', list: 'mainProject', label: 'main project' },
  { field: 'projectTypeId', list: 'projectType', label: 'project type' },
  { field: 'goalId', list: 'goal', label: 'goal' },
  { field: 'departmentId', list: 'department', label: 'business user (department)' },
];

/** Every chosen list value must exist and belong to the right list. */
export function checkListRefs(db: DatabaseSync, details: ProjectDetails): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const { field, list, label } of LIST_REFS) {
    const id = details[field];
    if (id === null) continue;
    if (getListValue(db, id)?.list !== list) issues.push({ path: field, message: `Unknown ${label}` });
  }
  return issues;
}

function toPhase(row: PhaseRow): PhaseRecord {
  return {
    id: row.id,
    name: row.name,
    order: row.sort_order,
    durationDays: row.duration_days,
    start: row.planned_start,
    end: row.planned_end,
  };
}

function toScopeItem(row: ScopeRow): ScopeItem {
  return { id: row.id, kind: row.kind, text: row.text, order: row.sort_order, dateAdded: row.date_added };
}

function listNames(db: DatabaseSync): Map<number, string> {
  const rows = db.prepare('SELECT id, name FROM list_values').all() as unknown as { id: number; name: string }[];
  return new Map(rows.map((r) => [r.id, r.name]));
}

function ref(names: Map<number, string>, id: number | null): Ref | null {
  if (id === null) return null;
  const name = names.get(id);
  return name === undefined ? null : { id, name };
}

function toProject(row: ProjectRow, phases: PhaseRecord[], scopeItems: ScopeItem[], names: Map<number, string>): ProjectRecord {
  return {
    id: row.id,
    name: row.name,
    jiraKey: row.jira_key,
    color: row.color,
    startDate: row.start_date,
    priority: row.priority,
    projectManager: row.project_manager,
    businessOwner: row.business_owner,
    mainProject: ref(names, row.main_project_id),
    category: row.category,
    projectType: ref(names, row.project_type_id),
    goal: ref(names, row.goal_id),
    department: ref(names, row.department_id),
    requester: { internal: row.requester_internal === 1, external: row.requester_external === 1 },
    beneficiary: { employees: row.beneficiary_employees === 1, customers: row.beneficiary_customers === 1 },
    background: row.background,
    summary: row.summary,
    scopeItems,
    phases,
  };
}

/**
 * Makes the project's scope items match `items`. An item whose id is already saved on this project is updated and
 * keeps its date added; any other item is inserted with `today`; saved items that are not in `items` are deleted.
 * Order counts from 0 within each kind, in the order given.
 */
function saveScopeItems(db: DatabaseSync, projectId: number, items: ProjectDetails['scopeItems'], today: ISODate): void {
  const saved = (db.prepare('SELECT id FROM scope_items WHERE project_id = ?').all(projectId) as unknown as { id: number }[])
    .map((r) => r.id);
  const kept = new Set(items.map((i) => i.id).filter((id): id is number => id !== undefined && saved.includes(id)));
  const remove = db.prepare('DELETE FROM scope_items WHERE id = ?');
  for (const id of saved) if (!kept.has(id)) remove.run(id);

  const update = db.prepare('UPDATE scope_items SET kind = ?, text = ?, sort_order = ? WHERE id = ?');
  const insert = db.prepare(
    'INSERT INTO scope_items (project_id, kind, text, sort_order, date_added) VALUES (?, ?, ?, ?, ?)',
  );
  const nextOrder = new Map<ScopeKind, number>();
  for (const item of items) {
    const order = nextOrder.get(item.kind) ?? 0;
    nextOrder.set(item.kind, order + 1);
    // kept.delete() is true only the first time an id is seen, so a repeated id is saved as a new item.
    if (item.id !== undefined && kept.delete(item.id)) update.run(item.kind, item.text, order, item.id);
    else insert.run(projectId, item.kind, item.text, order, today);
  }
}

export function createProject(db: DatabaseSync, cal: WorkCalendar, input: NewProject, today: ISODate = todayLocal()): ProjectRecord {
  const scheduled = schedulePhases(input.startDate, input.phases, cal);
  const id = transaction(db, () => {
    const columns = [...DETAIL_COLUMNS, 'start_date', 'created_at'];
    const res = db
      .prepare(`INSERT INTO projects (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`)
      .run(...detailValues(input), input.startDate, new Date().toISOString());
    const projectId = Number(res.lastInsertRowid);
    const insertPhase = db.prepare(
      'INSERT INTO phases (project_id, name, sort_order, duration_days, planned_start, planned_end) VALUES (?, ?, ?, ?, ?, ?)',
    );
    for (const p of scheduled) insertPhase.run(projectId, p.name, p.order, p.durationDays, p.start, p.end);
    saveScopeItems(db, projectId, input.scopeItems, today);
    return projectId;
  });
  return getProject(db, id)!;
}

/** Changes everything except the schedule. Returns undefined when the project does not exist. */
export function updateProjectDetails(
  db: DatabaseSync, id: number, details: ProjectDetails, today: ISODate = todayLocal(),
): ProjectRecord | undefined {
  if (!db.prepare('SELECT id FROM projects WHERE id = ?').get(id)) return undefined;
  transaction(db, () => {
    const sets = DETAIL_COLUMNS.map((c) => `${c} = ?`).join(', ');
    db.prepare(`UPDATE projects SET ${sets} WHERE id = ?`).run(...detailValues(details), id);
    saveScopeItems(db, id, details.scopeItems, today);
  });
  return getProject(db, id);
}

export function getProject(db: DatabaseSync, id: number): ProjectRecord | undefined {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as unknown as ProjectRow | undefined;
  if (!row) return undefined;
  const phases = db
    .prepare('SELECT * FROM phases WHERE project_id = ? ORDER BY sort_order')
    .all(id) as unknown as PhaseRow[];
  const scope = db
    .prepare('SELECT * FROM scope_items WHERE project_id = ? ORDER BY kind, sort_order')
    .all(id) as unknown as ScopeRow[];
  return toProject(row, phases.map(toPhase), scope.map(toScopeItem), listNames(db));
}

function byProject<R extends { project_id: number }, T>(rows: R[], map: (row: R) => T): Map<number, T[]> {
  const grouped = new Map<number, T[]>();
  for (const row of rows) {
    const list = grouped.get(row.project_id) ?? [];
    list.push(map(row));
    grouped.set(row.project_id, list);
  }
  return grouped;
}

export function listProjects(db: DatabaseSync): ProjectRecord[] {
  const rows = db.prepare('SELECT * FROM projects ORDER BY start_date, id').all() as unknown as ProjectRow[];
  const phases = byProject(
    db.prepare('SELECT * FROM phases ORDER BY project_id, sort_order').all() as unknown as PhaseRow[],
    toPhase,
  );
  const scope = byProject(
    db.prepare('SELECT * FROM scope_items ORDER BY project_id, kind, sort_order').all() as unknown as ScopeRow[],
    toScopeItem,
  );
  const names = listNames(db);
  return rows.map((r) => toProject(r, phases.get(r.id) ?? [], scope.get(r.id) ?? [], names));
}
```

- [ ] **Step 6: Replace `server/app.ts`** (the same as Task 1, plus the list-reference check on create and the new `PUT` route)

```ts
import Fastify from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { todayLocal, type ISODate } from '../shared/calendar';
import { overlapsYear, portfolioStats } from '../shared/portfolio';
import { projectSpan } from '../shared/scheduler';
import { listValueInputSchema, newProjectSchema, projectDetailsSchema, toIssues } from '../shared/schemas';
import type { PortfolioResponse } from '../shared/types';
import { addListValue, deleteListValue, getLists, isListName, renameListValue } from './lists/repo';
import { checkListRefs, createProject, getProject, listProjects, updateProjectDetails } from './projects/repo';
import { getCalendar } from './settings';

export interface AppOptions {
  /** Injectable clock so tests can fix "today". */
  today?: () => ISODate;
}

export function buildApp(db: DatabaseSync, opts: AppOptions = {}) {
  const today = opts.today ?? todayLocal;
  const app = Fastify();

  app.get('/api/health', async () => ({ ok: true }));

  app.get('/api/settings/calendar', async () => getCalendar(db));

  app.get('/api/lists', async () => getLists(db));

  app.post<{ Params: { list: string } }>('/api/lists/:list', async (req, reply) => {
    if (!isListName(req.params.list)) return reply.code(404).send({ error: 'Unknown list' });
    const parsed = listValueInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid value', issues: toIssues(parsed.error) });
    const { value, created } = addListValue(db, req.params.list, parsed.data.name);
    return reply.code(created ? 201 : 200).send(value);
  });

  app.put<{ Params: { list: string; id: string } }>('/api/lists/:list/:id', async (req, reply) => {
    if (!isListName(req.params.list)) return reply.code(404).send({ error: 'Unknown list' });
    const parsed = listValueInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid value', issues: toIssues(parsed.error) });
    const result = renameListValue(db, req.params.list, Number(req.params.id), parsed.data.name);
    return result.ok ? result.value : reply.code(result.status).send({ error: result.error });
  });

  app.delete<{ Params: { list: string; id: string } }>('/api/lists/:list/:id', async (req, reply) => {
    if (!isListName(req.params.list)) return reply.code(404).send({ error: 'Unknown list' });
    const result = deleteListValue(db, req.params.list, Number(req.params.id));
    return result.ok ? reply.code(204).send() : reply.code(result.status).send({ error: result.error });
  });

  app.get('/api/projects', async () => listProjects(db));

  app.get<{ Params: { id: string } }>('/api/projects/:id', async (req, reply) => {
    const project = getProject(db, Number(req.params.id));
    if (!project) return reply.code(404).send({ error: 'Project not found' });
    return project;
  });

  app.post('/api/projects', async (req, reply) => {
    const parsed = newProjectSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid project', issues: toIssues(parsed.error) });
    const issues = checkListRefs(db, parsed.data);
    if (issues.length > 0) return reply.code(400).send({ error: 'Invalid project', issues });
    return reply.code(201).send(createProject(db, getCalendar(db), parsed.data, today()));
  });

  app.put<{ Params: { id: string } }>('/api/projects/:id/details', async (req, reply) => {
    const parsed = projectDetailsSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid project', issues: toIssues(parsed.error) });
    const issues = checkListRefs(db, parsed.data);
    if (issues.length > 0) return reply.code(400).send({ error: 'Invalid project', issues });
    const project = updateProjectDetails(db, Number(req.params.id), parsed.data, today());
    if (!project) return reply.code(404).send({ error: 'Project not found' });
    return project;
  });

  app.get<{ Querystring: { year?: string } }>('/api/portfolio', async (req, reply) => {
    const now = today();
    const year = req.query.year === undefined ? Number(now.slice(0, 4)) : Number(req.query.year);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return reply.code(400).send({ error: 'year must be a whole number between 2000 and 2100' });
    }
    const all = listProjects(db);
    const inYear = all.filter((p) => {
      const span = projectSpan(p.phases);
      return span !== null && overlapsYear(span, year);
    });
    const body: PortfolioResponse = { year, today: now, stats: portfolioStats(all, year, now), projects: inYear };
    return body;
  });

  return app;
}
```

- [ ] **Step 7: Update the client fixtures for the new `ProjectRecord` fields**

In `client/testing/mockFetch.ts`, replace the `sampleProject` function with:

```ts
export function sampleProject(overrides: Partial<ProjectRecord> = {}): ProjectRecord {
  return {
    id: 1,
    name: 'Portal',
    jiraKey: 'PRJ-1',
    color: '#3b82f6',
    startDate: '2026-09-24',
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
    phases: [
      { id: 11, name: 'Requirements', order: 0, durationDays: 2, start: '2026-09-24', end: '2026-09-25' },
      { id: 12, name: 'Development', order: 1, durationDays: 3, start: '2026-09-28', end: '2026-09-30' },
    ],
    ...overrides,
  };
}
```

In `client/gantt/rows.test.ts`:
- Replace the import `import type { ProjectRecord } from '../../shared/types';` with `import { sampleProject } from '../testing/mockFetch';`.
- Replace the `const project: ProjectRecord = { ... };` literal with:

```ts
const project = sampleProject({
  id: 1, name: 'Portal', jiraKey: null, startDate: '2026-02-10',
  phases: [
    { id: 11, name: 'Requirements', order: 0, durationDays: 2, start: '2026-02-10', end: '2026-02-11' },
    { id: 12, name: 'Development', order: 1, durationDays: 30, start: '2026-02-12', end: '2026-03-25' },
  ],
});
```

- [ ] **Step 8: Run the new test to verify it passes**

Run: `npx vitest run server/projects`
Expected: PASS (the 6 new tests plus the existing `projects.test.ts`).

- [ ] **Step 9: Run the whole suite and the type check**

Run: `npm test` → Expected: PASS (all tests).
Run: `npm run typecheck` → Expected: exit code 0.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: project classification, description and scope items in storage and API"
```

---

### Task 3: Client plumbing — API calls, reorder hook, lists hook

This task builds the pieces the M3 screens share. `useReorder` takes over from the drag-and-drop and keyboard code inside `CreateProjectPage.tsx`, and behaves the same. The old copy in that page is deleted in Task 5, when the page is rewritten, so leave `CreateProjectPage.tsx` alone in this task.

**Files:**
- Modify (replace whole file): `client/api.ts`, `client/testing/mockFetch.ts`
- Modify: `client/icons.tsx` (add `GripIcon`)
- Create: `client/useReorder.ts`, `client/useLists.ts`
- Test: `client/api.test.ts` (new), `client/useReorder.test.tsx` (new)

**Interfaces:**
- Consumes: `Lists`, `ListName`, `ListValue`, `LIST_NAMES`, `ProjectRecord` (Tasks 1–2); `ProjectDetailsInput` (Task 2); `useAsync` (M1).
- Produces:
  - `api` additions:
    - `getLists(): Promise<Lists>`
    - `addListValue(list, name): Promise<ListValue>`
    - `renameListValue(list, id, name): Promise<ListValue>`
    - `deleteListValue(list, id): Promise<void>`
    - `updateProjectDetails(id, input: ProjectDetailsInput): Promise<ProjectRecord>`
  - `request()` sends `Content-Type: application/json` only when there is a body. Fastify rejects an empty body declared as JSON, which would break `DELETE`.
  - `mockFetch`: a handler returning `status: 204` gets a Response with no body. Adds `sampleLists(): Lists` with these ids:
    - mainProject `20` "Digital Services"
    - projectType `1` Criminal, `2` Customer, `3` Management
    - goal `4` "Digitalisation of internal operations"
    - department `30` "Finance"
  - `useReorder.ts`:
    - `moveItem<T>(list: T[], from: number, to: number): T[]` is pure. It returns the same array when the move is a no-op or out of range.
    - `useReorder(count, move): { handleProps(index, label), rowProps(index) }`:
      - `handleProps` goes on the row's `<button>` handle. It gives the class `drag-handle`, `aria-label`, `draggable`, `onDragStart` (sets `dataTransfer`), `onKeyDown` (ArrowUp/ArrowDown, with focus following the moved row) and a ref.
      - `rowProps` goes on the row. It gives `onDragOver`, `onDrop` and `onDragEnd`. Drops are only accepted while a drag started on one of this list's handles.
  - `icons.tsx`: `GripIcon()`, a six-dot drag grip.
  - `useLists(): { lists: Lists; error?: Error; remember(value: ListValue): void }`. `remember` makes a value created inline show up right away, without reloading.

- [ ] **Step 1: Write the failing API test** `client/api.test.ts`

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ApiError, api } from './api';
import { mockFetch } from './testing/mockFetch';

describe('api', () => {
  it('sends JSON with a content type when there is a body', async () => {
    const fetchMock = mockFetch({
      'POST /api/lists/goal': () => ({ status: 201, body: { id: 9, list: 'goal', name: 'Speed', order: 1 } }),
    });
    expect(await api.addListValue('goal', 'Speed')).toEqual({ id: 9, list: 'goal', name: 'Speed', order: 1 });
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.body).toBe(JSON.stringify({ name: 'Speed' }));
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('sends a bodiless DELETE without a JSON content type and accepts an empty 204', async () => {
    const fetchMock = mockFetch({ 'DELETE /api/lists/goal/9': () => ({ status: 204, body: null }) });
    await expect(api.deleteListValue('goal', 9)).resolves.toEqual({});
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.headers).toBeUndefined();
  });

  it('turns an error response into an ApiError with the server message', async () => {
    mockFetch({ 'DELETE /api/lists/goal/4': () => ({ status: 409, body: { error: '"Speed" is used by 2 projects' } }) });
    await expect(api.deleteListValue('goal', 4)).rejects.toThrow(new ApiError('"Speed" is used by 2 projects', 409));
  });

  it('saves project details with PUT', async () => {
    const fetchMock = mockFetch({ 'PUT /api/projects/3/details': () => ({ body: { id: 3 } }) });
    await api.updateProjectDetails(3, { name: 'X', color: '#000000' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/projects/3/details');
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(init?.body as string)).toEqual({ name: 'X', color: '#000000' });
  });
});
```

- [ ] **Step 2: Write the failing hook test** `client/useReorder.test.tsx`

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { moveItem, useReorder } from './useReorder';

function Harness() {
  const [items, setItems] = useState(['A', 'B', 'C']);
  const { handleProps, rowProps } = useReorder(items.length, (from, to) => setItems((list) => moveItem(list, from, to)));
  return (
    <ul>
      {items.map((item, i) => (
        <li key={i} data-testid={`row-${i}`} {...rowProps(i)}>
          <button {...handleProps(i, `Move ${item}`)}>≡</button>
          {item}
        </li>
      ))}
    </ul>
  );
}

const order = () => screen.getAllByRole('listitem').map((li) => li.textContent?.replace('≡', ''));
const dataTransfer = { setData: () => {}, getData: () => '', effectAllowed: '' };

describe('moveItem', () => {
  it('moves an item without changing the original list', () => {
    const list = ['A', 'B', 'C'];
    expect(moveItem(list, 0, 2)).toEqual(['B', 'C', 'A']);
    expect(moveItem(list, 2, 0)).toEqual(['C', 'A', 'B']);
    expect(list).toEqual(['A', 'B', 'C']);
  });

  it('returns the same list for a no-op or out-of-range move', () => {
    const list = ['A', 'B'];
    expect(moveItem(list, 0, 0)).toBe(list);
    expect(moveItem(list, 0, 5)).toBe(list);
    expect(moveItem(list, -1, 1)).toBe(list);
  });
});

describe('useReorder', () => {
  it('moves a row dragged by its handle onto another row', () => {
    render(<Harness />);
    fireEvent.dragStart(screen.getByLabelText('Move C'), { dataTransfer });
    fireEvent.dragOver(screen.getByTestId('row-0'), { dataTransfer });
    fireEvent.drop(screen.getByTestId('row-0'), { dataTransfer });
    expect(order()).toEqual(['C', 'A', 'B']);
  });

  it('refuses drops that did not start on one of its handles', () => {
    render(<Harness />);
    const row = screen.getByTestId('row-0');
    // fireEvent returns false only when the handler called preventDefault(), i.e. accepted the drop.
    expect(fireEvent.dragOver(row, { dataTransfer })).toBe(true);
    fireEvent.drop(row, { dataTransfer });
    expect(order()).toEqual(['A', 'B', 'C']);
  });

  it('forgets a cancelled drag', () => {
    render(<Harness />);
    const handle = screen.getByLabelText('Move C');
    fireEvent.dragStart(handle, { dataTransfer });
    fireEvent.dragEnd(handle, { dataTransfer });
    fireEvent.drop(screen.getByTestId('row-0'), { dataTransfer });
    expect(order()).toEqual(['A', 'B', 'C']);
  });

  it('moves with ArrowUp/ArrowDown, keeps focus on the moved row and stops at the ends', () => {
    render(<Harness />);
    const handleB = screen.getByLabelText('Move B');
    handleB.focus();
    fireEvent.keyDown(handleB, { key: 'ArrowDown' });
    expect(order()).toEqual(['A', 'C', 'B']);
    expect(screen.getByLabelText('Move B')).toHaveFocus();

    fireEvent.keyDown(screen.getByLabelText('Move B'), { key: 'ArrowDown' });
    expect(order()).toEqual(['A', 'C', 'B']);
    fireEvent.keyDown(screen.getByLabelText('Move A'), { key: 'ArrowUp' });
    expect(order()).toEqual(['A', 'C', 'B']);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run client/api.test.ts client/useReorder.test.tsx`
Expected: FAIL. The api test fails with "api.addListValue is not a function". The hook test fails with "Failed to resolve import './useReorder'".

- [ ] **Step 4: Replace `client/api.ts`**

```ts
import type { WorkCalendar } from '../shared/calendar';
import type { NewProjectInput, ProjectDetailsInput, ValidationIssue } from '../shared/schemas';
import type { ListName, ListValue, Lists, PortfolioResponse, ProjectRecord } from '../shared/types';

export class ApiError extends Error {
  status: number;
  issues: ValidationIssue[];
  constructor(message: string, status: number, issues: ValidationIssue[] = []) {
    super(message);
    this.status = status;
    this.issues = issues;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Only declare JSON when there is a body: Fastify rejects an empty body sent as application/json.
  const headers = init?.body === undefined ? init?.headers : { 'Content-Type': 'application/json', ...init?.headers };
  const res = await fetch(path, { ...init, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? `Request failed (${res.status})`, res.status, body.issues ?? []);
  return body as T;
}

const withBody = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export const api = {
  getCalendar: () => request<WorkCalendar>('/api/settings/calendar'),
  listProjects: () => request<ProjectRecord[]>('/api/projects'),
  getProject: (id: number) => request<ProjectRecord>(`/api/projects/${id}`),
  createProject: (input: NewProjectInput) => request<ProjectRecord>('/api/projects', withBody('POST', input)),
  updateProjectDetails: (id: number, input: ProjectDetailsInput) =>
    request<ProjectRecord>(`/api/projects/${id}/details`, withBody('PUT', input)),
  getPortfolio: (year: number) => request<PortfolioResponse>(`/api/portfolio?year=${year}`),
  getLists: () => request<Lists>('/api/lists'),
  addListValue: (list: ListName, name: string) => request<ListValue>(`/api/lists/${list}`, withBody('POST', { name })),
  renameListValue: (list: ListName, id: number, name: string) =>
    request<ListValue>(`/api/lists/${list}/${id}`, withBody('PUT', { name })),
  deleteListValue: (list: ListName, id: number) => request<void>(`/api/lists/${list}/${id}`, { method: 'DELETE' }),
};
```

- [ ] **Step 5: Replace `client/testing/mockFetch.ts`**

```ts
import { vi } from 'vitest';
import type { Lists, ProjectRecord } from '../../shared/types';

export type MockHandler = (init?: RequestInit) => { status?: number; body: unknown };

/** Stubs global fetch. Keys look like "GET /api/projects". Unmatched calls return 500. */
export function mockFetch(routes: Record<string, MockHandler>) {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method ?? 'GET';
    const handler = routes[`${method} ${url}`];
    if (!handler) {
      return new Response(JSON.stringify({ error: `No mock for ${method} ${url}` }), { status: 500 });
    }
    const { status = 200, body } = handler(init);
    // A 204 response must not have a body.
    return new Response(status === 204 ? null : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

export function sampleProject(overrides: Partial<ProjectRecord> = {}): ProjectRecord {
  return {
    id: 1,
    name: 'Portal',
    jiraKey: 'PRJ-1',
    color: '#3b82f6',
    startDate: '2026-09-24',
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
    phases: [
      { id: 11, name: 'Requirements', order: 0, durationDays: 2, start: '2026-09-24', end: '2026-09-25' },
      { id: 12, name: 'Development', order: 1, durationDays: 3, start: '2026-09-28', end: '2026-09-30' },
    ],
    ...overrides,
  };
}

export function sampleLists(): Lists {
  return {
    mainProject: [{ id: 20, list: 'mainProject', name: 'Digital Services', order: 0 }],
    projectType: [
      { id: 1, list: 'projectType', name: 'Criminal', order: 0 },
      { id: 2, list: 'projectType', name: 'Customer', order: 1 },
      { id: 3, list: 'projectType', name: 'Management', order: 2 },
    ],
    goal: [{ id: 4, list: 'goal', name: 'Digitalisation of internal operations', order: 0 }],
    department: [{ id: 30, list: 'department', name: 'Finance', order: 0 }],
  };
}
```

- [ ] **Step 6: Add `GripIcon` to `client/icons.tsx`** (append at the end of the file)

```tsx
export function GripIcon() {
  return (
    <svg {...base} fill="currentColor" stroke="none">
      <circle cx="9" cy="6" r="1.3" />
      <circle cx="9" cy="12" r="1.3" />
      <circle cx="9" cy="18" r="1.3" />
      <circle cx="15" cy="6" r="1.3" />
      <circle cx="15" cy="12" r="1.3" />
      <circle cx="15" cy="18" r="1.3" />
    </svg>
  );
}
```

- [ ] **Step 7: Create `client/useReorder.ts`**

```ts
import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';

/** Returns a copy of `list` with the item at `from` moved to `to`, or `list` itself when there is nothing to do. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * Drag-and-drop plus ArrowUp/ArrowDown reordering for a list of rows.
 *
 * Spread `rowProps(i)` on each row (the drop target) and `handleProps(i, label)` on the row's drag-handle `<button>`.
 * Only the handle is draggable, so text inputs inside the row keep normal clicking and text selection.
 * Each list gets its own hook, and a list only accepts drops that started on one of its own handles.
 */
export function useReorder(count: number, move: (from: number, to: number) => void) {
  const dragIndex = useRef<number | null>(null);
  const handles = useRef<(HTMLButtonElement | null)[]>([]);
  const [pendingFocus, setPendingFocus] = useState<number | null>(null);

  // After a keyboard move, the moved item has re-rendered at its new index: put focus back on its handle.
  useEffect(() => {
    if (pendingFocus === null) return;
    handles.current[pendingFocus]?.focus();
    setPendingFocus(null);
  }, [pendingFocus]);

  function handleProps(index: number, label: string) {
    return {
      type: 'button' as const,
      className: 'drag-handle',
      'aria-label': label,
      draggable: true,
      ref: (el: HTMLButtonElement | null) => {
        handles.current[index] = el;
      },
      onDragStart: (e: DragEvent<HTMLButtonElement>) => {
        dragIndex.current = index;
        // Firefox will not start a drag unless some data is set.
        e.dataTransfer.setData('text/plain', String(index));
        e.dataTransfer.effectAllowed = 'move';
      },
      onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => {
        const to = e.key === 'ArrowUp' ? index - 1 : e.key === 'ArrowDown' ? index + 1 : null;
        if (to === null) return;
        e.preventDefault();
        if (to < 0 || to >= count) return;
        move(index, to);
        setPendingFocus(to);
      },
    };
  }

  function rowProps(index: number) {
    return {
      onDragOver: (e: DragEvent<HTMLElement>) => {
        if (dragIndex.current !== null) e.preventDefault();
      },
      onDrop: (e: DragEvent<HTMLElement>) => {
        e.preventDefault();
        const from = dragIndex.current;
        dragIndex.current = null;
        if (from !== null) move(from, index);
      },
      onDragEnd: () => {
        dragIndex.current = null;
      },
    };
  }

  return { handleProps, rowProps };
}
```

- [ ] **Step 8: Create `client/useLists.ts`**

```ts
import { useCallback, useMemo, useState } from 'react';
import type { ListValue, Lists } from '../shared/types';
import { api } from './api';
import { useAsync } from './useAsync';

const EMPTY: Lists = { mainProject: [], projectType: [], goal: [], department: [] };

/** Loads the dropdown lists. `remember` adds a value that was just created inline, so it shows without a reload. */
export function useLists() {
  const loaded = useAsync(() => api.getLists(), []);
  const [added, setAdded] = useState<ListValue[]>([]);

  const lists = useMemo(() => {
    const merged: Lists = { ...(loaded.data ?? EMPTY) };
    for (const value of added) {
      if (!merged[value.list].some((v) => v.id === value.id)) merged[value.list] = [...merged[value.list], value];
    }
    return merged;
  }, [loaded.data, added]);

  const remember = useCallback((value: ListValue) => setAdded((list) => [...list, value]), []);

  return { lists, error: loaded.error, remember };
}
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npx vitest run client/api.test.ts client/useReorder.test.tsx`
Expected: PASS (10 tests).

- [ ] **Step 10: Run the whole suite and the type check**

Run: `npm test` → Expected: PASS (all tests).
Run: `npm run typecheck` → Expected: exit code 0.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: client API for lists and details, shared reorder and lists hooks"
```

---

### Task 4: Reusable form components — ItemTable and OptionPicker

**Files:**
- Create: `client/components/ItemTable.tsx`, `client/components/OptionPicker.tsx`
- Modify: `client/styles.css`
- Test: `client/components/ItemTable.test.tsx`, `client/components/OptionPicker.test.tsx`

**Interfaces:**
- Consumes: `useReorder`, `moveItem`, `GripIcon` (Task 3); `api.addListValue` (Task 3); `ListName`, `ListValue` (Task 1); `PlusIcon`, `TrashIcon` (M1).
- Produces:
  - `ItemTable.tsx`:
    - `interface DraftItem { id?: number; text: string }`
    - `ItemTable({ title, noun, items, onChange })`
      - Each row has:
        - a drag handle `aria-label="Reorder <noun lower-case> N"`;
        - a number "N.";
        - a text input `aria-label="<noun> N"`;
        - a remove button `aria-label="Remove <noun lower-case> N"`.
      - Below the rows is an input `aria-label="New <noun lower-case>"` and a button `aria-label="Add <noun lower-case>"`. Enter in the input also adds, and blank text is ignored.
      - When a row is edited, its `id` is kept.
  - `OptionPicker.tsx`: `OptionPicker({ label, list, options, value, onChange, onAdded, noneLabel, addLabel })`.
    - It shows a `<select>` labelled `label`. The first option is `noneLabel` (value null), then the values, then `addLabel`.
    - Choosing `addLabel` swaps in an input `aria-label="New <label lower-case>"` with **Add** and **Cancel** buttons.
    - **Add** calls `api.addListValue(list, name)`, then `onAdded(value)` and `onChange(value.id)`. A server error shows with `role="alert"`.
  - CSS:
    - `select` and `textarea` share the `input` look.
    - New classes: `.item-table`, `.item-list`, `.item-row`, `.item-number`, `.item-empty`, `.item-add`, `.option-add`, `.option-add-actions`, `.field-error`.

- [ ] **Step 1: Write the failing test** `client/components/ItemTable.test.tsx`

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ItemTable, type DraftItem } from './ItemTable';

function Harness({ initial = [], spy }: { initial?: DraftItem[]; spy?: (items: DraftItem[]) => void }) {
  const [items, setItems] = useState<DraftItem[]>(initial);
  return (
    <ItemTable
      title="Objectives"
      noun="Objective"
      items={items}
      onChange={(next) => {
        spy?.(next);
        setItems(next);
      }}
    />
  );
}

describe('ItemTable', () => {
  it('adds numbered items with the Add button or Enter, ignoring blank text', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByText('None yet.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('New objective'), 'Faster checkout');
    await user.click(screen.getByRole('button', { name: 'Add objective' }));
    await user.type(screen.getByLabelText('New objective'), 'Fewer calls{Enter}');
    await user.type(screen.getByLabelText('New objective'), '   {Enter}');

    expect(screen.getByLabelText('Objective 1')).toHaveValue('Faster checkout');
    expect(screen.getByLabelText('Objective 2')).toHaveValue('Fewer calls');
    expect(screen.queryByLabelText('Objective 3')).toBeNull();
    expect(screen.getByText('2.')).toBeInTheDocument();
    expect(screen.getByLabelText('New objective')).toHaveValue('');
  });

  it('edits a row in place, keeping its id, and removes a row', async () => {
    const spy = vi.fn();
    const user = userEvent.setup();
    render(<Harness initial={[{ id: 7, text: 'Old' }, { text: 'Other' }]} spy={spy} />);

    await user.type(screen.getByLabelText('Objective 1'), '!');
    expect(spy).toHaveBeenLastCalledWith([{ id: 7, text: 'Old!' }, { text: 'Other' }]);

    await user.click(screen.getByRole('button', { name: 'Remove objective 1' }));
    expect(screen.getByLabelText('Objective 1')).toHaveValue('Other');
    expect(screen.queryByLabelText('Objective 2')).toBeNull();
  });

  it('reorders rows by dragging the handle or with the arrow keys', () => {
    render(<Harness initial={[{ text: 'A' }, { text: 'B' }, { text: 'C' }]} />);
    const dataTransfer = { setData: () => {}, getData: () => '', effectAllowed: '' };
    const firstRow = screen.getByLabelText('Objective 1').closest('li')!;

    fireEvent.dragStart(screen.getByLabelText('Reorder objective 3'), { dataTransfer });
    fireEvent.dragOver(firstRow, { dataTransfer });
    fireEvent.drop(firstRow, { dataTransfer });
    expect(screen.getByLabelText('Objective 1')).toHaveValue('C');

    fireEvent.keyDown(screen.getByLabelText('Reorder objective 1'), { key: 'ArrowDown' });
    expect(screen.getByLabelText('Objective 1')).toHaveValue('A');
    expect(screen.getByLabelText('Objective 2')).toHaveValue('C');
  });
});
```

- [ ] **Step 2: Write the failing test** `client/components/OptionPicker.test.tsx`

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ListValue } from '../../shared/types';
import { mockFetch, sampleLists } from '../testing/mockFetch';
import { OptionPicker } from './OptionPicker';

function Harness({ onChange }: { onChange?: (id: number | null) => void }) {
  const [options, setOptions] = useState<ListValue[]>(sampleLists().department);
  const [value, setValue] = useState<number | null>(null);
  return (
    <OptionPicker
      label="Business user (department)"
      list="department"
      options={options}
      value={value}
      onChange={(id) => {
        onChange?.(id);
        setValue(id);
      }}
      onAdded={(v) => setOptions((list) => [...list, v])}
      noneLabel="Not set"
      addLabel="+ Add new department…"
    />
  );
}

describe('OptionPicker', () => {
  it('reports the chosen value, and null for the empty choice', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);
    const select = screen.getByLabelText('Business user (department)');

    await user.selectOptions(select, 'Finance');
    expect(onChange).toHaveBeenLastCalledWith(30);
    await user.selectOptions(select, 'Not set');
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('adds a new value inline and selects it', async () => {
    const fetchMock = mockFetch({
      'POST /api/lists/department': () => ({ status: 201, body: { id: 31, list: 'department', name: 'Legal', order: 1 } }),
    });
    const user = userEvent.setup();
    render(<Harness />);

    await user.selectOptions(screen.getByLabelText('Business user (department)'), '+ Add new department…');
    await user.type(screen.getByLabelText('New business user (department)'), 'Legal');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByRole('option', { name: 'Legal' })).toBeInTheDocument();
    expect(screen.getByLabelText('Business user (department)')).toHaveValue('31');
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init?.body as string)).toEqual({ name: 'Legal' });
  });

  it('shows a server error, and Cancel goes back without changing the value', async () => {
    mockFetch({ 'POST /api/lists/department': () => ({ status: 400, body: { error: 'Invalid value' } }) });
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText('Business user (department)'), '+ Add new department…');
    await user.type(screen.getByLabelText('New business user (department)'), 'X');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid value');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText('Business user (department)')).toHaveValue('');
    expect(onChange).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run client/components`
Expected: FAIL with "Failed to resolve import './ItemTable'" and "Failed to resolve import './OptionPicker'".

- [ ] **Step 4: Create `client/components/ItemTable.tsx`**

```tsx
import { useState, type KeyboardEvent } from 'react';
import { GripIcon, PlusIcon, TrashIcon } from '../icons';
import { moveItem, useReorder } from '../useReorder';

export interface DraftItem {
  /** Set for an item that is already saved, so the server keeps its date added. */
  id?: number;
  text: string;
}

interface ItemTableProps {
  title: string;
  /** Singular name used in labels, e.g. "Scope item" → "Scope item 1", "Remove scope item 1". */
  noun: string;
  items: DraftItem[];
  onChange: (items: DraftItem[]) => void;
}

/** An auto-numbered list of short texts: add, edit in place, remove, and reorder by dragging or with the arrow keys. */
export function ItemTable({ title, noun, items, onChange }: ItemTableProps) {
  const [draft, setDraft] = useState('');
  const { handleProps, rowProps } = useReorder(items.length, (from, to) => onChange(moveItem(items, from, to)));
  const lower = noun.toLowerCase();

  function add() {
    const text = draft.trim();
    if (!text) return;
    onChange([...items, { text }]);
    setDraft('');
  }

  function onDraftKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault(); // Enter must add the item, not submit the surrounding form.
    add();
  }

  return (
    <div className="item-table">
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p className="muted item-empty">None yet.</p>
      ) : (
        <ol className="item-list">
          {items.map((item, i) => (
            <li key={i} className="item-row" {...rowProps(i)}>
              <button {...handleProps(i, `Reorder ${lower} ${i + 1}`)}>
                <GripIcon />
              </button>
              <span className="item-number" aria-hidden="true">{i + 1}.</span>
              <input
                aria-label={`${noun} ${i + 1}`}
                value={item.text}
                onChange={(e) => onChange(items.map((it, j) => (j === i ? { ...it, text: e.target.value } : it)))}
              />
              <button
                type="button"
                className="button ghost-icon"
                aria-label={`Remove ${lower} ${i + 1}`}
                onClick={() => onChange(items.filter((_, j) => j !== i))}
              >
                <TrashIcon />
              </button>
            </li>
          ))}
        </ol>
      )}
      <div className="item-add">
        <input
          aria-label={`New ${lower}`}
          placeholder={`Add ${lower}…`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onDraftKeyDown}
        />
        <button type="button" className="button secondary" aria-label={`Add ${lower}`} onClick={add} disabled={!draft.trim()}>
          <PlusIcon />Add
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create `client/components/OptionPicker.tsx`**

```tsx
import { useState } from 'react';
import type { ListName, ListValue } from '../../shared/types';
import { api } from '../api';

const NONE = '';
const ADD = '__add__';

interface OptionPickerProps {
  label: string;
  list: ListName;
  options: ListValue[];
  value: number | null;
  onChange: (id: number | null) => void;
  /** Called with a value created inline, so the parent can show it straight away. */
  onAdded: (value: ListValue) => void;
  /** Text of the empty choice, e.g. "Not set" or "Standalone (no main project)". */
  noneLabel: string;
  /** Text of the choice that opens the inline add, e.g. "+ Add new department…" or "Other…". */
  addLabel: string;
}

/** A dropdown over one of the editable lists, with an inline way to add a new value. */
export function OptionPicker({ label, list, options, value, onChange, onAdded, noneLabel, addLabel }: OptionPickerProps) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function closeAdd() {
    setAdding(false);
    setName('');
    setError(null);
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      const created = await api.addListValue(list, trimmed);
      onAdded(created);
      onChange(created.id);
      closeAdd();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  if (adding) {
    return (
      <div className="option-add">
        <label>
          {label}
          <input
            autoFocus
            aria-label={`New ${label.toLowerCase()}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void save();
              } else if (e.key === 'Escape') {
                closeAdd();
              }
            }}
          />
        </label>
        <div className="option-add-actions">
          <button type="button" className="button" onClick={() => void save()} disabled={saving || !name.trim()}>
            Add
          </button>
          <button type="button" className="button secondary" onClick={closeAdd}>
            Cancel
          </button>
        </div>
        {error ? <p className="field-error" role="alert">{error}</p> : null}
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
        {options.map((o) => (
          <option key={o.id} value={String(o.id)}>{o.name}</option>
        ))}
        <option value={ADD}>{addLabel}</option>
      </select>
    </label>
  );
}
```

- [ ] **Step 6: Add the styles to `client/styles.css`**

In the Forms section:
- Change the selector `input {` to `input,\nselect,\ntextarea {`.
- Change `input:hover {` to `input:hover, select:hover, textarea:hover {`.
- Change `input:focus-visible {` to `input:focus-visible, select:focus-visible, textarea:focus-visible {`.

Then append after the `.drag-handle:active` rule:

```css
select { cursor: pointer; }

.item-table h3 { margin-bottom: var(--sp-2); }
.item-list { list-style: none; margin: 0 0 var(--sp-2); padding: 0; }
.item-row {
  display: grid;
  grid-template-columns: auto 2.5ch 1fr auto;
  gap: var(--sp-2);
  align-items: center;
  margin-bottom: var(--sp-2);
}
.item-number { color: var(--muted); text-align: right; font-variant-numeric: tabular-nums; }
.item-empty { margin: 0 0 var(--sp-2); font-size: var(--fs-sm); }
.item-add { display: grid; grid-template-columns: 1fr auto; gap: var(--sp-2); }

.option-add { display: flex; flex-direction: column; gap: var(--sp-2); }
.option-add-actions { display: flex; gap: var(--sp-2); }
.field-error { margin: 0; color: var(--danger); font-size: var(--fs-sm); }
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run client/components`
Expected: PASS (6 tests).

- [ ] **Step 8: Run the whole suite and the type check**

Run: `npm test` → Expected: PASS (all tests).
Run: `npm run typecheck` → Expected: exit code 0.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: numbered item table and dropdown with inline add"
```

---

### Task 5: The 3-step create wizard

This task rewrites `CreateProjectPage.tsx` as a wizard:
- **Step 1, Basic info:** `DetailsFields`.
- **Step 2, Description & scope:** `ScopeFields`.
- **Step 3, Phases:** `PhasesFields`. The start date, phase list and live preview move here, now using `useReorder`. The page's old copy of the drag-and-drop code is deleted.

All form state lives in the page, so moving between steps keeps what was typed.

How the steps work:
- **Next** (the submit button on Steps 1–2, so Enter in a text field also means Next) checks only the current step's fields.
- **Create project** checks everything. If a field is invalid, the local check or the server's 400 sends the user back to the first step with an error.

**Files:**
- Create: `client/pages/manage/labels.ts`, `client/pages/manage/projectDraft.ts`, `client/pages/manage/DetailsFields.tsx`, `client/pages/manage/ScopeFields.tsx`, `client/pages/manage/PhasesFields.tsx`
- Modify (replace whole file): `client/pages/manage/CreateProjectPage.tsx`, `client/pages/manage/CreateProjectPage.test.tsx`
- Modify: `client/styles.css`
- Test: `client/pages/manage/projectDraft.test.ts` (new), `client/pages/manage/CreateProjectPage.test.tsx` (rewritten)

**Interfaces:**
- Consumes:
  - `ItemTable`, `DraftItem`, `OptionPicker` (Task 4)
  - `useReorder`, `moveItem`, `useLists`, `GripIcon`, `api` (Task 3)
  - `sampleLists`, `sampleProject`, `mockFetch` (Task 3)
  - `newProjectSchema`, `toIssues`, `ProjectDetailsInput`, `NewProjectInput`, `ValidationIssue` (Task 2)
  - `SCOPE_KINDS`, `Priority`, `Category`, `ScopeKind`, `ProjectRecord`, `Lists`, `ListValue` (Tasks 1–2)
  - `Gantt`, `phaseRows`, `rangeFor`, `useElementWidth`, `useAsync`, `schedulePhases`, `PhaseInput`, `DEFAULT_CALENDAR`, `isISODate`, `todayLocal` (M1)
- Produces:
  - `labels.ts`:
    - `PRIORITY_LABEL: Record<Priority, string>`
    - `CATEGORY_LABEL: Record<Category, string>`
    - `SCOPE_TABLES: { kind: ScopeKind; title: string; noun: string }[]`, in this order:
      1. Scope / "Scope item"
      2. Out of scope / "Out-of-scope item"
      3. Problem statements / "Problem statement"
      4. Objectives / "Objective"
  - `projectDraft.ts`:
    - `interface DetailsDraft`: all detail fields as form values, plus `scope: Record<ScopeKind, DraftItem[]>`
    - `emptyDetails()`, `detailsFromProject(p)`, `detailsToInput(d): ProjectDetailsInput`
    - `stepOfIssue(issue): number` (0, 1 or 2, or -1 when no step owns the field)
    - `firstStepWithIssue(issues): number | null`
  - `DetailsFields({ value, onChange, lists, onListAdded })`
    - Headings: "Basic info" and "Classification".
    - Labels: "Project name", "Jira key", "Priority", "Colour", "Project manager", "Business owner", "Main project", "Categorisation", "Project type", "Goal", "Business user (department)".
    - Checkboxes "Internal" and "External" (legend "Requester"), and "Employees" and "Customers" (legend "Beneficiary").
  - `ScopeFields({ value, onChange })`
    - Headings: "Description" and "Scope and goals".
    - Labels: "Background" and "Summary".
    - The four `ItemTable`s from `SCOPE_TABLES`.
  - `PhasesFields({ startDate, onStartDate, phases, onPhases })` and `DEFAULT_PHASES`.
    - Headings: "Phases" and "Preview". Label "Start date".
    - Row labels are unchanged from M1: "Phase N name", "Phase N working days", "Remove phase N", "Reorder phase N", and the "Add phase" button.
  - Wizard buttons: "Back", "Next", "Create project".
  - Step list `ol.wizard-steps`, where the current `li` has `aria-current="step"`.

- [ ] **Step 1: Write the failing test** `client/pages/manage/projectDraft.test.ts`

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { sampleProject } from '../../testing/mockFetch';
import { detailsFromProject, detailsToInput, emptyDetails, firstStepWithIssue, stepOfIssue } from './projectDraft';

describe('projectDraft', () => {
  it('turns the four tables into one scope item list, in table order', () => {
    const d = emptyDetails();
    d.scope.objective = [{ text: 'Faster' }];
    d.scope.scope = [{ id: 5, text: 'Payments' }, { text: 'Accounts' }];
    expect(detailsToInput(d).scopeItems).toEqual([
      { id: 5, kind: 'scope', text: 'Payments' },
      { kind: 'scope', text: 'Accounts' },
      { kind: 'objective', text: 'Faster' },
    ]);
  });

  it('loads a saved project into a draft, sorting items and keeping their ids', () => {
    const d = detailsFromProject(sampleProject({
      jiraKey: null,
      projectManager: 'Sara',
      projectType: { id: 2, name: 'Customer' },
      scopeItems: [
        { id: 7, kind: 'scope', text: 'Second', order: 1, dateAdded: '2026-09-24' },
        { id: 6, kind: 'scope', text: 'First', order: 0, dateAdded: '2026-09-24' },
      ],
    }));
    expect(d).toMatchObject({ jiraKey: '', projectManager: 'Sara', businessOwner: '', projectTypeId: 2, mainProjectId: null });
    expect(d.scope.scope).toEqual([{ id: 6, text: 'First' }, { id: 7, text: 'Second' }]);
  });

  it('maps each error to the wizard step that owns the field', () => {
    expect(stepOfIssue({ path: 'name', message: '' })).toBe(0);
    expect(stepOfIssue({ path: 'departmentId', message: '' })).toBe(0);
    expect(stepOfIssue({ path: 'scopeItems.2.text', message: '' })).toBe(1);
    expect(stepOfIssue({ path: 'phases.0.durationDays', message: '' })).toBe(2);
    expect(stepOfIssue({ path: '', message: '' })).toBe(-1);
    expect(firstStepWithIssue([{ path: 'phases', message: '' }, { path: 'summary', message: '' }])).toBe(1);
    expect(firstStepWithIssue([{ path: '', message: 'Server down' }])).toBeNull();
  });
});
```

- [ ] **Step 2: Replace `client/pages/manage/CreateProjectPage.test.tsx`**

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router';
import { describe, expect, it } from 'vitest';
import { mockFetch, sampleLists, sampleProject, type MockHandler } from '../../testing/mockFetch';
import { CreateProjectPage } from './CreateProjectPage';

function ProjectStub() {
  const { id } = useParams();
  return <div>Project page {id}</div>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/manage/projects/new']}>
      <Routes>
        <Route path="/manage/projects/new" element={<CreateProjectPage />} />
        <Route path="/manage/projects/:id" element={<ProjectStub />} />
      </Routes>
    </MemoryRouter>,
  );
}

const baseRoutes: Record<string, MockHandler> = {
  'GET /api/settings/calendar': () => ({ body: { weekendDays: [0, 6], holidays: [] } }),
  'GET /api/lists': () => ({ body: sampleLists() }),
};

type User = ReturnType<typeof userEvent.setup>;

async function openPhasesStep(user: User) {
  await user.type(screen.getByLabelText('Project name'), 'Portal');
  await user.click(screen.getByRole('button', { name: 'Next' }));
  await user.click(screen.getByRole('button', { name: 'Next' }));
}

describe('CreateProjectPage wizard', () => {
  it('starts on Basic info and will not move on without a project name', async () => {
    mockFetch(baseRoutes);
    const user = userEvent.setup();
    renderPage();
    expect(screen.getByRole('heading', { name: 'Basic info' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Project name is required')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Basic info' })).toBeInTheDocument();
  });

  it('keeps what was typed when going back', async () => {
    mockFetch(baseRoutes);
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('Project name'), 'Portal');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: 'Description' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText('Project name')).toHaveValue('Portal');
  });

  it('creates a project with its details, scope and phases', async () => {
    const fetchMock = mockFetch({
      ...baseRoutes,
      'POST /api/projects': () => ({ status: 201, body: sampleProject({ id: 7 }) }),
    });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Project name'), 'Portal');
    await user.type(screen.getByLabelText('Project manager'), 'Sara Ahmed');
    await screen.findByRole('option', { name: 'Customer' });
    await user.selectOptions(screen.getByLabelText('Project type'), 'Customer');
    await user.selectOptions(screen.getByLabelText('Main project'), 'Digital Services');
    await user.click(screen.getByRole('checkbox', { name: 'Internal' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));

    await user.type(screen.getByLabelText('Background'), 'The portal is slow.');
    await user.type(screen.getByLabelText('New scope item'), 'Online payments{Enter}');
    expect(screen.getByLabelText('Scope item 1')).toHaveValue('Online payments');
    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByRole('heading', { name: 'Phases' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create project' }));

    expect(await screen.findByText('Project page 7')).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([url, init]) => url === '/api/projects' && init?.method === 'POST');
    const sent = JSON.parse(post![1]!.body as string);
    expect(sent).toMatchObject({
      name: 'Portal',
      projectManager: 'Sara Ahmed',
      projectTypeId: 2,
      mainProjectId: 20,
      requester: { internal: true, external: false },
      background: 'The portal is slow.',
      scopeItems: [{ kind: 'scope', text: 'Online payments' }],
      color: '#3b82f6',
    });
    expect(sent.phases).toHaveLength(7);
  });

  it('adds a new department from the dropdown and selects it', async () => {
    mockFetch({
      ...baseRoutes,
      'POST /api/lists/department': () => ({ status: 201, body: { id: 31, list: 'department', name: 'Legal', order: 1 } }),
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('option', { name: 'Finance' });
    await user.selectOptions(screen.getByLabelText('Business user (department)'), '+ Add new department…');
    await user.type(screen.getByLabelText('New business user (department)'), 'Legal');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByRole('option', { name: 'Legal' })).toBeInTheDocument();
    expect(screen.getByLabelText('Business user (department)')).toHaveValue('31');
  });

  it('sends the user back to the step with a server-side error', async () => {
    mockFetch({
      ...baseRoutes,
      'POST /api/projects': () => ({
        status: 400,
        body: { error: 'Invalid project', issues: [{ path: 'projectTypeId', message: 'Unknown project type' }] },
      }),
    });
    const user = userEvent.setup();
    renderPage();
    await openPhasesStep(user);
    await user.click(screen.getByRole('button', { name: 'Create project' }));
    expect(await screen.findByText('Unknown project type')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Basic info' })).toBeInTheDocument();
  });

  it('starts with standard phases and previews them on a Gantt chart', async () => {
    mockFetch(baseRoutes);
    const user = userEvent.setup();
    renderPage();
    await openPhasesStep(user);
    expect(screen.getByLabelText('Phase 4 name')).toHaveValue('Development');
    expect(await screen.findByTestId('gantt-row-3')).toBeInTheDocument();
  });

  it('adds and removes phases', async () => {
    mockFetch(baseRoutes);
    const user = userEvent.setup();
    renderPage();
    await openPhasesStep(user);
    await user.click(screen.getByRole('button', { name: 'Add phase' }));
    expect(screen.getByLabelText('Phase 8 name')).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Remove phase 8' }));
    expect(screen.queryByLabelText('Phase 8 name')).toBeNull();
  });

  it('reorders phases via drag-and-drop, updating the preview order', async () => {
    mockFetch(baseRoutes);
    const user = userEvent.setup();
    renderPage();
    await openPhasesStep(user);

    const row1 = screen.getByLabelText('Reorder phase 1').closest('.phase-row') as HTMLElement;
    const dataTransfer = { setData: () => {}, getData: () => '', effectAllowed: '' };
    fireEvent.dragStart(screen.getByLabelText('Reorder phase 2'), { dataTransfer });
    fireEvent.dragOver(row1, { dataTransfer });
    fireEvent.drop(row1, { dataTransfer });

    expect(screen.getByLabelText('Phase 1 name')).toHaveValue('Business analysis');
    expect(screen.getByLabelText('Phase 2 name')).toHaveValue('Requirements gathering');
    expect(await screen.findByTestId('gantt-row-0')).toHaveTextContent('Business analysis');
  });

  it('reorders phases via keyboard, moving focus with the phase', async () => {
    mockFetch(baseRoutes);
    const user = userEvent.setup();
    renderPage();
    await openPhasesStep(user);

    const handle2 = screen.getByLabelText('Reorder phase 2');
    handle2.focus();
    fireEvent.keyDown(handle2, { key: 'ArrowUp' });

    expect(screen.getByLabelText('Phase 1 name')).toHaveValue('Business analysis');
    expect(await screen.findByTestId('gantt-row-0')).toHaveTextContent('Business analysis');
    expect(screen.getByLabelText('Reorder phase 1')).toHaveFocus();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run client/pages/manage/projectDraft.test.ts client/pages/manage/CreateProjectPage.test.tsx`
Expected: FAIL. The first file fails with "Failed to resolve import './projectDraft'". The wizard tests fail because they cannot find the "Basic info" heading or the "Next" button.

- [ ] **Step 4: Create `client/pages/manage/labels.ts`**

```ts
import type { Category, Priority, ScopeKind } from '../../../shared/types';

export const PRIORITY_LABEL: Record<Priority, string> = { high: 'High', medium: 'Medium', low: 'Low' };

export const CATEGORY_LABEL: Record<Category, string> = { strategic: 'Strategic', operational: 'Operational' };

/** The four scope tables, in the order the wizard and project page show them. */
export const SCOPE_TABLES: { kind: ScopeKind; title: string; noun: string }[] = [
  { kind: 'scope', title: 'Scope', noun: 'Scope item' },
  { kind: 'out-of-scope', title: 'Out of scope', noun: 'Out-of-scope item' },
  { kind: 'problem', title: 'Problem statements', noun: 'Problem statement' },
  { kind: 'objective', title: 'Objectives', noun: 'Objective' },
];
```

- [ ] **Step 5: Create `client/pages/manage/projectDraft.ts`**

```ts
import type { ProjectDetailsInput, ValidationIssue } from '../../../shared/schemas';
import { SCOPE_KINDS, type Category, type Priority, type ProjectRecord, type ScopeKind } from '../../../shared/types';
import type { DraftItem } from '../../components/ItemTable';

/** The project details as the form holds them: text fields are plain strings, and each scope table is its own list. */
export interface DetailsDraft {
  name: string;
  jiraKey: string;
  color: string;
  priority: Priority;
  projectManager: string;
  businessOwner: string;
  mainProjectId: number | null;
  category: Category | null;
  projectTypeId: number | null;
  goalId: number | null;
  departmentId: number | null;
  requester: { internal: boolean; external: boolean };
  beneficiary: { employees: boolean; customers: boolean };
  background: string;
  summary: string;
  scope: Record<ScopeKind, DraftItem[]>;
}

function emptyScope(): Record<ScopeKind, DraftItem[]> {
  return { scope: [], 'out-of-scope': [], problem: [], objective: [] };
}

export function emptyDetails(): DetailsDraft {
  return {
    name: '',
    jiraKey: '',
    color: '#3b82f6',
    priority: 'medium',
    projectManager: '',
    businessOwner: '',
    mainProjectId: null,
    category: null,
    projectTypeId: null,
    goalId: null,
    departmentId: null,
    requester: { internal: false, external: false },
    beneficiary: { employees: false, customers: false },
    background: '',
    summary: '',
    scope: emptyScope(),
  };
}

export function detailsFromProject(p: ProjectRecord): DetailsDraft {
  const scope = emptyScope();
  for (const item of [...p.scopeItems].sort((a, b) => a.order - b.order)) {
    scope[item.kind].push({ id: item.id, text: item.text });
  }
  return {
    name: p.name,
    jiraKey: p.jiraKey ?? '',
    color: p.color,
    priority: p.priority,
    projectManager: p.projectManager ?? '',
    businessOwner: p.businessOwner ?? '',
    mainProjectId: p.mainProject?.id ?? null,
    category: p.category,
    projectTypeId: p.projectType?.id ?? null,
    goalId: p.goal?.id ?? null,
    departmentId: p.department?.id ?? null,
    requester: { ...p.requester },
    beneficiary: { ...p.beneficiary },
    background: p.background,
    summary: p.summary,
    scope,
  };
}

export function detailsToInput(d: DetailsDraft): ProjectDetailsInput {
  const { scope, ...fields } = d;
  return {
    ...fields,
    scopeItems: SCOPE_KINDS.flatMap((kind) => scope[kind].map((item) => ({ ...item, kind }))),
  };
}

/** Which wizard step owns each top-level field, so an error can send the user to the right step. */
const STEP_FIELDS: string[][] = [
  ['name', 'jiraKey', 'color', 'priority', 'projectManager', 'businessOwner', 'mainProjectId', 'category',
    'projectTypeId', 'goalId', 'departmentId', 'requester', 'beneficiary'],
  ['background', 'summary', 'scopeItems'],
  ['startDate', 'phases'],
];

/** The step (0, 1 or 2) whose field has this issue, or -1 when no step owns it (e.g. a general server error). */
export function stepOfIssue(issue: ValidationIssue): number {
  const field = issue.path.split('.')[0];
  return STEP_FIELDS.findIndex((fields) => fields.includes(field));
}

export function firstStepWithIssue(issues: ValidationIssue[]): number | null {
  const steps = issues.map(stepOfIssue).filter((s) => s >= 0);
  return steps.length === 0 ? null : Math.min(...steps);
}
```

- [ ] **Step 6: Create `client/pages/manage/DetailsFields.tsx`**

```tsx
import type { Category, ListValue, Lists, Priority } from '../../../shared/types';
import { OptionPicker } from '../../components/OptionPicker';
import { CATEGORY_LABEL, PRIORITY_LABEL } from './labels';
import type { DetailsDraft } from './projectDraft';

interface DetailsFieldsProps {
  value: DetailsDraft;
  onChange: (patch: Partial<DetailsDraft>) => void;
  lists: Lists;
  onListAdded: (value: ListValue) => void;
}

/** Wizard Step 1: basic info and classification. Also used on the Edit details page. */
export function DetailsFields({ value, onChange, lists, onListAdded }: DetailsFieldsProps) {
  return (
    <>
      <section className="card">
        <h2>Basic info</h2>
        <div className="form-grid">
          <label>
            Project name
            <input value={value.name} onChange={(e) => onChange({ name: e.target.value })} />
          </label>
          <label>
            Jira key
            <input value={value.jiraKey} onChange={(e) => onChange({ jiraKey: e.target.value })} placeholder="PRJ-123" />
          </label>
          <label>
            Priority
            <select value={value.priority} onChange={(e) => onChange({ priority: e.target.value as Priority })}>
              {Object.entries(PRIORITY_LABEL).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            Colour
            <input type="color" value={value.color} onChange={(e) => onChange({ color: e.target.value })} />
          </label>
          <label>
            Project manager
            <input value={value.projectManager} onChange={(e) => onChange({ projectManager: e.target.value })} />
          </label>
          <label>
            Business owner
            <input value={value.businessOwner} onChange={(e) => onChange({ businessOwner: e.target.value })} />
          </label>
        </div>
      </section>

      <section className="card">
        <h2>Classification</h2>
        <div className="form-grid">
          <OptionPicker
            label="Main project"
            list="mainProject"
            options={lists.mainProject}
            value={value.mainProjectId}
            onChange={(id) => onChange({ mainProjectId: id })}
            onAdded={onListAdded}
            noneLabel="Standalone (no main project)"
            addLabel="+ Add new main project…"
          />
          <label>
            Categorisation
            <select
              value={value.category ?? ''}
              onChange={(e) => onChange({ category: e.target.value === '' ? null : (e.target.value as Category) })}
            >
              <option value="">Not set</option>
              {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </label>
          <OptionPicker
            label="Project type"
            list="projectType"
            options={lists.projectType}
            value={value.projectTypeId}
            onChange={(id) => onChange({ projectTypeId: id })}
            onAdded={onListAdded}
            noneLabel="Not set"
            addLabel="Other…"
          />
          <OptionPicker
            label="Goal"
            list="goal"
            options={lists.goal}
            value={value.goalId}
            onChange={(id) => onChange({ goalId: id })}
            onAdded={onListAdded}
            noneLabel="Not set"
            addLabel="Other…"
          />
          <OptionPicker
            label="Business user (department)"
            list="department"
            options={lists.department}
            value={value.departmentId}
            onChange={(id) => onChange({ departmentId: id })}
            onAdded={onListAdded}
            noneLabel="Not set"
            addLabel="+ Add new department…"
          />
        </div>

        <div className="check-groups">
          <fieldset className="check-group">
            <legend>Requester</legend>
            <label className="check">
              <input
                type="checkbox"
                checked={value.requester.internal}
                onChange={(e) => onChange({ requester: { ...value.requester, internal: e.target.checked } })}
              />
              Internal
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={value.requester.external}
                onChange={(e) => onChange({ requester: { ...value.requester, external: e.target.checked } })}
              />
              External
            </label>
          </fieldset>
          <fieldset className="check-group">
            <legend>Beneficiary</legend>
            <label className="check">
              <input
                type="checkbox"
                checked={value.beneficiary.employees}
                onChange={(e) => onChange({ beneficiary: { ...value.beneficiary, employees: e.target.checked } })}
              />
              Employees
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={value.beneficiary.customers}
                onChange={(e) => onChange({ beneficiary: { ...value.beneficiary, customers: e.target.checked } })}
              />
              Customers
            </label>
          </fieldset>
        </div>
      </section>
    </>
  );
}
```

- [ ] **Step 7: Create `client/pages/manage/ScopeFields.tsx`**

```tsx
import { ItemTable } from '../../components/ItemTable';
import { SCOPE_TABLES } from './labels';
import type { DetailsDraft } from './projectDraft';

interface ScopeFieldsProps {
  value: DetailsDraft;
  onChange: (patch: Partial<DetailsDraft>) => void;
}

/** Wizard Step 2: background, summary and the four scope tables. Also used on the Edit details page. */
export function ScopeFields({ value, onChange }: ScopeFieldsProps) {
  return (
    <>
      <section className="card">
        <h2>Description</h2>
        <div className="form-stack">
          <label>
            Background
            <textarea rows={4} value={value.background} onChange={(e) => onChange({ background: e.target.value })} />
          </label>
          <label>
            Summary
            <textarea rows={4} value={value.summary} onChange={(e) => onChange({ summary: e.target.value })} />
          </label>
        </div>
      </section>

      <section className="card">
        <h2>Scope and goals</h2>
        <div className="item-tables">
          {SCOPE_TABLES.map(({ kind, title, noun }) => (
            <ItemTable
              key={kind}
              title={title}
              noun={noun}
              items={value.scope[kind]}
              onChange={(items) => onChange({ scope: { ...value.scope, [kind]: items } })}
            />
          ))}
        </div>
      </section>
    </>
  );
}
```

- [ ] **Step 8: Create `client/pages/manage/PhasesFields.tsx`** (the phase list and live preview from the M1 page, moved here and switched to `useReorder`)

```tsx
import { DEFAULT_CALENDAR, isISODate, todayLocal } from '../../../shared/calendar';
import { schedulePhases, type PhaseInput } from '../../../shared/scheduler';
import { GripIcon, PlusIcon, TrashIcon } from '../../icons';
import { api } from '../../api';
import { Gantt } from '../../gantt/Gantt';
import { phaseRows, rangeFor } from '../../gantt/rows';
import { useElementWidth } from '../../gantt/useElementWidth';
import { useAsync } from '../../useAsync';
import { moveItem, useReorder } from '../../useReorder';

export const DEFAULT_PHASES: PhaseInput[] = [
  { name: 'Requirements gathering', durationDays: 10 },
  { name: 'Business analysis', durationDays: 10 },
  { name: 'Design', durationDays: 10 },
  { name: 'Development', durationDays: 40 },
  { name: 'QA', durationDays: 15 },
  { name: 'UAT', durationDays: 10 },
  { name: 'Go-live', durationDays: 2 },
];

interface PhasesFieldsProps {
  startDate: string;
  onStartDate: (date: string) => void;
  phases: PhaseInput[];
  onPhases: (phases: PhaseInput[]) => void;
}

/** Wizard Step 3: start date, ordered phases with working-day durations, and a live Gantt preview. */
export function PhasesFields({ startDate, onStartDate, phases, onPhases }: PhasesFieldsProps) {
  const calendar = useAsync(() => api.getCalendar(), []);
  const [chartRef, chartWidth] = useElementWidth<HTMLDivElement>();
  const { handleProps, rowProps } = useReorder(phases.length, (from, to) => onPhases(moveItem(phases, from, to)));

  const cal = calendar.data ?? DEFAULT_CALENDAR;
  const previewPhases = phases.filter((p) => p.name.trim() !== '' && Number.isInteger(p.durationDays) && p.durationDays >= 1);
  const scheduled = isISODate(startDate) ? schedulePhases(startDate, previewPhases, cal) : [];
  const rows = phaseRows({ phases: scheduled });
  const range = rangeFor(rows, isISODate(startDate) ? startDate : todayLocal());

  function update(index: number, patch: Partial<PhaseInput>) {
    onPhases(phases.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  return (
    <>
      <section className="card">
        <h2>Phases</h2>
        <p className="field-hint">Durations are in working days. Dates are calculated from the working calendar.</p>
        <div className="phase-start">
          <label>
            Start date
            <input type="date" value={startDate} onChange={(e) => onStartDate(e.target.value)} />
          </label>
        </div>
        {phases.map((phase, i) => (
          <div className="phase-row" key={i} {...rowProps(i)}>
            <button {...handleProps(i, `Reorder phase ${i + 1}`)}>
              <GripIcon />
            </button>
            <input
              aria-label={`Phase ${i + 1} name`}
              placeholder="Phase name"
              value={phase.name}
              onChange={(e) => update(i, { name: e.target.value })}
            />
            <input
              aria-label={`Phase ${i + 1} working days`}
              type="number"
              min={1}
              value={Number.isNaN(phase.durationDays) ? '' : phase.durationDays}
              onChange={(e) => update(i, { durationDays: e.target.valueAsNumber })}
            />
            <button
              type="button"
              className="button ghost-icon"
              aria-label={`Remove phase ${i + 1}`}
              onClick={() => onPhases(phases.filter((_, j) => j !== i))}
            >
              <TrashIcon />
            </button>
          </div>
        ))}
        <button type="button" className="button secondary" onClick={() => onPhases([...phases, { name: '', durationDays: 5 }])}>
          <PlusIcon />Add phase
        </button>
      </section>

      <section className="card">
        <h2>Preview</h2>
        <div className="chart-scroll" ref={chartRef}>
          <Gantt rows={rows} range={range} width={chartWidth} />
        </div>
      </section>
    </>
  );
}
```

- [ ] **Step 9: Replace `client/pages/manage/CreateProjectPage.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { todayLocal } from '../../../shared/calendar';
import { newProjectSchema, toIssues, type NewProjectInput, type ValidationIssue } from '../../../shared/schemas';
import type { PhaseInput } from '../../../shared/scheduler';
import { AlertIcon, ArrowLeftIcon, ArrowRightIcon } from '../../icons';
import { ApiError, api } from '../../api';
import { useLists } from '../../useLists';
import { DetailsFields } from './DetailsFields';
import { DEFAULT_PHASES, PhasesFields } from './PhasesFields';
import { ScopeFields } from './ScopeFields';
import { detailsToInput, emptyDetails, firstStepWithIssue, stepOfIssue, type DetailsDraft } from './projectDraft';

const STEPS = ['Basic info', 'Description & scope', 'Phases'];
const LAST = STEPS.length - 1;

export function CreateProjectPage() {
  const navigate = useNavigate();
  const { lists, error: listsError, remember } = useLists();
  const [step, setStep] = useState(0);
  const [details, setDetails] = useState<DetailsDraft>(emptyDetails);
  const [startDate, setStartDate] = useState(todayLocal());
  const [phases, setPhases] = useState<PhaseInput[]>(DEFAULT_PHASES);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [saving, setSaving] = useState(false);

  const patchDetails = (patch: Partial<DetailsDraft>) => setDetails((d) => ({ ...d, ...patch }));
  const input = (): NewProjectInput => ({ ...detailsToInput(details), startDate, phases });

  function validate(): ValidationIssue[] {
    const parsed = newProjectSchema.safeParse(input());
    return parsed.success ? [] : toIssues(parsed.error);
  }

  /** Shows the issues and moves to the earliest step that has one. */
  function showIssues(found: ValidationIssue[]) {
    setIssues(found);
    const first = firstStepWithIssue(found);
    if (first !== null) setStep(first);
  }

  function back() {
    setIssues([]);
    setStep((s) => s - 1);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validate();

    // Steps 1–2: "Next" (or Enter) only checks the fields on the current step.
    if (step < LAST) {
      const blocking = found.filter((i) => stepOfIssue(i) === step);
      setIssues(blocking);
      if (blocking.length === 0) setStep(step + 1);
      return;
    }

    if (found.length > 0) {
      showIssues(found);
      return;
    }
    setIssues([]);
    setSaving(true);
    try {
      const project = await api.createProject(input());
      navigate(`/manage/projects/${project.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.issues.length > 0) showIssues(err.issues);
      else setIssues([{ path: '', message: err instanceof Error ? err.message : String(err) }]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <Link to="/manage" className="crumb"><ArrowLeftIcon />Projects</Link>
          <h1>New project</h1>
        </div>
      </div>

      <ol className="wizard-steps">
        {STEPS.map((label, i) => (
          <li key={label} className={i === step ? 'current' : i < step ? 'done' : undefined} aria-current={i === step ? 'step' : undefined}>
            <span className="wizard-step-number">{i + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      <form onSubmit={onSubmit} noValidate>
        {issues.length > 0 ? (
          <div className="errors" role="alert">
            <AlertIcon />
            <ul>{issues.map((i) => <li key={`${i.path}-${i.message}`}>{i.message}</li>)}</ul>
          </div>
        ) : null}
        {listsError ? (
          <div className="errors" role="alert">
            <AlertIcon />
            <span>Could not load the dropdown lists: {listsError.message}</span>
          </div>
        ) : null}

        {step === 0 ? <DetailsFields value={details} onChange={patchDetails} lists={lists} onListAdded={remember} /> : null}
        {step === 1 ? <ScopeFields value={details} onChange={patchDetails} /> : null}
        {step === 2 ? (
          <PhasesFields startDate={startDate} onStartDate={setStartDate} phases={phases} onPhases={setPhases} />
        ) : null}

        <div className="wizard-actions">
          {step > 0 ? (
            <button type="button" className="button secondary" onClick={back}>
              <ArrowLeftIcon />Back
            </button>
          ) : (
            <span />
          )}
          <button type="submit" className="button" disabled={saving}>
            {step < LAST ? <>Next<ArrowRightIcon /></> : saving ? 'Saving…' : 'Create project'}
          </button>
        </div>
      </form>
    </main>
  );
}
```

- [ ] **Step 10: Add the wizard styles to `client/styles.css`** (append after the `.field-error` rule from Task 4)

```css
textarea { resize: vertical; min-height: 6rem; line-height: 1.5; }
.form-stack { display: flex; flex-direction: column; gap: var(--sp-4); }

.check-groups { display: flex; flex-wrap: wrap; gap: var(--sp-3) var(--sp-6); margin-top: var(--sp-4); }
.check-group { border: 0; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: var(--sp-4); align-items: center; }
.check-group legend { float: left; margin-right: var(--sp-2); padding: 0; font-size: var(--fs-sm); font-weight: 500; color: var(--muted); }
label.check { flex-direction: row; align-items: center; gap: var(--sp-2); color: var(--ink); font-size: var(--fs-base); font-weight: 400; cursor: pointer; }
input[type='checkbox'] { width: 1.05rem; height: 1.05rem; padding: 0; accent-color: var(--primary); cursor: pointer; }

.item-tables { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(320px, 100%), 1fr)); gap: var(--sp-5); }
.phase-start { max-width: 240px; margin-bottom: var(--sp-4); }

.wizard-steps {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2) var(--sp-5);
  list-style: none;
  margin: 0 0 var(--sp-5);
  padding: 0;
  font-size: var(--fs-sm);
  color: var(--muted);
}
.wizard-steps li { display: flex; align-items: center; gap: var(--sp-2); }
.wizard-steps li.current { color: var(--ink); font-weight: 600; }
.wizard-step-number {
  display: inline-grid;
  place-items: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  border: 1px solid var(--border-strong);
  font-variant-numeric: tabular-nums;
}
.wizard-steps li.current .wizard-step-number { background: var(--primary); border-color: var(--primary); color: var(--on-primary); }
.wizard-steps li.done .wizard-step-number { background: var(--primary-wash); border-color: var(--primary-wash); color: var(--primary); }
.wizard-actions { display: flex; justify-content: space-between; gap: var(--sp-3); }
```

- [ ] **Step 11: Run the tests to verify they pass**

Run: `npx vitest run client/pages/manage`
Expected: PASS (the 3 `projectDraft` tests, 9 wizard tests, and the existing dashboard and project page tests).

- [ ] **Step 12: Run the whole suite and the type check**

Run: `npm test` → Expected: PASS (all tests).
Run: `npm run typecheck` → Expected: exit code 0.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat: three-step create project wizard with classification and scope tables"
```

---

### Task 6: Project page details and Edit details

**Files:**
- Modify: `client/pages/manage/labels.ts` (add `requesterLabel`, `beneficiaryLabel`)
- Modify (replace whole file): `client/pages/manage/ProjectPage.tsx`, `client/App.tsx`
- Create: `client/pages/manage/EditProjectPage.tsx`
- Modify: `client/styles.css`
- Test: `client/pages/manage/ProjectPage.test.tsx` (add a test), `client/pages/manage/EditProjectPage.test.tsx` (new)

**Interfaces:**
- Consumes:
  - `DetailsFields`, `ScopeFields`, `detailsFromProject`, `detailsToInput`, `DetailsDraft`, `PRIORITY_LABEL`, `CATEGORY_LABEL`, `SCOPE_TABLES` (Task 5)
  - `useLists`, `api.updateProjectDetails` (Task 3)
  - `projectDetailsSchema`, `toIssues` (Task 2)
- Produces:
  - Route `/manage/projects/:id/edit`.
  - The project page header gets a link "Edit details", plus three new cards:
    - **Details:** a `<dl>` with Priority, Project manager, Business owner, Main project ("Standalone" when none), Categorisation, Project type, Goal, Business user, Requester and Beneficiary. Unset values show "—".
    - **Description:** Background and Summary.
    - **Scope and goals:** four numbered read-only lists.
  - `requesterLabel({ internal, external })`:
    - "Internal" or "External" when only one is ticked;
    - "Both (internal and external)" when both are ticked;
    - "—" when neither is.
  - `beneficiaryLabel({ employees, customers })`:
    - "Employees" or "Customers" when only one is ticked;
    - "Employees and customers" when both are ticked;
    - "—" when neither is.
  - The Edit page shows `DetailsFields` and `ScopeFields` with a "Save changes" button and a "Cancel" link.
    - Save checks the input with `projectDetailsSchema`, sends a `PUT`, then goes back to the project page.
    - Phases are not editable here.

- [ ] **Step 1: Add the failing project-page test** — append inside the `describe('ProjectPage', ...)` block of `client/pages/manage/ProjectPage.test.tsx`:

```tsx
  it('shows the classification, description and scope, with a link to edit', async () => {
    mockFetch({
      'GET /api/projects/1': () => ({
        body: sampleProject({
          priority: 'high',
          projectManager: 'Sara Ahmed',
          mainProject: { id: 20, name: 'Digital Services' },
          category: 'strategic',
          department: { id: 30, name: 'Finance' },
          requester: { internal: true, external: true },
          beneficiary: { employees: false, customers: true },
          background: 'The portal is slow.',
          scopeItems: [
            { id: 6, kind: 'objective', text: 'Faster checkout', order: 0, dateAdded: '2026-09-24' },
            { id: 5, kind: 'scope', text: 'Online payments', order: 0, dateAdded: '2026-09-24' },
          ],
        }),
      }),
      'GET /api/settings/calendar': () => ({ body: { weekendDays: [0, 6], holidays: [] } }),
    });
    renderAt('/manage/projects/1');
    expect(await screen.findByText('Digital Services')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Sara Ahmed')).toBeInTheDocument();
    expect(screen.getByText('Strategic')).toBeInTheDocument();
    expect(screen.getByText('Finance')).toBeInTheDocument();
    expect(screen.getByText('Both (internal and external)')).toBeInTheDocument();
    expect(screen.getByText('Customers')).toBeInTheDocument();
    expect(screen.getByText('The portal is slow.')).toBeInTheDocument();
    expect(screen.getByText('Online payments')).toBeInTheDocument();
    expect(screen.getByText('Faster checkout')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit details' })).toHaveAttribute('href', '/manage/projects/1/edit');
  });
```

- [ ] **Step 2: Write the failing test** `client/pages/manage/EditProjectPage.test.tsx`

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router';
import { describe, expect, it } from 'vitest';
import { mockFetch, sampleLists, sampleProject } from '../../testing/mockFetch';
import { EditProjectPage } from './EditProjectPage';

function ProjectStub() {
  const { id } = useParams();
  return <div>Project page {id}</div>;
}

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/manage/projects/:id/edit" element={<EditProjectPage />} />
        <Route path="/manage/projects/:id" element={<ProjectStub />} />
      </Routes>
    </MemoryRouter>,
  );
}

const project = sampleProject({
  projectManager: 'Sara Ahmed',
  projectType: { id: 2, name: 'Customer' },
  scopeItems: [{ id: 5, kind: 'scope', text: 'Online payments', order: 0, dateAdded: '2026-09-24' }],
});

describe('EditProjectPage', () => {
  it('loads the saved details, saves changes and returns to the project', async () => {
    const fetchMock = mockFetch({
      'GET /api/projects/1': () => ({ body: project }),
      'GET /api/lists': () => ({ body: sampleLists() }),
      'PUT /api/projects/1/details': () => ({ body: project }),
    });
    const user = userEvent.setup();
    renderAt('/manage/projects/1/edit');

    const name = await screen.findByLabelText('Project name');
    expect(name).toHaveValue('Portal');
    expect(screen.getByLabelText('Project manager')).toHaveValue('Sara Ahmed');
    expect(screen.getByLabelText('Scope item 1')).toHaveValue('Online payments');
    await screen.findByRole('option', { name: 'Customer' });
    expect(screen.getByLabelText('Project type')).toHaveValue('2');

    await user.clear(name);
    await user.type(name, 'Portal 2');
    await user.type(screen.getByLabelText('New objective'), 'Faster checkout{Enter}');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Project page 1')).toBeInTheDocument();
    const put = fetchMock.mock.calls.find(([url, init]) => url === '/api/projects/1/details' && init?.method === 'PUT');
    const sent = JSON.parse(put![1]!.body as string);
    expect(sent).toMatchObject({ name: 'Portal 2', projectManager: 'Sara Ahmed', projectTypeId: 2 });
    expect(sent.scopeItems).toEqual([
      { id: 5, kind: 'scope', text: 'Online payments' },
      { kind: 'objective', text: 'Faster checkout' },
    ]);
    expect(sent.phases).toBeUndefined();
  });

  it('does not save an empty project name', async () => {
    const fetchMock = mockFetch({
      'GET /api/projects/1': () => ({ body: project }),
      'GET /api/lists': () => ({ body: sampleLists() }),
    });
    const user = userEvent.setup();
    renderAt('/manage/projects/1/edit');
    await user.clear(await screen.findByLabelText('Project name'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Project name is required')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false);
  });

  it('says when the project does not exist', async () => {
    mockFetch({
      'GET /api/projects/999': () => ({ status: 404, body: { error: 'Project not found' } }),
      'GET /api/lists': () => ({ body: sampleLists() }),
    });
    renderAt('/manage/projects/999/edit');
    expect(await screen.findByText('Project not found')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run client/pages/manage/ProjectPage.test.tsx client/pages/manage/EditProjectPage.test.tsx`
Expected: FAIL. The project-page test cannot find "Digital Services", and the edit-page test fails with "Failed to resolve import './EditProjectPage'".

- [ ] **Step 4: Add the flag labels to `client/pages/manage/labels.ts`** (append)

```ts
export function requesterLabel(r: { internal: boolean; external: boolean }): string {
  if (r.internal && r.external) return 'Both (internal and external)';
  if (r.internal) return 'Internal';
  if (r.external) return 'External';
  return '—';
}

export function beneficiaryLabel(b: { employees: boolean; customers: boolean }): string {
  if (b.employees && b.customers) return 'Employees and customers';
  if (b.employees) return 'Employees';
  if (b.customers) return 'Customers';
  return '—';
}
```

- [ ] **Step 5: Replace `client/pages/manage/ProjectPage.tsx`**

```tsx
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { DEFAULT_CALENDAR, countWorkingDays, todayLocal } from '../../../shared/calendar';
import { projectSpan } from '../../../shared/scheduler';
import { AlertIcon, ArrowLeftIcon } from '../../icons';
import { api } from '../../api';
import { Gantt } from '../../gantt/Gantt';
import { phaseRows, rangeFor } from '../../gantt/rows';
import { useElementWidth } from '../../gantt/useElementWidth';
import { useAsync } from '../../useAsync';
import { CATEGORY_LABEL, PRIORITY_LABEL, SCOPE_TABLES, beneficiaryLabel, requesterLabel } from './labels';

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function ProjectPage() {
  const id = Number(useParams().id);
  const project = useAsync(() => api.getProject(id), [id]);
  const calendar = useAsync(() => api.getCalendar(), []);
  const [chartRef, chartWidth] = useElementWidth<HTMLDivElement>();
  const today = todayLocal();

  if (project.error) {
    return (
      <main className="page">
        <Link to="/manage" className="crumb"><ArrowLeftIcon />Projects</Link>
        <div className="errors" role="alert">
          <AlertIcon />
          <span>{project.error.message}</span>
        </div>
      </main>
    );
  }
  if (!project.data) {
    return (
      <main className="page">
        <div className="skeleton skeleton-line" style={{ width: '12ch', height: '0.9rem', marginBottom: 'var(--sp-4)' }} />
        <div className="skeleton" style={{ width: '40ch', maxWidth: '100%', height: '1.75rem', marginBottom: 'var(--sp-5)' }} />
        <section className="card"><div className="skeleton skeleton-chart" /></section>
      </main>
    );
  }

  const p = project.data;
  const span = projectSpan(p.phases);
  const rows = phaseRows(p);
  const cal = calendar.data ?? DEFAULT_CALENDAR;

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <Link to="/manage" className="crumb"><ArrowLeftIcon />Projects</Link>
          <h1>{p.name}</h1>
          <p className="meta-line">
            {p.jiraKey ? `${p.jiraKey} · ` : ''}
            {span ? `${span.start} → ${span.end} · ${countWorkingDays(span.start, span.end, cal)} working days` : 'No phases'}
          </p>
        </div>
        <Link to={`/manage/projects/${p.id}/edit`} className="button secondary">Edit details</Link>
      </div>

      <section className="card">
        <h2>Timeline</h2>
        <div className="chart-scroll" ref={chartRef}>
          <Gantt rows={rows} range={rangeFor(rows, today)} width={chartWidth} today={today} />
        </div>
      </section>

      <section className="card">
        <h2>Details</h2>
        <dl className="details-grid">
          <Detail label="Priority">{PRIORITY_LABEL[p.priority]}</Detail>
          <Detail label="Project manager">{p.projectManager ?? '—'}</Detail>
          <Detail label="Business owner">{p.businessOwner ?? '—'}</Detail>
          <Detail label="Main project">{p.mainProject?.name ?? 'Standalone'}</Detail>
          <Detail label="Categorisation">{p.category ? CATEGORY_LABEL[p.category] : '—'}</Detail>
          <Detail label="Project type">{p.projectType?.name ?? '—'}</Detail>
          <Detail label="Goal">{p.goal?.name ?? '—'}</Detail>
          <Detail label="Business user">{p.department?.name ?? '—'}</Detail>
          <Detail label="Requester">{requesterLabel(p.requester)}</Detail>
          <Detail label="Beneficiary">{beneficiaryLabel(p.beneficiary)}</Detail>
        </dl>
      </section>

      <section className="card">
        <h2>Description</h2>
        <h3>Background</h3>
        <p className="prose">{p.background || '—'}</p>
        <h3>Summary</h3>
        <p className="prose">{p.summary || '—'}</p>
      </section>

      <section className="card">
        <h2>Scope and goals</h2>
        <div className="scope-summary">
          {SCOPE_TABLES.map(({ kind, title }) => {
            const items = p.scopeItems.filter((i) => i.kind === kind).sort((a, b) => a.order - b.order);
            return (
              <div key={kind}>
                <h3>{title}</h3>
                {items.length === 0 ? (
                  <p className="muted">None.</p>
                ) : (
                  <ol>{items.map((i) => <li key={i.id}>{i.text}</li>)}</ol>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h2>Phases</h2>
        <table>
          <thead>
            <tr><th>Phase</th><th>Start</th><th>End</th><th>Working days</th></tr>
          </thead>
          <tbody>
            {p.phases.map((ph) => (
              <tr key={ph.id}>
                <td>{ph.name}</td>
                <td>{ph.start}</td>
                <td>{ph.end}</td>
                <td>{ph.durationDays}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
```

- [ ] **Step 6: Create `client/pages/manage/EditProjectPage.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { projectDetailsSchema, toIssues, type ValidationIssue } from '../../../shared/schemas';
import { AlertIcon, ArrowLeftIcon } from '../../icons';
import { ApiError, api } from '../../api';
import { useAsync } from '../../useAsync';
import { useLists } from '../../useLists';
import { DetailsFields } from './DetailsFields';
import { ScopeFields } from './ScopeFields';
import { detailsFromProject, detailsToInput, type DetailsDraft } from './projectDraft';

export function EditProjectPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const project = useAsync(() => api.getProject(id), [id]);
  const { lists, remember } = useLists();
  const [edited, setEdited] = useState<DetailsDraft | null>(null);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [saving, setSaving] = useState(false);

  if (project.error) {
    return (
      <main className="page">
        <Link to="/manage" className="crumb"><ArrowLeftIcon />Projects</Link>
        <div className="errors" role="alert">
          <AlertIcon />
          <span>{project.error.message}</span>
        </div>
      </main>
    );
  }
  if (!project.data) return <main className="page"><p className="muted">Loading…</p></main>;

  // Until the user changes something, the form shows the saved project.
  const draft = edited ?? detailsFromProject(project.data);
  const patch = (changes: Partial<DetailsDraft>) => setEdited({ ...draft, ...changes });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const input = detailsToInput(draft);
    const parsed = projectDetailsSchema.safeParse(input);
    if (!parsed.success) {
      setIssues(toIssues(parsed.error));
      return;
    }
    setIssues([]);
    setSaving(true);
    try {
      await api.updateProjectDetails(id, input);
      navigate(`/manage/projects/${id}`);
    } catch (err) {
      setIssues(
        err instanceof ApiError && err.issues.length > 0
          ? err.issues
          : [{ path: '', message: err instanceof Error ? err.message : String(err) }],
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <Link to={`/manage/projects/${id}`} className="crumb"><ArrowLeftIcon />{project.data.name}</Link>
          <h1>Edit details</h1>
        </div>
      </div>

      <form onSubmit={onSubmit} noValidate>
        {issues.length > 0 ? (
          <div className="errors" role="alert">
            <AlertIcon />
            <ul>{issues.map((i) => <li key={`${i.path}-${i.message}`}>{i.message}</li>)}</ul>
          </div>
        ) : null}

        <DetailsFields value={draft} onChange={patch} lists={lists} onListAdded={remember} />
        <ScopeFields value={draft} onChange={patch} />

        <p className="muted">
          Phases can't be changed here. Changing a plan after it starts will go through change requests and baselines.
        </p>
        <div className="wizard-actions">
          <Link to={`/manage/projects/${id}`} className="button secondary">Cancel</Link>
          <button type="submit" className="button" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
        </div>
      </form>
    </main>
  );
}
```

- [ ] **Step 7: Replace `client/App.tsx`**

```tsx
import { Route, Routes } from 'react-router';
import { Landing } from './pages/Landing';
import { NotFound } from './pages/NotFound';
import { CreateProjectPage } from './pages/manage/CreateProjectPage';
import { EditProjectPage } from './pages/manage/EditProjectPage';
import { ManageDashboardPage } from './pages/manage/ManageDashboardPage';
import { ProjectPage } from './pages/manage/ProjectPage';
import { FocusPage } from './pages/present/FocusPage';
import { PortfolioPage } from './pages/present/PortfolioPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/manage" element={<ManageDashboardPage />} />
      <Route path="/manage/projects/new" element={<CreateProjectPage />} />
      <Route path="/manage/projects/:id" element={<ProjectPage />} />
      <Route path="/manage/projects/:id/edit" element={<EditProjectPage />} />
      <Route path="/present" element={<PortfolioPage />} />
      <Route path="/present/projects/:id" element={<FocusPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
```

- [ ] **Step 8: Add the styles to `client/styles.css`** (append after the `.wizard-actions` rule from Task 5)

```css
.details-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr)); gap: var(--sp-4); margin: 0; }
.details-grid dt { font-size: var(--fs-sm); font-weight: 500; color: var(--muted); }
.details-grid dd { margin: var(--sp-1) 0 0; }
.prose { white-space: pre-wrap; margin: var(--sp-1) 0 var(--sp-4); }
.scope-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr)); gap: var(--sp-5); }
.scope-summary ol { margin: var(--sp-2) 0 0; padding-left: 1.4em; }
.scope-summary p { margin: var(--sp-2) 0 0; }
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npx vitest run client/pages/manage`
Expected: PASS (includes 3 existing `ProjectPage` tests and 3 new `EditProjectPage` tests).

- [ ] **Step 10: Run the whole suite and the type check**

Run: `npm test` → Expected: PASS (all tests).
Run: `npm run typecheck` → Expected: exit code 0.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: project details on the project page and an edit details page"
```

---

### Task 7: Settings page for the dropdown lists

**Files:**
- Create: `client/pages/manage/ListEditor.tsx`, `client/pages/manage/SettingsPage.tsx`
- Modify (replace whole file): `client/App.tsx`
- Modify: `client/pages/manage/ManageDashboardPage.tsx` (header: add a "Settings" link)
- Modify: `client/styles.css`
- Test: `client/pages/manage/SettingsPage.test.tsx` (new), `client/pages/manage/ManageDashboardPage.test.tsx` (one new assertion)

**Interfaces:**
- Consumes: `api.getLists`, `api.addListValue`, `api.renameListValue`, `api.deleteListValue` (Task 3); `ListName`, `ListValue` (Task 1); `useAsync`, `AlertIcon`, `ArrowLeftIcon`, `PlusIcon`, `TrashIcon` (M1).
- Produces:
  - Route `/manage/settings`.
  - `ListEditor({ title, singular, list, values, onChanged })`:
    - Each row shows its name with a "Rename <name>" button and a "Delete <name>" button.
    - Renaming swaps in an input labelled "New name for <name>" with **Save** and **Cancel** buttons.
    - Adding uses an input labelled "New <singular lower-case>" and a button "Add <singular lower-case>".
    - A server error shows in `role="alert"`.
    - An empty list shows "Nothing here yet."
  - The Settings page has four editors, in this order:
    1. Main projects (singular "Main project")
    2. Project types ("Project type")
    3. Goals ("Goal")
    4. Business users (departments) ("Department")
  - After any change, the page reloads the lists.
  - The dashboard header gets a link "Settings" to `/manage/settings`.

- [ ] **Step 1: Write the failing test** `client/pages/manage/SettingsPage.test.tsx`

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { ListValue } from '../../../shared/types';
import { mockFetch, sampleLists, type MockHandler } from '../../testing/mockFetch';
import { SettingsPage } from './SettingsPage';

/** A small in-memory stand-in for the lists API, so reloads show the change. */
function fakeServer(): Record<string, MockHandler> {
  const lists = sampleLists();
  return {
    'GET /api/lists': () => ({ body: structuredClone(lists) }),
    'POST /api/lists/goal': (init) => {
      const value: ListValue = { id: 40, list: 'goal', name: JSON.parse(init!.body as string).name, order: lists.goal.length };
      lists.goal.push(value);
      return { status: 201, body: value };
    },
    'PUT /api/lists/projectType/2': (init) => {
      lists.projectType[1] = { ...lists.projectType[1], name: JSON.parse(init!.body as string).name };
      return { body: lists.projectType[1] };
    },
    'DELETE /api/lists/projectType/1': () => ({ status: 409, body: { error: '"Criminal" is used by 1 project' } }),
    'DELETE /api/lists/department/30': () => {
      lists.department = [];
      return { status: 204, body: null };
    },
  };
}

const renderPage = () => render(<MemoryRouter><SettingsPage /></MemoryRouter>);

describe('SettingsPage', () => {
  it('shows all four lists', async () => {
    mockFetch(fakeServer());
    renderPage();
    expect(await screen.findByText('Digital Services')).toBeInTheDocument();
    expect(screen.getByText('Criminal')).toBeInTheDocument();
    expect(screen.getByText('Digitalisation of internal operations')).toBeInTheDocument();
    expect(screen.getByText('Finance')).toBeInTheDocument();
  });

  it('adds a value', async () => {
    const fetchMock = mockFetch(fakeServer());
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByLabelText('New goal'), 'Better service');
    await user.click(screen.getByRole('button', { name: 'Add goal' }));
    expect(await screen.findByText('Better service')).toBeInTheDocument();
    expect(screen.getByLabelText('New goal')).toHaveValue('');
    expect(fetchMock).toHaveBeenCalledWith('/api/lists/goal', expect.objectContaining({ method: 'POST' }));
  });

  it('renames a value', async () => {
    mockFetch(fakeServer());
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Rename Customer' }));
    const input = screen.getByLabelText('New name for Customer');
    await user.clear(input);
    await user.type(input, 'Customer services');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Customer services')).toBeInTheDocument();
  });

  it('deletes an unused value, and explains why a used one cannot be deleted', async () => {
    mockFetch(fakeServer());
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Delete Finance' }));
    expect(await screen.findByText('Nothing here yet.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete Criminal' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('"Criminal" is used by 1 project');
    expect(screen.getByText('Criminal')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Add the failing dashboard assertion**

In `client/pages/manage/ManageDashboardPage.test.tsx`, inside the test `'lists projects with links and dates'`, add after the `New project` link assertion:

```tsx
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/manage/settings');
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run client/pages/manage/SettingsPage.test.tsx client/pages/manage/ManageDashboardPage.test.tsx`
Expected: FAIL. The first file fails with "Failed to resolve import './SettingsPage'", and the dashboard test cannot find the "Settings" link.

- [ ] **Step 4: Create `client/pages/manage/ListEditor.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import type { ListName, ListValue } from '../../../shared/types';
import { AlertIcon, PlusIcon, TrashIcon } from '../../icons';
import { api } from '../../api';

interface ListEditorProps {
  title: string;
  /** Singular name used in labels, e.g. "Goal" → "New goal", "Add goal". */
  singular: string;
  list: ListName;
  values: ListValue[];
  /** Called after every successful change, so the page can reload the lists. */
  onChanged: () => void;
}

/** Add, rename and delete the values of one dropdown list. */
export function ListEditor({ title, singular, list, values, onChanged }: ListEditorProps) {
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lower = singular.toLowerCase();

  async function run(action: () => Promise<unknown>, afterSuccess?: () => void) {
    setBusy(true);
    setError(null);
    try {
      await action();
      afterSuccess?.();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function onAdd(e: FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (name) void run(() => api.addListValue(list, name), () => setNewName(''));
  }

  return (
    <section className="card">
      <h2>{title}</h2>
      {error ? (
        <div className="errors" role="alert">
          <AlertIcon />
          <span>{error}</span>
        </div>
      ) : null}

      {values.length === 0 ? (
        <p className="muted">Nothing here yet.</p>
      ) : (
        <ul className="list-editor">
          {values.map((v) => (
            <li key={v.id} className="list-editor-row">
              {editing?.id === v.id ? (
                <>
                  <input
                    aria-label={`New name for ${v.name}`}
                    value={editing.name}
                    onChange={(e) => setEditing({ id: v.id, name: e.target.value })}
                  />
                  <button
                    type="button"
                    className="button"
                    disabled={busy || !editing.name.trim()}
                    onClick={() => void run(() => api.renameListValue(list, v.id, editing.name.trim()), () => setEditing(null))}
                  >
                    Save
                  </button>
                  <button type="button" className="button secondary" onClick={() => setEditing(null)}>Cancel</button>
                </>
              ) : (
                <>
                  <span className="list-editor-name">{v.name}</span>
                  <button
                    type="button"
                    className="button secondary"
                    aria-label={`Rename ${v.name}`}
                    onClick={() => setEditing({ id: v.id, name: v.name })}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="button ghost-icon"
                    aria-label={`Delete ${v.name}`}
                    disabled={busy}
                    onClick={() => void run(() => api.deleteListValue(list, v.id))}
                  >
                    <TrashIcon />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <form className="list-editor-add" onSubmit={onAdd}>
        <input aria-label={`New ${lower}`} placeholder={`Add a ${lower}…`} value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button type="submit" className="button secondary" disabled={busy || !newName.trim()}>
          <PlusIcon />Add {lower}
        </button>
      </form>
    </section>
  );
}
```

- [ ] **Step 5: Create `client/pages/manage/SettingsPage.tsx`**

```tsx
import { useState } from 'react';
import { Link } from 'react-router';
import type { ListName } from '../../../shared/types';
import { AlertIcon, ArrowLeftIcon } from '../../icons';
import { api } from '../../api';
import { useAsync } from '../../useAsync';
import { ListEditor } from './ListEditor';

const EDITORS: { list: ListName; title: string; singular: string }[] = [
  { list: 'mainProject', title: 'Main projects', singular: 'Main project' },
  { list: 'projectType', title: 'Project types', singular: 'Project type' },
  { list: 'goal', title: 'Goals', singular: 'Goal' },
  { list: 'department', title: 'Business users (departments)', singular: 'Department' },
];

export function SettingsPage() {
  const [version, setVersion] = useState(0);
  const lists = useAsync(() => api.getLists(), [version]);
  const reload = () => setVersion((v) => v + 1);

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <Link to="/manage" className="crumb"><ArrowLeftIcon />Projects</Link>
          <h1>Settings</h1>
          <p className="meta-line">The lists behind the project dropdowns. A value that a project uses can be renamed but not deleted.</p>
        </div>
      </div>

      {lists.error ? (
        <div className="errors" role="alert">
          <AlertIcon />
          <span>{lists.error.message}</span>
        </div>
      ) : null}
      {!lists.data && !lists.error ? <p className="muted">Loading…</p> : null}

      {lists.data ? (
        <div className="settings-grid">
          {EDITORS.map((editor) => (
            <ListEditor key={editor.list} {...editor} values={lists.data![editor.list]} onChanged={reload} />
          ))}
        </div>
      ) : null}
    </main>
  );
}
```

- [ ] **Step 6: Replace `client/App.tsx`** (Task 6's version plus the settings route)

```tsx
import { Route, Routes } from 'react-router';
import { Landing } from './pages/Landing';
import { NotFound } from './pages/NotFound';
import { CreateProjectPage } from './pages/manage/CreateProjectPage';
import { EditProjectPage } from './pages/manage/EditProjectPage';
import { ManageDashboardPage } from './pages/manage/ManageDashboardPage';
import { ProjectPage } from './pages/manage/ProjectPage';
import { SettingsPage } from './pages/manage/SettingsPage';
import { FocusPage } from './pages/present/FocusPage';
import { PortfolioPage } from './pages/present/PortfolioPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/manage" element={<ManageDashboardPage />} />
      <Route path="/manage/settings" element={<SettingsPage />} />
      <Route path="/manage/projects/new" element={<CreateProjectPage />} />
      <Route path="/manage/projects/:id" element={<ProjectPage />} />
      <Route path="/manage/projects/:id/edit" element={<EditProjectPage />} />
      <Route path="/present" element={<PortfolioPage />} />
      <Route path="/present/projects/:id" element={<FocusPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
```

- [ ] **Step 7: Add the Settings link to the dashboard header**

In `client/pages/manage/ManageDashboardPage.tsx`, replace:

```tsx
        <Link to="/manage/projects/new" className="button"><PlusIcon />New project</Link>
```

with:

```tsx
        <div className="header-actions">
          <Link to="/manage/settings" className="button secondary">Settings</Link>
          <Link to="/manage/projects/new" className="button"><PlusIcon />New project</Link>
        </div>
```

- [ ] **Step 8: Add the styles to `client/styles.css`** (append after the `.scope-summary p` rule from Task 6)

```css
.header-actions { display: flex; flex-wrap: wrap; gap: var(--sp-2); }

.settings-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(340px, 100%), 1fr)); gap: var(--sp-4); align-items: start; }
.settings-grid .card { margin-bottom: 0; }
.list-editor { list-style: none; margin: 0 0 var(--sp-3); padding: 0; }
.list-editor-row { display: flex; align-items: center; gap: var(--sp-2); padding: var(--sp-2) 0; border-bottom: 1px solid var(--border); }
.list-editor-row input { flex: 1; min-width: 0; }
.list-editor-name { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.list-editor-add { display: grid; grid-template-columns: 1fr auto; gap: var(--sp-2); }
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npx vitest run client/pages/manage`
Expected: PASS (includes 4 new `SettingsPage` tests).

- [ ] **Step 10: Run the whole suite and the type check**

Run: `npm test` → Expected: PASS (all tests).
Run: `npm run typecheck` → Expected: exit code 0.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: settings page for the dropdown lists"
```

---

### Task 8: Portfolio grouped by main project, and demo data with details (completes M3)

This task has three parts:
- The portfolio Gantt shows each main project as a **group row** with a summary bar, from its projects' earliest start to their latest end. The group's projects follow it, indented. Standalone projects come last.
  - A group row does not open anything when clicked.
  - Group rows appear only on `/present`, which is spec §4.2. The Manage dashboard stays ungrouped.
- `transaction()` can now nest, so `seedDemo()` adds all demo projects atomically. This also closes an M2 review note: the seed was not transactional.
- The demo projects gain classification, description and scope, with two main projects so grouping shows up.

**Files:**
- Modify: `client/gantt/Gantt.tsx` (optional `kind` on rows)
- Modify: `client/gantt/rows.ts` (add `groupedPortfolioRows`)
- Modify: `client/pages/present/PortfolioPage.tsx` (use it)
- Modify: `server/db.ts` (`transaction` nests)
- Modify (replace whole file): `server/demoData.ts`, `server/demoData.test.ts`, `server/seed.ts`
- Modify: `client/styles.css`
- Test: `client/gantt/Gantt.test.tsx`, `client/gantt/rows.test.ts`, `client/pages/present/PortfolioPage.test.tsx`, `server/db.test.ts`, `server/demoData.test.ts`

**Interfaces:**
- Consumes: `ProjectRecord` with `mainProject` (Task 2); `portfolioRows`, `phaseColorFor` (M1); `projectSpan` (M1); `addListValue`, `getLists` (Task 1); `createProject`, `listProjects` (Task 2); `newProjectSchema`, `NewProjectInput` (Task 2).
- Produces:
  - `GanttRow.kind?: 'group' | 'child'`:
    - `'group'` rows draw a thin summary bar with the class `gantt-summary` and never call `onRowClick`.
    - `'child'` rows have an indented label.
  - `groupedPortfolioRows(projects: ProjectRecord[]): GanttRow[]`:
    - Each main project gives a group row with id `group-<mainProjectId>`, followed by its projects as `kind: 'child'`.
    - Groups are ordered by the first project that belongs to them. The input arrives sorted by start date.
    - Standalone projects come last and have no `kind`.
  - `transaction(db, fn)`: when a transaction is already open, it just runs `fn` inside it.
  - `server/demoData.ts`:
    - `type DemoProject`: a `NewProjectInput` that names its list values (`mainProject`, `projectType`, `goal`, `department`) instead of giving ids.
    - `toProjectInput(demo, idFor): NewProjectInput`
    - `seedDemo(db, cal): number`
    - `DEMO_PROJECTS: DemoProject[]`
  - Main projects in the demo data:
    - **Digital Services:** Customer Portal Revamp, E-Services Mobile App.
    - **Records Modernisation:** Legacy Archive Migration, Case Management System.
    - **Standalone:** HR Self-Service, Internal Reporting Dashboard.

- [ ] **Step 1: Write the failing tests**

Append to the `describe('Gantt', ...)` block in `client/gantt/Gantt.test.tsx`:

```tsx
  it('draws a group row with a summary bar that does not open anything', async () => {
    const onRowClick = vi.fn();
    const grouped: GanttRow[] = [
      { id: 'g', label: 'Digital', kind: 'group', bars: [{ id: 'g', start: '2026-01-01', end: '2026-01-05', color: 'currentColor' }] },
      { ...rows[0], kind: 'child' },
    ];
    render(<Gantt rows={grouped} range={range} width={300} onRowClick={onRowClick} />);
    expect(screen.getByTestId('gantt-bar-g').querySelector('rect')).toHaveClass('gantt-summary');
    await userEvent.click(screen.getByTestId('gantt-row-g'));
    expect(onRowClick).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId('gantt-row-a'));
    expect(onRowClick).toHaveBeenCalledWith('a');
  });
```

In `client/gantt/rows.test.ts`, change the import from `./rows` to also bring in `groupedPortfolioRows`, then append inside `describe('rows', ...)`:

```ts
  it('groups projects under their main project with a summary bar, standalone projects last', () => {
    const phase = (start: string, end: string) => [{ id: 1, name: 'Development', order: 0, durationDays: 5, start, end }];
    const digital = { id: 20, name: 'Digital' };
    const a = sampleProject({ id: 1, name: 'A', mainProject: digital, phases: phase('2026-02-02', '2026-02-06') });
    const b = sampleProject({ id: 2, name: 'B', mainProject: null, phases: phase('2026-01-05', '2026-01-09') });
    const c = sampleProject({ id: 3, name: 'C', mainProject: digital, phases: phase('2026-03-02', '2026-03-20') });

    const rows = groupedPortfolioRows([a, b, c]);
    expect(rows.map((r) => [r.id, r.kind])).toEqual([
      ['group-20', 'group'],
      ['1', 'child'],
      ['3', 'child'],
      ['2', undefined],
    ]);
    expect(rows[0].label).toBe('Digital');
    expect(rows[0].bars).toEqual([
      expect.objectContaining({ id: 'group-20', start: '2026-02-02', end: '2026-03-20' }),
    ]);
  });
```

Append inside `describe('PortfolioPage', ...)` in `client/pages/present/PortfolioPage.test.tsx`:

```tsx
  it('groups projects under their main project, and a group row does not open anything', async () => {
    mockFetch({
      'GET /api/portfolio?year=2026': () => ({
        body: {
          year: 2026,
          today: '2026-09-24',
          stats: { active: 1, finishedThisYear: 0, startingThisYear: 0 },
          projects: [sampleProject({ mainProject: { id: 20, name: 'Digital Services' } })],
        },
      }),
    });
    renderPage();
    const group = await screen.findByTestId('gantt-row-group-20');
    expect(group).toHaveTextContent('Digital Services');
    await userEvent.click(group);
    expect(screen.queryByText('Focus opened')).toBeNull();
    await userEvent.click(screen.getByTestId('gantt-row-1'));
    expect(await screen.findByText('Focus opened')).toBeInTheDocument();
  });
```

Append inside `describe('migrate', ...)` in `server/db.test.ts`, after adding `openDb, transaction` to its import from `./db`:

```ts
  it('nests transactions: an error in the outer one also undoes the inner work', () => {
    const db = openDb(':memory:');
    expect(() =>
      transaction(db, () => {
        transaction(db, () => db.prepare("INSERT INTO settings (key, value) VALUES ('a', '1')").run());
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect({ ...db.prepare('SELECT COUNT(*) AS n FROM settings').get() }).toEqual({ n: 0 });
  });
```

Replace `server/demoData.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_CALENDAR } from '../shared/calendar';
import { newProjectSchema } from '../shared/schemas';
import { openDb } from './db';
import { DEMO_PROJECTS, seedDemo, toProjectInput } from './demoData';
import { getLists } from './lists/repo';
import { listProjects } from './projects/repo';

describe('DEMO_PROJECTS', () => {
  it('are all valid projects with unique names', () => {
    expect(DEMO_PROJECTS.length).toBeGreaterThanOrEqual(6);
    for (const demo of DEMO_PROJECTS) {
      expect(newProjectSchema.safeParse(toProjectInput(demo, () => 1)).success).toBe(true);
    }
    expect(new Set(DEMO_PROJECTS.map((p) => p.name)).size).toBe(DEMO_PROJECTS.length);
  });
});

describe('seedDemo', () => {
  it('adds every demo project with its details, grouping some under main projects', () => {
    const db = openDb(':memory:');
    expect(seedDemo(db, DEFAULT_CALENDAR)).toBe(DEMO_PROJECTS.length);

    const projects = listProjects(db);
    expect(projects).toHaveLength(DEMO_PROJECTS.length);
    const groups = new Set(projects.map((p) => p.mainProject?.name).filter(Boolean));
    expect(groups).toEqual(new Set(['Digital Services', 'Records Modernisation']));
    expect(projects.find((p) => p.name === 'Customer Portal Revamp')).toMatchObject({
      projectType: { name: 'Customer' },
      department: { name: 'Customer Service' },
      priority: 'high',
    });
    expect(projects.find((p) => p.name === 'Customer Portal Revamp')!.scopeItems.length).toBeGreaterThan(0);

    // The default project types are reused, not duplicated.
    expect(getLists(db).projectType.map((v) => v.name)).toEqual(['Criminal', 'Customer', 'Management']);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run client/gantt client/pages/present server/db.test.ts server/demoData.test.ts`
Expected: FAIL. `groupedPortfolioRows` is not exported, the group row does not exist, a nested `BEGIN` throws "cannot start a transaction within a transaction", and `toProjectInput` is not exported.

- [ ] **Step 3: Let `transaction()` nest in `server/db.ts`**

Replace the `transaction` function with:

```ts
/** Runs fn in a transaction. Inside an already-open transaction it just runs fn, so repo functions can be combined. */
export function transaction<T>(db: DatabaseSync, fn: () => T): T {
  if (db.isTransaction) return fn();
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
```

- [ ] **Step 4: Teach `client/gantt/Gantt.tsx` about group and child rows**

Replace the `GanttRow` interface with:

```ts
export interface GanttRow {
  id: string;
  label: string;
  bars: GanttBar[];
  /** 'group': a heading row with a summary bar that is never clickable. 'child': a row under a group (indented label). */
  kind?: 'group' | 'child';
}
```

Add a constant after `const BAR_H = 20;`:

```ts
const SUMMARY_H = 8;
```

Replace the whole `{rows.map((row, i) => { ... })}` block with:

```tsx
      {rows.map((row, i) => {
        const y = HEADER_H + i * ROW_H;
        const isGroup = row.kind === 'group';
        const clickable = onRowClick !== undefined && !isGroup;
        const barH = isGroup ? SUMMARY_H : BAR_H;
        return (
          <g
            key={row.id}
            data-testid={`gantt-row-${row.id}`}
            className={['gantt-row', isGroup ? 'group' : '', clickable ? 'clickable' : ''].filter(Boolean).join(' ')}
            onClick={clickable ? () => onRowClick?.(row.id) : undefined}
          >
            <rect x={0} y={y} width={totalW} height={ROW_H} className="gantt-row-bg" />
            <text x={row.kind === 'child' ? 22 : 8} y={y + ROW_H / 2 + 4} className="gantt-label">
              <title>{row.label}</title>
              {truncate(row.label, row.kind === 'child' ? 26 : 28)}
            </text>
            {row.bars
              .filter((bar) => bar.end >= range.start && bar.start <= range.end)
              .map((bar) => {
                const s = bar.start < range.start ? range.start : bar.start;
                const e = bar.end > range.end ? range.end : bar.end;
                const x = LABEL_W + scale.x(s);
                const w = Math.max(scale.x(e) + scale.dayWidth - scale.x(s), 2);
                const showLabel = !isGroup && bar.label !== undefined && bar.label.length * APPROX_CHAR_W + 12 < w;
                return (
                  <g key={bar.id} data-testid={`gantt-bar-${bar.id}`}>
                    <rect
                      x={x}
                      y={y + (ROW_H - barH) / 2}
                      width={w}
                      height={barH}
                      rx={isGroup ? 2 : 4}
                      fill={bar.color}
                      className={isGroup ? 'gantt-bar gantt-summary' : 'gantt-bar'}
                    >
                      <title>{bar.title ?? bar.label ?? ''}</title>
                    </rect>
                    {showLabel ? (
                      <text x={x + 6} y={y + ROW_H / 2 + 4} className="gantt-bar-label">{bar.label}</text>
                    ) : null}
                  </g>
                );
              })}
          </g>
        );
      })}
```

- [ ] **Step 5: Add `groupedPortfolioRows` to `client/gantt/rows.ts`**

Add this import below the existing ones:

```ts
import { projectSpan } from '../../shared/scheduler';
```

Add this function after `portfolioRows`:

```ts
/**
 * Portfolio rows grouped by main project: each main project gets a group row with a summary bar from its projects'
 * earliest start to latest end, followed by its projects. Groups appear in the order of their first project (the
 * input is sorted by start date). Standalone projects come last.
 */
export function groupedPortfolioRows(projects: ProjectRecord[]): GanttRow[] {
  const groups = new Map<number, { name: string; members: ProjectRecord[] }>();
  const standalone: ProjectRecord[] = [];
  for (const p of projects) {
    if (!p.mainProject) {
      standalone.push(p);
      continue;
    }
    const group = groups.get(p.mainProject.id) ?? { name: p.mainProject.name, members: [] };
    group.members.push(p);
    groups.set(p.mainProject.id, group);
  }

  const rows: GanttRow[] = [];
  for (const [id, { name, members }] of groups) {
    const rowId = `group-${id}`;
    const span = projectSpan(members.flatMap((m) => m.phases));
    rows.push({
      id: rowId,
      label: name,
      kind: 'group',
      // The summary bar's colour comes from the .gantt-summary CSS rule.
      bars: span ? [{ id: rowId, start: span.start, end: span.end, color: 'currentColor', title: `${name}: ${span.start} → ${span.end}` }] : [],
    });
    rows.push(...portfolioRows(members).map((row) => ({ ...row, kind: 'child' as const })));
  }
  return [...rows, ...portfolioRows(standalone)];
}
```

- [ ] **Step 6: Use it in `client/pages/present/PortfolioPage.tsx`**

Change `import { portfolioRows } from '../../gantt/rows';` to `import { groupedPortfolioRows } from '../../gantt/rows';`. Then change `const rows = data ? portfolioRows(data.projects) : [];` to:

```tsx
  const rows = data ? groupedPortfolioRows(data.projects) : [];
```

- [ ] **Step 7: Replace `server/demoData.ts`**

```ts
import type { DatabaseSync } from 'node:sqlite';
import type { WorkCalendar } from '../shared/calendar';
import { newProjectSchema, type NewProjectInput } from '../shared/schemas';
import type { ListName } from '../shared/types';
import { transaction } from './db';
import { addListValue } from './lists/repo';
import { createProject } from './projects/repo';

/** A demo project names its list values; seedDemo turns the names into ids, creating values when needed. */
export type DemoProject = Omit<NewProjectInput, 'mainProjectId' | 'projectTypeId' | 'goalId' | 'departmentId'> & {
  mainProject?: string;
  projectType?: string;
  goal?: string;
  department?: string;
};

const DIGITALISATION = 'Digitalisation of internal operations';
const CUSTOMER_EXPERIENCE = 'Improve customer experience';

export const DEMO_PROJECTS: DemoProject[] = [
  {
    name: 'Legacy Archive Migration', jiraKey: 'PRJ-099', color: '#64748b', startDate: '2025-09-07',
    priority: 'low', projectManager: 'Omar Haddad', businessOwner: 'Records Office Manager',
    mainProject: 'Records Modernisation', category: 'operational', projectType: 'Management',
    goal: DIGITALISATION, department: 'Records Office',
    requester: { internal: true, external: false }, beneficiary: { employees: true, customers: false },
    background: 'Paper and microfilm archives are stored off-site and take days to retrieve.',
    summary: 'Scan and index the archive and move it into the document management system.',
    scopeItems: [
      { kind: 'scope', text: 'Scan and index the 2010–2020 archive' },
      { kind: 'out-of-scope', text: 'Records older than 2010' },
      { kind: 'objective', text: 'Retrieve any archived record within one working day' },
    ],
    phases: [
      { name: 'Requirements gathering', durationDays: 10 },
      { name: 'Development', durationDays: 50 },
      { name: 'QA', durationDays: 10 },
      { name: 'Go-live', durationDays: 2 },
    ],
  },
  {
    name: 'Customer Portal Revamp', jiraKey: 'PRJ-101', color: '#2563eb', startDate: '2026-01-11',
    priority: 'high', projectManager: 'Sara Ahmed', businessOwner: 'Head of Customer Service',
    mainProject: 'Digital Services', category: 'strategic', projectType: 'Customer',
    goal: CUSTOMER_EXPERIENCE, department: 'Customer Service',
    requester: { internal: true, external: true }, beneficiary: { employees: false, customers: true },
    background: 'The current portal is slow, not mobile friendly, and most requests still end in a phone call.',
    summary: 'Rebuild the customer portal with online payments and self-service tracking.',
    scopeItems: [
      { kind: 'scope', text: 'Online payments' },
      { kind: 'scope', text: 'Request tracking' },
      { kind: 'scope', text: 'Account profile page' },
      { kind: 'out-of-scope', text: 'Native mobile app (see E-Services Mobile App)' },
      { kind: 'problem', text: 'Customers cannot see the status of a request without calling' },
      { kind: 'problem', text: 'Payments are only accepted at the counter' },
      { kind: 'objective', text: 'Cut call-centre volume by 20%' },
      { kind: 'objective', text: 'Take 60% of payments online within a year' },
    ],
    phases: [
      { name: 'Requirements gathering', durationDays: 10 },
      { name: 'Business analysis', durationDays: 10 },
      { name: 'Design', durationDays: 10 },
      { name: 'Development', durationDays: 50 },
      { name: 'QA', durationDays: 15 },
      { name: 'UAT', durationDays: 10 },
      { name: 'Go-live', durationDays: 2 },
    ],
  },
  {
    name: 'HR Self-Service', jiraKey: 'PRJ-102', color: '#16a34a', startDate: '2026-02-01',
    priority: 'medium', projectManager: 'Lina Karim', businessOwner: 'HR Director',
    category: 'operational', projectType: 'Management', goal: DIGITALISATION, department: 'Human Resources',
    requester: { internal: true, external: false }, beneficiary: { employees: true, customers: false },
    background: 'Leave requests and certificates are handled by email and paper forms.',
    summary: 'Let employees request leave and certificates online.',
    scopeItems: [
      { kind: 'scope', text: 'Leave requests and approvals' },
      { kind: 'scope', text: 'Salary certificate requests' },
      { kind: 'objective', text: 'No paper leave forms' },
    ],
    phases: [
      { name: 'Requirements gathering', durationDays: 8 },
      { name: 'Business analysis', durationDays: 8 },
      { name: 'Development', durationDays: 40 },
      { name: 'QA', durationDays: 10 },
      { name: 'UAT', durationDays: 5 },
    ],
  },
  {
    name: 'Case Management System', jiraKey: 'PRJ-103', color: '#9333ea', startDate: '2026-03-15',
    priority: 'high', projectManager: 'Yusuf Nasser', businessOwner: 'Legal Affairs Director',
    mainProject: 'Records Modernisation', category: 'strategic', projectType: 'Criminal',
    goal: DIGITALISATION, department: 'Legal Affairs',
    requester: { internal: true, external: false }, beneficiary: { employees: true, customers: false },
    background: 'Case files are tracked in spreadsheets across three teams.',
    summary: 'One system for case intake, assignment, documents and deadlines.',
    scopeItems: [
      { kind: 'scope', text: 'Case intake and assignment' },
      { kind: 'scope', text: 'Document storage per case' },
      { kind: 'problem', text: 'Deadlines are missed because nobody sees the whole caseload' },
      { kind: 'objective', text: 'Every open case has an owner and a next deadline' },
    ],
    phases: [
      { name: 'Requirements gathering', durationDays: 15 },
      { name: 'Business analysis', durationDays: 15 },
      { name: 'Design', durationDays: 10 },
      { name: 'Development', durationDays: 80 },
      { name: 'QA', durationDays: 20 },
      { name: 'UAT', durationDays: 10 },
      { name: 'Go-live', durationDays: 3 },
    ],
  },
  {
    name: 'Internal Reporting Dashboard', jiraKey: 'PRJ-104', color: '#ea580c', startDate: '2026-06-01',
    priority: 'low', projectManager: 'Lina Karim', businessOwner: 'Finance Director',
    category: 'operational', projectType: 'Management', goal: DIGITALISATION, department: 'Finance',
    requester: { internal: true, external: false }, beneficiary: { employees: true, customers: false },
    background: 'Monthly reports are assembled by hand from four systems.',
    summary: 'A dashboard with the monthly figures, refreshed daily.',
    scopeItems: [
      { kind: 'scope', text: 'Budget versus actual by department' },
      { kind: 'objective', text: 'Monthly report ready on the first working day' },
    ],
    phases: [
      { name: 'Requirements gathering', durationDays: 5 },
      { name: 'Development', durationDays: 25 },
      { name: 'QA', durationDays: 8 },
      { name: 'UAT', durationDays: 5 },
    ],
  },
  {
    name: 'E-Services Mobile App', jiraKey: 'PRJ-105', color: '#0891b2', startDate: '2026-10-04',
    priority: 'high', projectManager: 'Sara Ahmed', businessOwner: 'Head of Customer Service',
    mainProject: 'Digital Services', category: 'strategic', projectType: 'Customer',
    goal: CUSTOMER_EXPERIENCE, department: 'Customer Service',
    requester: { internal: false, external: true }, beneficiary: { employees: false, customers: true },
    background: 'Customers have asked for the portal services on their phones.',
    summary: 'A mobile app for the most used e-services.',
    scopeItems: [
      { kind: 'scope', text: 'Request submission and tracking' },
      { kind: 'scope', text: 'Push notifications for status changes' },
      { kind: 'out-of-scope', text: 'Payments (phase two)' },
      { kind: 'objective', text: 'Half of new requests come from the app within a year' },
    ],
    phases: [
      { name: 'Requirements gathering', durationDays: 10 },
      { name: 'Business analysis', durationDays: 10 },
      { name: 'Design', durationDays: 15 },
      { name: 'Development', durationDays: 60 },
      { name: 'QA', durationDays: 15 },
      { name: 'UAT', durationDays: 10 },
    ],
  },
];

export function toProjectInput(demo: DemoProject, idFor: (list: ListName, name: string) => number): NewProjectInput {
  const { mainProject, projectType, goal, department, ...rest } = demo;
  const id = (list: ListName, name?: string) => (name ? idFor(list, name) : null);
  return {
    ...rest,
    mainProjectId: id('mainProject', mainProject),
    projectTypeId: id('projectType', projectType),
    goalId: id('goal', goal),
    departmentId: id('department', department),
  };
}

/** Adds every demo project (and any list values they name) in one transaction. Returns how many were added. */
export function seedDemo(db: DatabaseSync, cal: WorkCalendar): number {
  transaction(db, () => {
    const idFor = (list: ListName, name: string) => addListValue(db, list, name).value.id;
    for (const demo of DEMO_PROJECTS) createProject(db, cal, newProjectSchema.parse(toProjectInput(demo, idFor)));
  });
  return DEMO_PROJECTS.length;
}
```

- [ ] **Step 8: Replace `server/seed.ts`**

```ts
import { mkdirSync } from 'node:fs';
import { openDb } from './db';
import { seedDemo } from './demoData';
import { getCalendar } from './settings';

mkdirSync('data', { recursive: true });
const db = openDb('data/pm.db');
const { n } = db.prepare('SELECT COUNT(*) AS n FROM projects').get() as unknown as { n: number };

if (n > 0 && !process.argv.includes('--force')) {
  console.log(`The database already has ${n} project(s), so nothing was added.`);
  console.log('Run "npm run seed -- --force" to add the demo projects anyway.');
} else {
  console.log(`Added ${seedDemo(db, getCalendar(db))} demo projects.`);
}
```

- [ ] **Step 9: Add the group-row styles to `client/styles.css`** (append after the `.gantt-today` rule)

```css
.gantt-row.group .gantt-row-bg { fill: var(--surface-2); }
.gantt-row.group .gantt-label { font-weight: 650; }
.gantt-summary { fill: var(--ink); stroke: none; }
```

- [ ] **Step 10: Run the tests to verify they pass**

Run: `npx vitest run client/gantt client/pages/present server/db.test.ts server/demoData.test.ts`
Expected: PASS.

- [ ] **Step 11: Run the whole suite and the type check**

Run: `npm test` → Expected: PASS (all tests).
Run: `npm run typecheck` → Expected: exit code 0.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: portfolio grouped by main project, demo projects with full details"
```

---

### Task 9: Two project managers — business PM with optional UAE mobile and email (M3 demo feedback, 2026-09-25)

The user reviewed the M3 build and explained that every project has **two** project managers who run it together:
- **Project manager (tech):** from the technical team (the user's side). This is the existing `projectManager` field, relabelled.
- **Business project manager:** the business owner's representative. This is a new field, with an optional **UAE mobile** and an optional **email**.

**Business owner** stays as it is: the department side that owns the business for the project. All three fields stay free text until M4 (Resources).

The phone accepts `+971`, `00971`, `971` or `0` in front of `5X XXX XXXX`, with any spaces or dashes. It is stored and shown as `+971 5X XXX XXXX`. Anything else is refused with "Enter a UAE mobile number, e.g. +971 50 123 4567".

**Files:**
- Modify: `shared/schemas.ts`, `shared/types.ts`, `server/db.ts` (append migration 3), `server/projects/repo.ts`
- Modify: `client/pages/manage/projectDraft.ts`, `client/testing/mockFetch.ts`, `client/pages/manage/ProjectPage.tsx`, `client/styles.css`, `server/demoData.ts`
- Modify (replace whole file): `client/pages/manage/DetailsFields.tsx`
- Test: `shared/schemas.test.ts`, `server/projects/details.test.ts`, `client/pages/manage/CreateProjectPage.test.tsx`, `client/pages/manage/EditProjectPage.test.tsx`, `client/pages/manage/ProjectPage.test.tsx`, `server/demoData.test.ts`

**Interfaces:**
- Consumes: `projectDetailsSchema`, `optionalText` (Task 2); `DETAIL_COLUMNS`, `detailValues`, `toProject` (Task 2); `DetailsDraft`, `STEP_FIELDS` (Task 5); `ProjectPage` Details card (Task 6); `DEMO_PROJECTS` (Task 8).
- Produces:
  - `shared/schemas.ts`: `normalizeUaeMobile(input: string): string | null`. `projectDetailsSchema` gains three optional fields:
    - `businessPmName` (text, blank → null)
    - `businessPmPhone` (UAE mobile, normalised, blank → null)
    - `businessPmEmail` (valid email, blank → null, "Enter a valid email address")
  - `ProjectRecord` gains `businessPmName: string | null`, `businessPmPhone: string | null` and `businessPmEmail: string | null`.
  - Migration 3 adds the columns `business_pm_name`, `business_pm_phone` and `business_pm_email`.
  - Wizard Step 1 gets a new "People" card with these labels:
    - "Project manager (tech)" (was "Project manager")
    - "Business owner"
    - "Business project manager"
    - "Business PM phone (UAE mobile)"
    - "Business PM email"
  - Project page Details:
    - "Project manager (tech)".
    - "Business project manager", with the phone as a `tel:` link and the email as a `mailto:` link when set.

- [ ] **Step 1: Write the failing tests**

Append to `shared/schemas.test.ts` (add `normalizeUaeMobile` to its import from `./schemas`):

```ts
describe('normalizeUaeMobile', () => {
  it('accepts the usual ways of writing a UAE mobile and stores one format', () => {
    for (const input of ['+971 50 123 4567', '+971501234567', '00971 50 123 4567', '971-50-123-4567', '050 123 4567', '0501234567']) {
      expect(normalizeUaeMobile(input)).toBe('+971 50 123 4567');
    }
  });

  it('rejects landlines, short numbers and other countries', () => {
    for (const input of ['04 123 4567', '+971 4 123 4567', '050 123 456', '+44 7700 900123', 'abc']) {
      expect(normalizeUaeMobile(input)).toBeNull();
    }
  });
});
```

Append inside `describe('project details', ...)` in `server/projects/details.test.ts`:

```ts
  it('stores the business project manager with a normalised UAE mobile, every part optional', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { ...base, businessPmName: 'Mariam Al Suwaidi', businessPmPhone: '050 123 4567', businessPmEmail: ' mariam@example.com ' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      businessPmName: 'Mariam Al Suwaidi',
      businessPmPhone: '+971 50 123 4567',
      businessPmEmail: 'mariam@example.com',
    });
    const none = (await app.inject({ method: 'POST', url: '/api/projects', payload: base })).json();
    expect(none).toMatchObject({ businessPmName: null, businessPmPhone: null, businessPmEmail: null });
  });

  it('rejects a phone that is not a UAE mobile and a malformed email', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/projects', payload: { ...base, businessPmPhone: '04 123 4567', businessPmEmail: 'mariam@' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().issues).toEqual([
      { path: 'businessPmPhone', message: 'Enter a UAE mobile number, e.g. +971 50 123 4567' },
      { path: 'businessPmEmail', message: 'Enter a valid email address' },
    ]);
  });
```

In `client/pages/manage/CreateProjectPage.test.tsx`, test `'creates a project with its details, scope and phases'`:
- Replace the line `await user.type(screen.getByLabelText('Project manager'), 'Sara Ahmed');` with:

```tsx
    await user.type(screen.getByLabelText('Project manager (tech)'), 'Sara Ahmed');
    await user.type(screen.getByLabelText('Business project manager'), 'Mariam Al Suwaidi');
    await user.type(screen.getByLabelText('Business PM phone (UAE mobile)'), '050 123 4567');
    await user.type(screen.getByLabelText('Business PM email'), 'mariam@example.com');
```

- In the same test, add these three properties to the `expect(sent).toMatchObject({ ... })` object. The client sends the phone as typed, and the server normalises it.

```tsx
      businessPmName: 'Mariam Al Suwaidi',
      businessPmPhone: '050 123 4567',
      businessPmEmail: 'mariam@example.com',
```

Then add this test inside the same `describe`:

```tsx
  it('will not move on with a business PM phone that is not a UAE mobile', async () => {
    mockFetch(baseRoutes);
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('Project name'), 'Portal');
    await user.type(screen.getByLabelText('Business PM phone (UAE mobile)'), '04 123 4567');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Enter a UAE mobile number, e.g. +971 50 123 4567')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Basic info' })).toBeInTheDocument();
  });
```

In `client/pages/manage/EditProjectPage.test.tsx`, replace every `getByLabelText('Project manager')` with `getByLabelText('Project manager (tech)')`.

Append inside `describe('ProjectPage', ...)` in `client/pages/manage/ProjectPage.test.tsx`:

```tsx
  it("shows both project managers, with the business PM's phone and email as links", async () => {
    mockFetch({
      'GET /api/projects/1': () => ({
        body: sampleProject({
          projectManager: 'Sara Ahmed',
          businessPmName: 'Mariam Al Suwaidi',
          businessPmPhone: '+971 50 123 4567',
          businessPmEmail: 'mariam@example.com',
        }),
      }),
      'GET /api/settings/calendar': () => ({ body: { weekendDays: [0, 6], holidays: [] } }),
    });
    renderAt('/manage/projects/1');
    expect(await screen.findByText('Mariam Al Suwaidi')).toBeInTheDocument();
    expect(screen.getByText('Project manager (tech)')).toBeInTheDocument();
    expect(screen.getByText('Sara Ahmed')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '+971 50 123 4567' })).toHaveAttribute('href', 'tel:+971501234567');
    expect(screen.getByRole('link', { name: 'mariam@example.com' })).toHaveAttribute('href', 'mailto:mariam@example.com');
  });
```

In `server/demoData.test.ts`, inside the `seedDemo` test, add after the `Customer Portal Revamp` `toMatchObject` assertion:

```ts
    expect(projects.find((p) => p.name === 'Customer Portal Revamp')).toMatchObject({
      businessPmName: 'Mariam Al Suwaidi',
      businessPmPhone: '+971 50 123 4567',
      businessPmEmail: 'mariam.alsuwaidi@example.com',
    });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run shared/schemas.test.ts server/projects/details.test.ts server/demoData.test.ts client/pages/manage`
Expected: FAIL.
- `normalizeUaeMobile` is not exported.
- The business PM fields are `undefined` in responses.
- The labels "Project manager (tech)" and "Business project manager" cannot be found.

- [ ] **Step 3: Add the phone and email rules and the fields to `shared/schemas.ts`**

Add after the `optionalId` constant:

```ts
/**
 * Normalises a UAE mobile number to "+971 5X XXX XXXX". Accepts +971, 00971, 971 or 0 in front of 5X XXX XXXX, with
 * any spaces or dashes. Returns null when the input is not a UAE mobile number.
 */
export function normalizeUaeMobile(input: string): string | null {
  const digits = input.replace(/[\s-]/g, '');
  const match = /^(?:\+971|00971|971|0)(5\d)(\d{3})(\d{4})$/.exec(digits);
  return match ? `+971 ${match[1]} ${match[2]} ${match[3]}` : null;
}

/** Optional UAE mobile: blank becomes null, anything else must be a UAE mobile and is stored normalised. */
const optionalUaeMobile = z
  .string()
  .trim()
  .max(30)
  .nullish()
  .transform((v, ctx) => {
    if (!v) return null;
    const normalized = normalizeUaeMobile(v);
    if (normalized === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a UAE mobile number, e.g. +971 50 123 4567' });
      return z.NEVER;
    }
    return normalized;
  });

/** Optional email: blank becomes null. */
const optionalEmail = z
  .string()
  .trim()
  .max(200)
  .nullish()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || z.string().email().safeParse(v).success, 'Enter a valid email address');
```

In `projectDetailsSchema`, add these three fields directly after `businessOwner: optionalText(200),`:

```ts
  businessPmName: optionalText(200),
  businessPmPhone: optionalUaeMobile,
  businessPmEmail: optionalEmail,
```

- [ ] **Step 4: Add the fields to `ProjectRecord` in `shared/types.ts`**

Directly after `businessOwner: string | null;`:

```ts
  /** The business owner's representative, who runs the project together with the tech project manager. */
  businessPmName: string | null;
  /** Normalised UAE mobile, "+971 5X XXX XXXX". */
  businessPmPhone: string | null;
  businessPmEmail: string | null;
```

- [ ] **Step 5: Append migration 3 to `server/db.ts`** (a new array entry after migration 2)

```ts
  `
  ALTER TABLE projects ADD COLUMN business_pm_name TEXT;
  ALTER TABLE projects ADD COLUMN business_pm_phone TEXT;
  ALTER TABLE projects ADD COLUMN business_pm_email TEXT;
  `,
```

- [ ] **Step 6: Store and read the fields in `server/projects/repo.ts`**

- In `interface ProjectRow`, add after `summary: string;`:

```ts
  business_pm_name: string | null;
  business_pm_phone: string | null;
  business_pm_email: string | null;
```

- In `DETAIL_COLUMNS`, append `'business_pm_name', 'business_pm_phone', 'business_pm_email'` after `'summary'`.
- In `detailValues`, append `d.businessPmName, d.businessPmPhone, d.businessPmEmail` after `d.summary`, in that order. The two lists must line up one to one.
- In `toProject`, add after `businessOwner: row.business_owner,`:

```ts
    businessPmName: row.business_pm_name,
    businessPmPhone: row.business_pm_phone,
    businessPmEmail: row.business_pm_email,
```

- [ ] **Step 7: Carry the fields through the form state in `client/pages/manage/projectDraft.ts`**

- In `interface DetailsDraft`, add after `businessOwner: string;`:

```ts
  businessPmName: string;
  businessPmPhone: string;
  businessPmEmail: string;
```

- In `emptyDetails()`, add after `businessOwner: '',`:

```ts
    businessPmName: '',
    businessPmPhone: '',
    businessPmEmail: '',
```

- In `detailsFromProject()`, add after `businessOwner: p.businessOwner ?? '',`:

```ts
    businessPmName: p.businessPmName ?? '',
    businessPmPhone: p.businessPmPhone ?? '',
    businessPmEmail: p.businessPmEmail ?? '',
```

- In `STEP_FIELDS`, add `'businessPmName', 'businessPmPhone', 'businessPmEmail'` to the first (Step 1) array.

In `client/testing/mockFetch.ts`, in `sampleProject`, add after `businessOwner: null,`:

```ts
    businessPmName: null,
    businessPmPhone: null,
    businessPmEmail: null,
```

- [ ] **Step 8: Replace `client/pages/manage/DetailsFields.tsx`** (Basic info is split, and the people fields move to a new "People" card)

```tsx
import type { Category, ListValue, Lists, Priority } from '../../../shared/types';
import { OptionPicker } from '../../components/OptionPicker';
import { CATEGORY_LABEL, PRIORITY_LABEL } from './labels';
import type { DetailsDraft } from './projectDraft';

interface DetailsFieldsProps {
  value: DetailsDraft;
  onChange: (patch: Partial<DetailsDraft>) => void;
  lists: Lists;
  onListAdded: (value: ListValue) => void;
}

/** Wizard Step 1: basic info, people and classification. Also used on the Edit details page. */
export function DetailsFields({ value, onChange, lists, onListAdded }: DetailsFieldsProps) {
  return (
    <>
      <section className="card">
        <h2>Basic info</h2>
        <div className="form-grid">
          <label>
            Project name
            <input value={value.name} onChange={(e) => onChange({ name: e.target.value })} />
          </label>
          <label>
            Jira key
            <input value={value.jiraKey} onChange={(e) => onChange({ jiraKey: e.target.value })} placeholder="PRJ-123" />
          </label>
          <label>
            Priority
            <select value={value.priority} onChange={(e) => onChange({ priority: e.target.value as Priority })}>
              {Object.entries(PRIORITY_LABEL).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            Colour
            <input type="color" value={value.color} onChange={(e) => onChange({ color: e.target.value })} />
          </label>
        </div>
      </section>

      <section className="card">
        <h2>People</h2>
        <div className="form-grid">
          <label>
            Project manager (tech)
            <input value={value.projectManager} onChange={(e) => onChange({ projectManager: e.target.value })} />
          </label>
          <label>
            Business owner
            <input value={value.businessOwner} onChange={(e) => onChange({ businessOwner: e.target.value })} />
          </label>
          <label>
            Business project manager
            <input value={value.businessPmName} onChange={(e) => onChange({ businessPmName: e.target.value })} />
          </label>
          <label>
            Business PM phone (UAE mobile)
            <input
              type="tel"
              value={value.businessPmPhone}
              onChange={(e) => onChange({ businessPmPhone: e.target.value })}
              placeholder="+971 50 123 4567"
            />
          </label>
          <label>
            Business PM email
            <input
              type="email"
              value={value.businessPmEmail}
              onChange={(e) => onChange({ businessPmEmail: e.target.value })}
              placeholder="name@example.com"
            />
          </label>
        </div>
      </section>

      <section className="card">
        <h2>Classification</h2>
        <div className="form-grid">
          <OptionPicker
            label="Main project"
            list="mainProject"
            options={lists.mainProject}
            value={value.mainProjectId}
            onChange={(id) => onChange({ mainProjectId: id })}
            onAdded={onListAdded}
            noneLabel="Standalone (no main project)"
            addLabel="+ Add new main project…"
          />
          <label>
            Categorisation
            <select
              value={value.category ?? ''}
              onChange={(e) => onChange({ category: e.target.value === '' ? null : (e.target.value as Category) })}
            >
              <option value="">Not set</option>
              {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </label>
          <OptionPicker
            label="Project type"
            list="projectType"
            options={lists.projectType}
            value={value.projectTypeId}
            onChange={(id) => onChange({ projectTypeId: id })}
            onAdded={onListAdded}
            noneLabel="Not set"
            addLabel="Other…"
          />
          <OptionPicker
            label="Goal"
            list="goal"
            options={lists.goal}
            value={value.goalId}
            onChange={(id) => onChange({ goalId: id })}
            onAdded={onListAdded}
            noneLabel="Not set"
            addLabel="Other…"
          />
          <OptionPicker
            label="Business user (department)"
            list="department"
            options={lists.department}
            value={value.departmentId}
            onChange={(id) => onChange({ departmentId: id })}
            onAdded={onListAdded}
            noneLabel="Not set"
            addLabel="+ Add new department…"
          />
        </div>

        <div className="check-groups">
          <fieldset className="check-group">
            <legend>Requester</legend>
            <label className="check">
              <input
                type="checkbox"
                checked={value.requester.internal}
                onChange={(e) => onChange({ requester: { ...value.requester, internal: e.target.checked } })}
              />
              Internal
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={value.requester.external}
                onChange={(e) => onChange({ requester: { ...value.requester, external: e.target.checked } })}
              />
              External
            </label>
          </fieldset>
          <fieldset className="check-group">
            <legend>Beneficiary</legend>
            <label className="check">
              <input
                type="checkbox"
                checked={value.beneficiary.employees}
                onChange={(e) => onChange({ beneficiary: { ...value.beneficiary, employees: e.target.checked } })}
              />
              Employees
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={value.beneficiary.customers}
                onChange={(e) => onChange({ beneficiary: { ...value.beneficiary, customers: e.target.checked } })}
              />
              Customers
            </label>
          </fieldset>
        </div>
      </section>
    </>
  );
}
```

- [ ] **Step 9: Show both managers on the project page (`client/pages/manage/ProjectPage.tsx`)**

Replace:

```tsx
          <Detail label="Project manager">{p.projectManager ?? '—'}</Detail>
          <Detail label="Business owner">{p.businessOwner ?? '—'}</Detail>
```

with:

```tsx
          <Detail label="Project manager (tech)">{p.projectManager ?? '—'}</Detail>
          <Detail label="Business owner">{p.businessOwner ?? '—'}</Detail>
          <Detail label="Business project manager">
            <span>{p.businessPmName ?? '—'}</span>
            {p.businessPmPhone ? (
              <a className="detail-line" href={`tel:${p.businessPmPhone.replace(/\s/g, '')}`}>{p.businessPmPhone}</a>
            ) : null}
            {p.businessPmEmail ? (
              <a className="detail-line" href={`mailto:${p.businessPmEmail}`}>{p.businessPmEmail}</a>
            ) : null}
          </Detail>
```

Append to `client/styles.css` after the `.details-grid dd` rule:

```css
.detail-line { display: block; overflow-wrap: anywhere; }
```

- [ ] **Step 10: Give the demo projects business PMs (`server/demoData.ts`)**

In each `DEMO_PROJECTS` entry, add the matching line directly after its `businessOwner: …` property:

| Project | Add after `businessOwner` |
|---|---|
| Legacy Archive Migration | `businessPmName: 'Khalid Al Mansoori',` |
| Customer Portal Revamp | `businessPmName: 'Mariam Al Suwaidi', businessPmPhone: '+971 50 123 4567', businessPmEmail: 'mariam.alsuwaidi@example.com',` |
| HR Self-Service | `businessPmName: 'Noura Al Hammadi', businessPmPhone: '055 234 5678',` |
| Case Management System | `businessPmName: 'Ahmed Al Zaabi', businessPmEmail: 'ahmed.alzaabi@example.com',` |
| Internal Reporting Dashboard | nothing (its business PM is left empty on purpose) |
| E-Services Mobile App | `businessPmName: 'Mariam Al Suwaidi', businessPmPhone: '+971 50 123 4567', businessPmEmail: 'mariam.alsuwaidi@example.com',` |

- [ ] **Step 11: Run the tests to verify they pass**

Run: `npx vitest run shared/schemas.test.ts server/projects/details.test.ts server/demoData.test.ts client/pages/manage`
Expected: PASS.

- [ ] **Step 12: Run the whole suite and the type check**

Run: `npm test` → Expected: PASS (all tests).
Run: `npm run typecheck` → Expected: exit code 0.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat: business project manager with optional UAE mobile and email"
```

---

### Task 10: Phase names from an editable dropdown, new default phases (M3 demo feedback, 2026-09-25)

This task makes three changes:
- Phase names are **chosen from a dropdown** over a new editable **Phases** list, instead of typed as free text. "Other…" adds a new name to the list, the same way project types and goals work. The Phases list is managed in Settings like the other four lists.
- New projects start with the user's nine phases:
  1. Requirements gathering
  2. Business analysis
  3. Development plan
  4. Development
  5. QA
  6. UAT
  7. Security testing
  8. Deployment
  9. Launch
- "Design" stays in the list, but it is not a default.

Phases keep storing their **name**, not a list id, because the Gantt colours, the scheduler and every M1/M2 screen key off the name. So a Phases list value works differently from the other lists:
- It counts as "in use" when any project has a phase with that name, ignoring case.
- Renaming it in Settings also renames the matching phases on every project.

The phase colour palette grows from 8 to 10 colours, so every standard phase, plus Design, gets its own colour. Neighbouring lifecycle phases get clearly different hues.

**Files:**
- Modify: `shared/types.ts` (`LIST_NAMES` gains `'phase'`), `server/db.ts` (append migration 4)
- Modify (replace whole file): `server/lists/repo.ts`, `client/pages/manage/PhasesFields.tsx`, `client/pages/manage/CreateProjectPage.test.tsx`
- Modify: `client/useLists.ts`, `client/testing/mockFetch.ts` (`sampleLists`), `client/gantt/rows.ts`, `client/components/OptionPicker.tsx`, `client/pages/manage/CreateProjectPage.tsx`, `client/pages/manage/SettingsPage.tsx`, `client/styles.css`, `server/demoData.ts`
- Test: `server/lists/lists.test.ts`, `client/gantt/rows.test.ts`, `client/pages/manage/CreateProjectPage.test.tsx`, `server/demoData.test.ts`

**Interfaces:**
- Consumes: `OptionPicker` (Task 4); `useLists` (Task 3); `useReorder`, `moveItem` (Task 3); `ListEditor` (Task 7); `transaction` (Task 8); `seedDemo` (Task 8); the business PM fields (Task 9, which already sit in this test file).
- Produces:
  - `LIST_NAMES = ['mainProject', 'projectType', 'goal', 'department', 'phase']`. Every `Lists` value now has a `phase` array.
  - Migration 4 seeds the `phase` list in this order: Requirements gathering, Business analysis, Development plan, Development, QA, UAT, Security testing, Deployment, Launch, Design.
  - Phases list values:
    - **In use:** `DELETE /api/lists/phase/:id` → 409 `"<name>" is used by N project(s)`, where N counts the distinct projects with a phase of that name.
    - **Rename:** `PUT /api/lists/phase/:id` renames the list value and every project phase with that name, in one transaction.
  - `OptionPicker` gains `hideLabel?: boolean`. The label stays in the accessible name but is visually hidden, using a new `.visually-hidden` class.
  - `PhasesFields` gains the props `phaseOptions: ListValue[]` and `onListAdded(value)`.
    - Each row's name is an `OptionPicker` with label "Phase N name" (hidden), empty choice "Choose a phase…", and add choice "Other…".
    - The inline add input's label is "New phase N name".
  - `DEFAULT_PHASES` is the nine phases, with these working days: 10, 10, 5, 40, 15, 10, 5, 2, 1.
  - `PHASE_PALETTE` has 10 colours. The standard names are Requirements, Analysis, Design, Development plan, Development, QA, UAT, Security testing, Deployment and Launch. "Go-live" is an alias of Launch. Each standard name gets its own colour.
  - Settings shows a fifth editor: "Phases", singular "Phase".
  - Demo project phases use only names from the Phases list, so none shows "Choose a phase…".

- [ ] **Step 1: Write the failing tests**

Append inside `describe('lists API', ...)` in `server/lists/lists.test.ts`:

```ts
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
```

Append inside `describe('phaseColorFor', ...)` in `client/gantt/rows.test.ts`:

```ts
    it('gives every standard phase its own colour, with Go-live the same as Launch', () => {
      const standard = [
        'Requirements gathering', 'Business analysis', 'Design', 'Development plan', 'Development', 'QA', 'UAT',
        'Security testing', 'Deployment', 'Launch',
      ];
      expect(new Set(standard.map((name) => phaseColorFor(name))).size).toBe(standard.length);
      expect(phaseColorFor('Go-live')).toBe(phaseColorFor('Launch'));
    });
```

Append inside the `seedDemo` test in `server/demoData.test.ts`, before its last assertion:

```ts
    // Every demo phase is a name from the Phases list, so the phase dropdowns show it.
    const phaseNames = new Set(getLists(db).phase.map((v) => v.name));
    for (const p of projects) for (const ph of p.phases) expect(phaseNames).toContain(ph.name);
    // Legacy Archive Migration still sits entirely in 2025.
    const legacy = projects.find((p) => p.name === 'Legacy Archive Migration')!;
    expect(legacy.phases[legacy.phases.length - 1].end < '2026-01-01').toBe(true);
```

Replace `client/pages/manage/CreateProjectPage.test.tsx` with the file below. It keeps every Task 5 and Task 9 test, and the phase tests now use the dropdowns.

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router';
import { describe, expect, it } from 'vitest';
import { mockFetch, sampleLists, sampleProject, type MockHandler } from '../../testing/mockFetch';
import { CreateProjectPage } from './CreateProjectPage';

function ProjectStub() {
  const { id } = useParams();
  return <div>Project page {id}</div>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/manage/projects/new']}>
      <Routes>
        <Route path="/manage/projects/new" element={<CreateProjectPage />} />
        <Route path="/manage/projects/:id" element={<ProjectStub />} />
      </Routes>
    </MemoryRouter>,
  );
}

const baseRoutes: Record<string, MockHandler> = {
  'GET /api/settings/calendar': () => ({ body: { weekendDays: [0, 6], holidays: [] } }),
  'GET /api/lists': () => ({ body: sampleLists() }),
};

type User = ReturnType<typeof userEvent.setup>;

async function openPhasesStep(user: User) {
  await user.type(screen.getByLabelText('Project name'), 'Portal');
  await user.click(screen.getByRole('button', { name: 'Next' }));
  await user.click(screen.getByRole('button', { name: 'Next' }));
}

/** The phase dropdowns show their names once the lists have loaded. */
async function phasesLoaded() {
  await waitFor(() => expect(screen.getByLabelText('Phase 1 name')).toHaveDisplayValue('Requirements gathering'));
}

describe('CreateProjectPage wizard', () => {
  it('starts on Basic info and will not move on without a project name', async () => {
    mockFetch(baseRoutes);
    const user = userEvent.setup();
    renderPage();
    expect(screen.getByRole('heading', { name: 'Basic info' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Project name is required')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Basic info' })).toBeInTheDocument();
  });

  it('will not move on with a business PM phone that is not a UAE mobile', async () => {
    mockFetch(baseRoutes);
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('Project name'), 'Portal');
    await user.type(screen.getByLabelText('Business PM phone (UAE mobile)'), '04 123 4567');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Enter a UAE mobile number, e.g. +971 50 123 4567')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Basic info' })).toBeInTheDocument();
  });

  it('keeps what was typed when going back', async () => {
    mockFetch(baseRoutes);
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('Project name'), 'Portal');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: 'Description' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText('Project name')).toHaveValue('Portal');
  });

  it('creates a project with its details, scope and phases', async () => {
    const fetchMock = mockFetch({
      ...baseRoutes,
      'POST /api/projects': () => ({ status: 201, body: sampleProject({ id: 7 }) }),
    });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Project name'), 'Portal');
    await user.type(screen.getByLabelText('Project manager (tech)'), 'Sara Ahmed');
    await user.type(screen.getByLabelText('Business project manager'), 'Mariam Al Suwaidi');
    await user.type(screen.getByLabelText('Business PM phone (UAE mobile)'), '050 123 4567');
    await user.type(screen.getByLabelText('Business PM email'), 'mariam@example.com');
    await screen.findByRole('option', { name: 'Customer' });
    await user.selectOptions(screen.getByLabelText('Project type'), 'Customer');
    await user.selectOptions(screen.getByLabelText('Main project'), 'Digital Services');
    await user.click(screen.getByRole('checkbox', { name: 'Internal' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));

    await user.type(screen.getByLabelText('Background'), 'The portal is slow.');
    await user.type(screen.getByLabelText('New scope item'), 'Online payments{Enter}');
    expect(screen.getByLabelText('Scope item 1')).toHaveValue('Online payments');
    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByRole('heading', { name: 'Phases' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create project' }));

    expect(await screen.findByText('Project page 7')).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([url, init]) => url === '/api/projects' && init?.method === 'POST');
    const sent = JSON.parse(post![1]!.body as string);
    expect(sent).toMatchObject({
      name: 'Portal',
      projectManager: 'Sara Ahmed',
      businessPmName: 'Mariam Al Suwaidi',
      businessPmPhone: '050 123 4567',
      businessPmEmail: 'mariam@example.com',
      projectTypeId: 2,
      mainProjectId: 20,
      requester: { internal: true, external: false },
      background: 'The portal is slow.',
      scopeItems: [{ kind: 'scope', text: 'Online payments' }],
      color: '#3b82f6',
    });
    expect(sent.phases.map((p: { name: string }) => p.name)).toEqual([
      'Requirements gathering', 'Business analysis', 'Development plan', 'Development', 'QA', 'UAT',
      'Security testing', 'Deployment', 'Launch',
    ]);
  });

  it('adds a new department from the dropdown and selects it', async () => {
    mockFetch({
      ...baseRoutes,
      'POST /api/lists/department': () => ({ status: 201, body: { id: 31, list: 'department', name: 'Legal', order: 1 } }),
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('option', { name: 'Finance' });
    await user.selectOptions(screen.getByLabelText('Business user (department)'), '+ Add new department…');
    await user.type(screen.getByLabelText('New business user (department)'), 'Legal');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByRole('option', { name: 'Legal' })).toBeInTheDocument();
    expect(screen.getByLabelText('Business user (department)')).toHaveValue('31');
  });

  it('sends the user back to the step with a server-side error', async () => {
    mockFetch({
      ...baseRoutes,
      'POST /api/projects': () => ({
        status: 400,
        body: { error: 'Invalid project', issues: [{ path: 'projectTypeId', message: 'Unknown project type' }] },
      }),
    });
    const user = userEvent.setup();
    renderPage();
    await openPhasesStep(user);
    await user.click(screen.getByRole('button', { name: 'Create project' }));
    expect(await screen.findByText('Unknown project type')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Basic info' })).toBeInTheDocument();
  });

  it('starts with the nine standard phases, shown in dropdowns, and previews them', async () => {
    mockFetch(baseRoutes);
    const user = userEvent.setup();
    renderPage();
    await openPhasesStep(user);
    await phasesLoaded();
    const shown = Array.from({ length: 9 }, (_, i) =>
      (screen.getByLabelText(`Phase ${i + 1} name`) as HTMLSelectElement).selectedOptions[0].textContent);
    expect(shown).toEqual([
      'Requirements gathering', 'Business analysis', 'Development plan', 'Development', 'QA', 'UAT',
      'Security testing', 'Deployment', 'Launch',
    ]);
    expect(screen.queryByLabelText('Phase 10 name')).toBeNull();
    expect(await screen.findByTestId('gantt-row-8')).toBeInTheDocument();
  });

  it('picks a phase from the list, and adds a new one with Other…', async () => {
    mockFetch({
      ...baseRoutes,
      'POST /api/lists/phase': () => ({ status: 201, body: { id: 60, list: 'phase', name: 'Data migration', order: 10 } }),
    });
    const user = userEvent.setup();
    renderPage();
    await openPhasesStep(user);
    await phasesLoaded();

    await user.selectOptions(screen.getByLabelText('Phase 3 name'), 'Design');
    expect(screen.getByLabelText('Phase 3 name')).toHaveDisplayValue('Design');

    await user.selectOptions(screen.getByLabelText('Phase 1 name'), 'Other…');
    await user.type(screen.getByLabelText('New phase 1 name'), 'Data migration');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(screen.getByLabelText('Phase 1 name')).toHaveDisplayValue('Data migration'));
    expect(await screen.findByTestId('gantt-row-0')).toHaveTextContent('Data migration');
  });

  it('adds and removes phases', async () => {
    mockFetch(baseRoutes);
    const user = userEvent.setup();
    renderPage();
    await openPhasesStep(user);
    await phasesLoaded();
    await user.click(screen.getByRole('button', { name: 'Add phase' }));
    expect(screen.getByLabelText('Phase 10 name')).toHaveDisplayValue('Choose a phase…');
    await user.click(screen.getByRole('button', { name: 'Remove phase 10' }));
    expect(screen.queryByLabelText('Phase 10 name')).toBeNull();
  });

  it('reorders phases via drag-and-drop, updating the preview order', async () => {
    mockFetch(baseRoutes);
    const user = userEvent.setup();
    renderPage();
    await openPhasesStep(user);
    await phasesLoaded();

    const row1 = screen.getByLabelText('Reorder phase 1').closest('.phase-row') as HTMLElement;
    const dataTransfer = { setData: () => {}, getData: () => '', effectAllowed: '' };
    fireEvent.dragStart(screen.getByLabelText('Reorder phase 2'), { dataTransfer });
    fireEvent.dragOver(row1, { dataTransfer });
    fireEvent.drop(row1, { dataTransfer });

    expect(screen.getByLabelText('Phase 1 name')).toHaveDisplayValue('Business analysis');
    expect(screen.getByLabelText('Phase 2 name')).toHaveDisplayValue('Requirements gathering');
    expect(await screen.findByTestId('gantt-row-0')).toHaveTextContent('Business analysis');
  });

  it('reorders phases via keyboard, moving focus with the phase', async () => {
    mockFetch(baseRoutes);
    const user = userEvent.setup();
    renderPage();
    await openPhasesStep(user);
    await phasesLoaded();

    const handle2 = screen.getByLabelText('Reorder phase 2');
    handle2.focus();
    fireEvent.keyDown(handle2, { key: 'ArrowUp' });

    expect(screen.getByLabelText('Phase 1 name')).toHaveDisplayValue('Business analysis');
    expect(await screen.findByTestId('gantt-row-0')).toHaveTextContent('Business analysis');
    expect(screen.getByLabelText('Reorder phase 1')).toHaveFocus();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run server/lists client/gantt/rows.test.ts server/demoData.test.ts client/pages/manage/CreateProjectPage.test.tsx`
Expected: FAIL.
- `lists.phase` is undefined.
- "Development plan" and "Launch" fall back to hashed colours, and some of those collide.
- The demo phase "Go-live" is not in the list.
- The phase names are still text inputs, so `toHaveDisplayValue` does not match.

- [ ] **Step 3: Add `'phase'` to the lists (`shared/types.ts`, `server/db.ts`, `client/useLists.ts`, `client/testing/mockFetch.ts`)**

In `shared/types.ts`, change `LIST_NAMES` to:

```ts
export const LIST_NAMES = ['mainProject', 'projectType', 'goal', 'department', 'phase'] as const;
```

Append migration 4 to `MIGRATIONS` in `server/db.ts`, after migration 3:

```ts
  `
  INSERT INTO list_values (list, name, sort_order) VALUES
    ('phase', 'Requirements gathering', 0),
    ('phase', 'Business analysis', 1),
    ('phase', 'Development plan', 2),
    ('phase', 'Development', 3),
    ('phase', 'QA', 4),
    ('phase', 'UAT', 5),
    ('phase', 'Security testing', 6),
    ('phase', 'Deployment', 7),
    ('phase', 'Launch', 8),
    ('phase', 'Design', 9);
  `,
```

In `client/useLists.ts`, change `EMPTY` to:

```ts
const EMPTY: Lists = { mainProject: [], projectType: [], goal: [], department: [], phase: [] };
```

In `client/testing/mockFetch.ts`, add this property to the object returned by `sampleLists()`, after `department`:

```ts
    phase: [
      'Requirements gathering', 'Business analysis', 'Development plan', 'Development', 'QA', 'UAT',
      'Security testing', 'Deployment', 'Launch', 'Design',
    ].map((name, i) => ({ id: 50 + i, list: 'phase' as const, name, order: i })),
```

- [ ] **Step 4: Replace `server/lists/repo.ts`**

```ts
import type { DatabaseSync } from 'node:sqlite';
import { LIST_NAMES, type ListName, type ListValue, type Lists } from '../../shared/types';
import { transaction } from '../db';

interface ListRow {
  id: number;
  list: ListName;
  name: string;
  sort_order: number;
}

/**
 * How many projects use a list value. Most lists are referenced by id from a projects column. Phases store their
 * name on each project's phase rows, so a phase value is matched by name (ignoring case).
 */
const USAGE_SQL: Record<ListName, string> = {
  mainProject: 'SELECT COUNT(*) AS n FROM projects WHERE main_project_id = ?',
  projectType: 'SELECT COUNT(*) AS n FROM projects WHERE project_type_id = ?',
  goal: 'SELECT COUNT(*) AS n FROM projects WHERE goal_id = ?',
  department: 'SELECT COUNT(*) AS n FROM projects WHERE department_id = ?',
  phase: 'SELECT COUNT(DISTINCT project_id) AS n FROM phases WHERE name = ? COLLATE NOCASE',
};

export type ListChange = { ok: true; value?: ListValue } | { ok: false; status: 404 | 409; error: string };

function toValue(row: ListRow): ListValue {
  return { id: row.id, list: row.list, name: row.name, order: row.sort_order };
}

function findByName(db: DatabaseSync, list: ListName, name: string): ListRow | undefined {
  return db
    .prepare('SELECT * FROM list_values WHERE list = ? AND name = ? COLLATE NOCASE')
    .get(list, name) as unknown as ListRow | undefined;
}

export function isListName(value: string): value is ListName {
  return (LIST_NAMES as readonly string[]).includes(value);
}

export function getLists(db: DatabaseSync): Lists {
  const lists: Lists = { mainProject: [], projectType: [], goal: [], department: [], phase: [] };
  const rows = db.prepare('SELECT * FROM list_values ORDER BY sort_order, id').all() as unknown as ListRow[];
  for (const row of rows) lists[row.list].push(toValue(row));
  return lists;
}

export function getListValue(db: DatabaseSync, id: number): ListValue | undefined {
  const row = db.prepare('SELECT * FROM list_values WHERE id = ?').get(id) as unknown as ListRow | undefined;
  return row ? toValue(row) : undefined;
}

/** Adds a value at the end of a list, or returns the existing value with the same name (ignoring case). */
export function addListValue(db: DatabaseSync, list: ListName, name: string): { value: ListValue; created: boolean } {
  const existing = findByName(db, list, name);
  if (existing) return { value: toValue(existing), created: false };
  const { next } = db
    .prepare('SELECT COALESCE(MAX(sort_order) + 1, 0) AS next FROM list_values WHERE list = ?')
    .get(list) as unknown as { next: number };
  const res = db.prepare('INSERT INTO list_values (list, name, sort_order) VALUES (?, ?, ?)').run(list, name, next);
  return { value: getListValue(db, Number(res.lastInsertRowid))!, created: true };
}

export function renameListValue(db: DatabaseSync, list: ListName, id: number, name: string): ListChange {
  const current = getListValue(db, id);
  if (!current || current.list !== list) return { ok: false, status: 404, error: 'Value not found' };
  const clash = findByName(db, list, name);
  if (clash && clash.id !== id) return { ok: false, status: 409, error: `"${clash.name}" already exists` };
  transaction(db, () => {
    db.prepare('UPDATE list_values SET name = ? WHERE id = ?').run(name, id);
    // Phase names live on each project's phases, so a renamed phase is renamed there too.
    if (list === 'phase') db.prepare('UPDATE phases SET name = ? WHERE name = ? COLLATE NOCASE').run(name, current.name);
  });
  return { ok: true, value: getListValue(db, id) };
}

export function deleteListValue(db: DatabaseSync, list: ListName, id: number): ListChange {
  const current = getListValue(db, id);
  if (!current || current.list !== list) return { ok: false, status: 404, error: 'Value not found' };
  const { n } = db.prepare(USAGE_SQL[list]).get(list === 'phase' ? current.name : id) as unknown as { n: number };
  if (n > 0) return { ok: false, status: 409, error: `"${current.name}" is used by ${n} project${n === 1 ? '' : 's'}` };
  db.prepare('DELETE FROM list_values WHERE id = ?').run(id);
  return { ok: true };
}
```

- [ ] **Step 5: Ten phase colours in `client/gantt/rows.ts`**

Replace the whole block from the `/**` comment above `export const PHASE_PALETTE` down to and including the closing `};` of `KNOWN_PHASE_COLORS` with:

```ts
/**
 * A fixed, project-independent colour palette for phase bars, assigned by phase *name* (via phaseColorFor), so e.g.
 * "Development" is the same colour on every project's Gantt chart. 10 OKLCH colours sharing the app's lightness and
 * chroma (L 0.62 C 0.12), hues spread evenly across 95–330° — clear of the red/amber hues used for --danger and
 * --warning (see styles.css).
 */
export const PHASE_PALETTE: string[] = [95, 121, 147, 173, 199, 225, 252, 278, 304, 330].map((h) => `oklch(0.62 0.12 ${h})`);

/**
 * The standard phases in lifecycle order, each with the normalised (trimmed, lower-cased) names it goes by.
 * Consecutive phases take palette slots three apart (0, 3, 6, 9, 2, 5, …), so neighbouring bars get clearly
 * different hues.
 */
const STANDARD_PHASES: string[][] = [
  ['requirements', 'requirements gathering', 'gathering requirements'],
  ['analysis', 'business analysis'],
  ['design'],
  ['development plan'],
  ['development', 'dev'],
  ['qa', 'testing'],
  ['uat', 'user acceptance testing'],
  ['security testing', 'security'],
  ['deployment', 'deploy'],
  ['launch', 'go-live', 'golive'],
];

const KNOWN_PHASE_COLORS: Record<string, string> = Object.fromEntries(
  STANDARD_PHASES.flatMap((names, i) => names.map((name) => [name, PHASE_PALETTE[(i * 3) % PHASE_PALETTE.length]])),
);
```

- [ ] **Step 6: Let `OptionPicker` hide its label visually (`client/components/OptionPicker.tsx`)**

- In `interface OptionPickerProps`, add:

```ts
  /** Keep the label for screen readers and tests but don't show it (e.g. inside a table-like row). */
  hideLabel?: boolean;
```

- Add `hideLabel = false` to the destructured props.
- Directly after the `useState` lines, add:

```tsx
  const labelText = hideLabel ? <span className="visually-hidden">{label}</span> : label;
```

- In both returned `<label>` elements, replace the bare `{label}` child with `{labelText}`. The `aria-label` of the inline add input keeps using `label` as it is.

Append to `client/styles.css` after the `.field-error` rule:

```css
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

- [ ] **Step 7: Replace `client/pages/manage/PhasesFields.tsx`**

```tsx
import { DEFAULT_CALENDAR, isISODate, todayLocal } from '../../../shared/calendar';
import { schedulePhases, type PhaseInput } from '../../../shared/scheduler';
import type { ListValue } from '../../../shared/types';
import { OptionPicker } from '../../components/OptionPicker';
import { GripIcon, PlusIcon, TrashIcon } from '../../icons';
import { api } from '../../api';
import { Gantt } from '../../gantt/Gantt';
import { phaseRows, rangeFor } from '../../gantt/rows';
import { useElementWidth } from '../../gantt/useElementWidth';
import { useAsync } from '../../useAsync';
import { moveItem, useReorder } from '../../useReorder';

/** New projects start with these phases; each name is also in the default Phases list (migration 4). */
export const DEFAULT_PHASES: PhaseInput[] = [
  { name: 'Requirements gathering', durationDays: 10 },
  { name: 'Business analysis', durationDays: 10 },
  { name: 'Development plan', durationDays: 5 },
  { name: 'Development', durationDays: 40 },
  { name: 'QA', durationDays: 15 },
  { name: 'UAT', durationDays: 10 },
  { name: 'Security testing', durationDays: 5 },
  { name: 'Deployment', durationDays: 2 },
  { name: 'Launch', durationDays: 1 },
];

interface PhasesFieldsProps {
  startDate: string;
  onStartDate: (date: string) => void;
  phases: PhaseInput[];
  onPhases: (phases: PhaseInput[]) => void;
  /** The editable Phases list, for the name dropdowns. */
  phaseOptions: ListValue[];
  /** Called with a phase name created inline with "Other…", so every dropdown shows it straight away. */
  onListAdded: (value: ListValue) => void;
}

/** Wizard Step 3: start date, ordered phases chosen from the Phases list, working-day durations, and a live Gantt preview. */
export function PhasesFields({ startDate, onStartDate, phases, onPhases, phaseOptions, onListAdded }: PhasesFieldsProps) {
  const calendar = useAsync(() => api.getCalendar(), []);
  const [chartRef, chartWidth] = useElementWidth<HTMLDivElement>();
  const { handleProps, rowProps } = useReorder(phases.length, (from, to) => onPhases(moveItem(phases, from, to)));

  const cal = calendar.data ?? DEFAULT_CALENDAR;
  const previewPhases = phases.filter((p) => p.name.trim() !== '' && Number.isInteger(p.durationDays) && p.durationDays >= 1);
  const scheduled = isISODate(startDate) ? schedulePhases(startDate, previewPhases, cal) : [];
  const rows = phaseRows({ phases: scheduled });
  const range = rangeFor(rows, isISODate(startDate) ? startDate : todayLocal());

  function update(index: number, patch: Partial<PhaseInput>) {
    onPhases(phases.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  /** The list value a phase name matches (ignoring case), so its dropdown shows it. */
  function idForName(name: string): number | null {
    const key = name.trim().toLowerCase();
    return phaseOptions.find((o) => o.name.toLowerCase() === key)?.id ?? null;
  }

  return (
    <>
      <section className="card">
        <h2>Phases</h2>
        <p className="field-hint">Durations are in working days. Dates are calculated from the working calendar.</p>
        <div className="phase-start">
          <label>
            Start date
            <input type="date" value={startDate} onChange={(e) => onStartDate(e.target.value)} />
          </label>
        </div>
        {phases.map((phase, i) => (
          <div className="phase-row" key={i} {...rowProps(i)}>
            <button {...handleProps(i, `Reorder phase ${i + 1}`)}>
              <GripIcon />
            </button>
            <OptionPicker
              label={`Phase ${i + 1} name`}
              hideLabel
              list="phase"
              options={phaseOptions}
              value={idForName(phase.name)}
              onChange={(id) => {
                if (id === null) {
                  update(i, { name: '' });
                  return;
                }
                // A name just created with "Other…" is not in phaseOptions yet; onAdded below has already set it.
                const chosen = phaseOptions.find((o) => o.id === id);
                if (chosen) update(i, { name: chosen.name });
              }}
              onAdded={(value) => {
                onListAdded(value);
                update(i, { name: value.name });
              }}
              noneLabel="Choose a phase…"
              addLabel="Other…"
            />
            <input
              aria-label={`Phase ${i + 1} working days`}
              type="number"
              min={1}
              value={Number.isNaN(phase.durationDays) ? '' : phase.durationDays}
              onChange={(e) => update(i, { durationDays: e.target.valueAsNumber })}
            />
            <button
              type="button"
              className="button ghost-icon"
              aria-label={`Remove phase ${i + 1}`}
              onClick={() => onPhases(phases.filter((_, j) => j !== i))}
            >
              <TrashIcon />
            </button>
          </div>
        ))}
        <button type="button" className="button secondary" onClick={() => onPhases([...phases, { name: '', durationDays: 5 }])}>
          <PlusIcon />Add phase
        </button>
      </section>

      <section className="card">
        <h2>Preview</h2>
        <div className="chart-scroll" ref={chartRef}>
          <Gantt rows={rows} range={range} width={chartWidth} />
        </div>
      </section>
    </>
  );
}
```

- [ ] **Step 8: Wire the Phases list into the wizard and Settings**

In `client/pages/manage/CreateProjectPage.tsx`, replace the `<PhasesFields … />` element with:

```tsx
          <PhasesFields
            startDate={startDate}
            onStartDate={setStartDate}
            phases={phases}
            onPhases={setPhases}
            phaseOptions={lists.phase}
            onListAdded={remember}
          />
```

In `client/pages/manage/SettingsPage.tsx`, append to `EDITORS`:

```ts
  { list: 'phase', title: 'Phases', singular: 'Phase' },
```

- [ ] **Step 9: Put the demo projects on the new phase names (`server/demoData.ts`)**

Replace each project's `phases` array. Legacy Archive Migration still totals 72 working days from 2025-09-07, so it still ends in December 2025.

```ts
// Legacy Archive Migration
    phases: [
      { name: 'Requirements gathering', durationDays: 10 },
      { name: 'Development', durationDays: 45 },
      { name: 'QA', durationDays: 10 },
      { name: 'Security testing', durationDays: 5 },
      { name: 'Launch', durationDays: 2 },
    ],
// Customer Portal Revamp
    phases: [
      { name: 'Requirements gathering', durationDays: 10 },
      { name: 'Business analysis', durationDays: 10 },
      { name: 'Development plan', durationDays: 5 },
      { name: 'Design', durationDays: 10 },
      { name: 'Development', durationDays: 45 },
      { name: 'QA', durationDays: 15 },
      { name: 'UAT', durationDays: 10 },
      { name: 'Security testing', durationDays: 5 },
      { name: 'Deployment', durationDays: 2 },
      { name: 'Launch', durationDays: 1 },
    ],
// HR Self-Service
    phases: [
      { name: 'Requirements gathering', durationDays: 8 },
      { name: 'Business analysis', durationDays: 8 },
      { name: 'Development plan', durationDays: 3 },
      { name: 'Development', durationDays: 37 },
      { name: 'QA', durationDays: 10 },
      { name: 'UAT', durationDays: 5 },
      { name: 'Launch', durationDays: 1 },
    ],
// Case Management System
    phases: [
      { name: 'Requirements gathering', durationDays: 15 },
      { name: 'Business analysis', durationDays: 15 },
      { name: 'Development plan', durationDays: 5 },
      { name: 'Design', durationDays: 10 },
      { name: 'Development', durationDays: 75 },
      { name: 'QA', durationDays: 20 },
      { name: 'UAT', durationDays: 10 },
      { name: 'Security testing', durationDays: 10 },
      { name: 'Deployment', durationDays: 3 },
      { name: 'Launch', durationDays: 1 },
    ],
// Internal Reporting Dashboard
    phases: [
      { name: 'Requirements gathering', durationDays: 5 },
      { name: 'Development', durationDays: 25 },
      { name: 'QA', durationDays: 8 },
      { name: 'UAT', durationDays: 5 },
      { name: 'Deployment', durationDays: 1 },
    ],
// E-Services Mobile App
    phases: [
      { name: 'Requirements gathering', durationDays: 10 },
      { name: 'Business analysis', durationDays: 10 },
      { name: 'Development plan', durationDays: 5 },
      { name: 'Design', durationDays: 15 },
      { name: 'Development', durationDays: 60 },
      { name: 'QA', durationDays: 15 },
      { name: 'UAT', durationDays: 10 },
      { name: 'Security testing', durationDays: 5 },
    ],
```

- [ ] **Step 10: Run the tests to verify they pass**

Run: `npx vitest run server/lists client/gantt/rows.test.ts server/demoData.test.ts client/pages/manage client/components`
Expected: PASS.

- [ ] **Step 11: Run the whole suite and the type check**

Run: `npm test` → Expected: PASS (all tests).
Run: `npm run typecheck` → Expected: exit code 0.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: phase names from an editable dropdown, new default phases, ten phase colours"
```

---

### ✅ M3 checkpoint: stop and demo to the user

Start from a fresh demo database. An existing `data/pm.db` upgrades automatically to the new schema, but a fresh one shows the demo grouping.
1. Stop `npm run dev`.
2. Delete `data/pm.db`.
3. Run `npm run seed`. Expected: "Added 6 demo projects."
4. Run `npm run dev` and open http://localhost:5173.

The user should be able to:
1. Open **Project Management → New project** and walk through **Basic info → Description & scope → Phases**.
   - **Next** refuses to move on without a project name.
   - **Back** keeps what was typed.
2. In Basic info and People:
   - Fill in the tech PM and the business PM. The phone refuses a non-UAE-mobile number such as 04 123 4567, and accepts 050 123 4567 and saves it as +971 50 123 4567.
   - Choose a **Main project**, or add one with "+ Add new main project…".
   - Choose a **Project type** or **Goal**, or add one with "Other…".
   - Add a **Business user (department)** inline.
   - Tick the Requester and Beneficiary boxes.
3. In Description & scope, add items to all four tables. Items are numbered. You can edit them in place, remove them, and reorder them by dragging the handle or with the arrow keys on it.
4. On Phases, the nine default phases appear in dropdowns. Pick "Design" for one row, and add a new phase name with "Other…".
5. Create the project. The project page shows the **Details**, **Description** and **Scope and goals** cards.
6. Click **Edit details**, change something, and **Save changes**. The phases are untouched.
7. Open **Projects → Settings** (it now also has a **Phases** list):
   - Rename a value, add one and delete an unused one.
   - Try deleting a value a project uses, e.g. project type "Customer". It explains why it can't be deleted.
8. Open **Project Presentation**:
   - 2026 shows **Digital Services** and **Records Modernisation** as group rows with summary bars, their projects indented under them, and standalone projects last.
   - Clicking a group row does nothing, and clicking a project opens its focus view.
   - 2025 shows Legacy Archive Migration under Records Modernisation.

**Ask the user for feedback. When M3 is approved, merge `build/m3` into `main` (with permission) and bring the other branches up to date, then write the M4 plan (Resources and workload).**
