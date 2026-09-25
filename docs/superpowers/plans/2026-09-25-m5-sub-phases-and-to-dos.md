# Milestone 5: Sub-phases and To-dos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the PM change a project's phases after it is created and break any phase into sub-phases, which may run in parallel, with people assigned to them. That way everyone's exact work shows on their page and in the workload. Give the PM a private to-do list per project, assignable to anyone on the project, surfaced as "Next up", "My next steps" and a To-dos page, with optional starter checklists per phase. Back up the database daily.

**Architecture:**
- **Storage:** three new schema versions.
  - Migration 8: `phases` gains `parent_id` and `with_previous`, so a sub-phase is a phase row with a parent.
  - Migration 9: a `todos` table.
  - Migration 10: a `starter_todos` table.
  - "I am" is a row in the existing `settings` table.
- **Scheduler:** the pure scheduler in `shared/scheduler.ts` gains sub-phases. A phase with sub-phases spans from its first sub-phase's start to its latest sub-phase's end, and everything after it moves accordingly.
- **Phase editing:** a new `PUT /api/projects/:id/schedule` replaces the project's start date and phase structure, and keeps every phase that is sent back by id. People, to-dos and history stay attached to the phases that survive.
- **To-dos:**
  - server-side validation that the assignee is on the project;
  - a to-dos card and a "Next up" card on the project page;
  - a To-dos page;
  - "My next steps" on the dashboard;
  - to-dos on each person's page.
- **Starter checklists:** kept per Phases-list value in Settings. They are offered, ticked, on the project page right after a project is created or phases are added.
- **Backups:** `VACUUM INTO backups/pm-YYYY-MM-DD.db` once a day, keeping the newest 14.

**Tech Stack:** Node 24, TypeScript 5, React 19, React Router 7, Vite 6, Fastify 5, zod 3, `node:sqlite` (built in), Vitest 3, Testing Library, jsdom.

**Spec:** `docs/superpowers/specs/2026-09-24-visual-project-portfolio-design.md`. The relevant sections:
- §1 Delivery principles;
- §2 `Phase` (sub-phases), `ToDo`, `StarterToDo`;
- §3.3 My next steps;
- §3.4 buttons, Next up;
- §3.8 To-dos;
- §3.9 Settings;
- §5.3 backups.

**Roadmap row (M5):** *"Edit phases after creation; sub-phases (can run in parallel) with people assigned to them, shown on the Gantt, the person page and the workload; to-dos for yourself or anyone on the project, Next up card, My next steps, To-dos page, optional starter checklists per phase, "I am" in Settings; daily backups."*

**Decisions confirmed with the user (2026-09-25):**
- **Sub-phases may run at the same time.** By default a new sub-phase starts after the ones above it; it can be set to start with the one above instead. Parallel sub-phases aren't expected to be common.
- **To-dos** are named "To-dos" everywhere. The word "action" is not used for them.
  - They are private to project management and never appear under `/present`.
  - They can be assigned to **me** or to **anyone on the project**, business contacts included.
- **Starter checklists per phase** are included and optional. They start empty for a real user, and nothing is added unless the PM keeps it.
- **Phase editing is in M5**, because adding sub-phases to an existing project needs it.

**Deliberate choices (flag if you disagree):**
- **"After" means after everything above it.** A sub-phase set to "After the ones above" starts on the first working day after **all** earlier sub-phases of the same phase have ended. "With the one above" starts on the same day as the sub-phase directly above it. The first sub-phase always starts with its phase. With this rule, a run of parallel increments followed by a "then" increment behaves as people expect.
- **A phase with sub-phases takes its dates from them.** Its working days are shown as "N working days (from sub-phases)" and can't be typed.
- **Sub-phase names are free text**, e.g. "Increment 7 – Payment gateway". They are not chosen from the Phases list. Sub-phase bars use their parent phase's colour, so Development's increments all look like Development.
- **People can be assigned to a whole phase and to its sub-phases.** Both count in workload. For example, a tech lead might be on "Development" at 30% while developers are on individual increments.
- **Removing a phase removes the people assigned to it.** The Edit phases page warns before saving when a removed phase has people or open to-dos on it.
- **A removed phase's to-dos (user decision, 2026-09-25).** The warning asks what to do with the open ones:
  - **Keep them on the project** (the default). A kept to-do is unlinked, and it remembers the removed phase: "Was on Development › Increment 2 (removed Fri 25 Sep)". Linking it to another phase clears that note.
  - **Delete them.**

  Done to-dos of a removed phase are deleted either way. The To-dos page has a **From removed phases** filter for cleaning up the kept ones.
- **Before M7, editing phases simply changes the plan.** Baselines and recorded date changes start in M7. The spec already says this.
- **"I am" must be an active tech-team person.** It is used for **Mine**, **Next up** and **My next steps**. Until it is set, those places say so and link to Settings. The PM can still add and assign to-dos.
- **Assignee rule:** a to-do's assignee must be the project's tech PM, its business PM, someone assigned to any of its phases or sub-phases, or "I am". A to-do whose assignee later leaves the project keeps them, the same way inactive people stay on their phases. The rule only applies when the assignee is changed.
- **To-dos count as "in use" for deleting a person, not for changing their side.** A person with to-dos can't be deleted (make them inactive instead). A business contact with to-dos can still be switched to the tech team, because to-dos are allowed on either side.
- **Urgency order** (Next up, My next steps, the To-dos page): overdue first, then by due date (earliest first), then undated ones, oldest first.
- **Starter to-dos are keyed by Phases-list value**, not by typed text, so renaming "UAT" in Settings keeps its checklist. They are offered for **top-level phases only**, when a project is created or phases are added on the Edit phases page, and are assigned to "I am" when it is set.
- **The demo gets examples.** A real install starts with empty starter checklists; the demo seeds some so the feature can be seen. The demo's "I am" is **Sara Ahmed**.
- **Backups** are taken when the server starts and checked every hour. A backup is taken at most once per calendar day, and only the newest 14 are kept. Settings shows when the last one was taken.

## Global Constraints

- **Branches:**
  - This plan is committed on `design/portfolio-spec`.
  - The build happens on a new `build/m5` branch created from `design/portfolio-spec` at the commit that holds this plan.
  - **Never commit to `main`.** Code and small doc fixes that come out of reviewing the build go on `build/m5`.
  - Merging happens only after the user approves the milestone. Then every branch (`main`, `design/portfolio-spec`, `build/m1-m2`, `build/m2`, `build/m3`, `build/m4`, `build/m5`) is fast-forwarded to the same commit.
- **Node:** 24.x or later is required (for `node:sqlite`). No native or compiled npm dependencies, because it runs on Windows. **No new npm dependencies in M5.**
- **Database:** use `node:sqlite` with raw SQL and versioned migrations (`PRAGMA user_version`). **Never edit a shipped migration — append a new one.** Migrations 1–7 exist; M5 adds 8, 9 and 10. Every query is parameterised.
- **Dates:** always ISO `YYYY-MM-DD` strings. "Today" is the local date (`todayLocal()`), never a UTC slice. Weeks start on **Monday**. Dates shown to people use `dayDate` ("Mon 12 Oct") or `formatDate` ("Mon 12 Oct 2026"), both from M4.
- **Tests:**
  - Every client test file starts with `// @vitest-environment jsdom`. Server and shared tests run in the default Node environment.
  - Tests that depend on "today" fix the clock with `vi.useFakeTimers({ toFake: ['Date'] })` and `vi.setSystemTime(...)`, or pass `today` in explicitly.
  - Server route tests build the app with `buildApp(db, { today: () => '…' })`.
- **Presentation side is read-only.** There are no create or edit controls under `/present`. **To-dos never appear under `/present`.** The focus view does show sub-phases on its Gantt chart, which is M5's stakeholder-side addition.
- **Workload:** always consume the `overloaded` boolean from `computeWorkload` or `computeDailyLoad`. Never re-derive it from rounded numbers.
- **People:** only **active tech-team** people can be newly assigned to a phase or sub-phase, and a person appears at most once per phase or sub-phase. A to-do can be assigned to either side.
- **Reordering** is drag-and-drop on a handle button plus ArrowUp/ArrowDown (the existing `useReorder`). Sub-phases reorder within their phase.
- **Separator** between a phase and its sub-phase in every label: " › " (space, U+203A, space), e.g. "Development › Increment 7 – Payment gateway".

## Where M5 sits

M1–M4 are merged to `main`, at commit `7da16a4`. The M4 checkpoint demo has 15 people, 6 projects, leave, overbookings, a Days/Weeks heatmap and a sortable People table.

## File Structure (M5 changes)

```
shared/
  scheduler.ts         + SubPhaseInput, ScheduledSubPhase; schedulePhases schedules sub-phases        (Task 1)
  schemas.ts           + subPhaseInputSchema, schedule update schemas, to-do and starter schemas       (Tasks 1, 2, 6, 9)
  types.ts             + SubPhaseRecord, PhaseRecord.subPhases, ToDoRecord, Me, StarterToDo types      (Tasks 1, 6, 9)
server/
  db.ts                + migrations 8, 9, 10                                                             (Tasks 1, 6, 9)
  projects/repo.ts     nested sub-phases on read and create; updateSchedule                              (Tasks 1, 2)
  assignments/repo.ts  sub-phase aware ordering and "Phase › Sub-phase" names in workload                 (Task 1)
  todos/repo.ts        NEW: to-dos CRUD, assignee rule, filters                                          (Task 6)
  starters/repo.ts     NEW: starter checklists and suggestions                                           (Task 9)
  settings.ts          + getMe / setMe                                                                   (Task 6)
  resources/repo.ts    to-dos count as use for delete; clearing "I am" on delete                          (Task 6)
  backup.ts            NEW: daily VACUUM INTO, prune to 14, status                                        (Task 10)
  index.ts             runs backups at start and hourly                                                  (Task 10)
  app.ts               new routes                                                                        (Tasks 2, 6, 9, 10)
  demoData.ts          increments, to-dos, "I am", starter lists                                         (Task 11)
client/
  gantt/rows.ts        sub-phase rows (indented, parent colour)                                          (Task 3)
  pages/manage/
    PhasesFields.tsx   sub-phase rows, derived parent days                                               (Task 4)
    SubPhaseList.tsx   NEW: one phase's sub-phase rows with their own reorder                            (Task 4)
    EditPhasesPage.tsx NEW: /manage/projects/:id/phases                                                  (Task 4)
    projectDraft.ts    sub-phase drafts; draft ↔ input; stepOfIssue for sub-phase assignments            (Tasks 4, 5)
    PeopleFields.tsx   sub-phase editors in wizard Step 4                                                (Task 5)
    ProjectPeople.tsx  sub-phase editors on the project page                                             (Task 5)
    PersonWork.tsx     NEW: "Working on" card on a person's page                                         (Task 5)
    ProjectToDos.tsx   NEW: the project's to-dos card                                                    (Task 7)
    NextUp.tsx         NEW: "Next up" card                                                               (Task 7)
    ToDosPage.tsx      NEW: /manage/todos                                                                (Task 8)
    MyNextSteps.tsx    NEW: dashboard card                                                               (Task 8)
    StarterOffer.tsx   NEW: offer starter to-dos on the project page                                     (Task 9)
    StarterEditor.tsx  NEW: Settings card                                                                (Task 9)
  components/ToDoForm.tsx NEW: add/edit a to-do                                                          (Task 7)
  components/ToDoRow.tsx  NEW: read-only to-do row with a done checkbox                                   (Task 8)
  pages/manage/MeSetting.tsx NEW: the "I am" card in Settings                                            (Task 7)
  todos.ts             NEW: urgency sort, overdue, assignee options                                      (Task 7)
  useMe.ts             NEW                                                                               (Task 7)
```

---


### Task 1: Sub-phases — schema, scheduler, create and read

**Files:**
- Modify: `server/db.ts` (append migration 8), `shared/scheduler.ts`, `shared/schemas.ts`, `shared/types.ts`, `server/projects/repo.ts`, `server/assignments/repo.ts`, `server/lists/repo.ts`, `server/app.ts` (POST /api/projects checks sub-phase people), `client/testing/mockFetch.ts` (fixtures gain `subPhases: []`)
- Test: `shared/scheduler.test.ts`, `server/projects/projects.test.ts`, `server/assignments/assignments.test.ts`, `server/lists/lists.test.ts`, `server/db.test.ts`, `server/app.test.ts`

**Interfaces:**
- Consumes: `addDays`, `addWorkingDays`, `nextWorkingDay`, `countWorkingDays` (`shared/calendar.ts`); `saveAssignments`, `checkAssignmentPeople` (`server/assignments/repo.ts`); `phaseAssignmentsSchema` (`shared/schemas.ts`).
- Produces:
  - `shared/scheduler.ts`:
    ```ts
    export interface SubPhaseInput { name: string; durationDays: number; withPrevious?: boolean }
    export interface PhaseInput { name: string; durationDays: number; subPhases?: SubPhaseInput[] }
    export interface ScheduledSubPhase extends SubPhaseInput { order: number; start: ISODate; end: ISODate; withPrevious: boolean }
    export interface ScheduledPhase extends PhaseInput { order: number; start: ISODate; end: ISODate; subPhases: ScheduledSubPhase[] }
    export function schedulePhases<P extends PhaseInput>(projectStart: ISODate, phases: P[], cal: WorkCalendar): (P & ScheduledPhase)[]
    export function scheduleSubPhases<S extends SubPhaseInput>(phaseStart: ISODate, subs: S[], cal: WorkCalendar): (S & ScheduledSubPhase)[]
    ```
    As today, `schedulePhases` keeps every extra property of each input phase (the wizard relies on `assignments` surviving). Each scheduled sub-phase keeps its extra properties too.
  - `shared/types.ts`:
    ```ts
    export interface SubPhaseRecord { id: number; name: string; order: number; durationDays: number; start: ISODate; end: ISODate; withPrevious: boolean }
    export interface PhaseRecord { id: number; name: string; order: number; durationDays: number; start: ISODate; end: ISODate; subPhases: SubPhaseRecord[] }
    ```
  - `shared/schemas.ts`:
    - `subPhaseInputSchema`, with `name`, `durationDays`, `withPrevious` and `assignments`;
    - `phaseInputSchema` gains `subPhases`;
    - type `SubPhaseInputData = z.output<typeof subPhaseInputSchema>`.
  - `ProjectRecord.phases` holds **top-level phases only**, each with its `subPhases` ordered by `order`. `ProjectRecord.assignments` may reference a sub-phase's id.
  - In the workload, a sub-phase assignment's `phaseName` is `"<phase> › <sub-phase>"`.

**Rules:**
- A sub-phase is a `phases` row with `parent_id` set to its phase and the same `project_id`. Its `sort_order` counts from 0 within its phase. Sub-phases are only one level deep.
- `scheduleSubPhases(phaseStart, subs, cal)`:
  - Sub-phase 0 starts on `nextWorkingDay(phaseStart)`, and its `withPrevious` is always `false`.
  - A later sub-phase with `withPrevious: true` starts on the same day as the sub-phase directly above it.
  - Any other sub-phase starts on the first working day after the **latest** end among all earlier sub-phases.
  - A sub-phase's end is `addWorkingDays(start, durationDays)`.
- `schedulePhases`:
  - A phase without sub-phases is scheduled exactly as today.
  - A phase with sub-phases starts on `nextWorkingDay(cursor)`. It ends on the latest sub-phase end, and its `durationDays` becomes `countWorkingDays(start, end)`, whatever was passed in.
  - The next phase starts after that end.
- **Phases list:** when checking whether a list value is in use, and when renaming it, only **top-level** phases count (`parent_id IS NULL`). Sub-phase names are free text.

- [ ] **Step 1: Write the failing tests**

In `shared/scheduler.test.ts`, add a `describe('sub-phases', …)` block. `DEFAULT_CALENDAR` treats Saturday and Sunday as the weekend, and 2026-10-05 is a Monday.

```ts
import { DEFAULT_CALENDAR } from './calendar';
import { schedulePhases, scheduleSubPhases } from './scheduler';

describe('sub-phases', () => {
  it('runs sub-phases one after another by default, and the phase spans them', () => {
    const [dev, qa] = schedulePhases(
      '2026-10-05',
      [
        { name: 'Development', durationDays: 99, subPhases: [{ name: 'Increment 1', durationDays: 5 }, { name: 'Increment 2', durationDays: 5 }] },
        { name: 'QA', durationDays: 2 },
      ],
      DEFAULT_CALENDAR,
    );
    expect(dev.subPhases.map((s) => [s.name, s.start, s.end, s.withPrevious])).toEqual([
      ['Increment 1', '2026-10-05', '2026-10-09', false],
      ['Increment 2', '2026-10-12', '2026-10-16', false],
    ]);
    expect(dev).toMatchObject({ start: '2026-10-05', end: '2026-10-16', durationDays: 10 });
    expect(qa).toMatchObject({ start: '2026-10-19', end: '2026-10-20' });
  });

  it('starts a sub-phase with the one above, and "after" waits for everything above it', () => {
    const subs = scheduleSubPhases(
      '2026-10-05',
      [
        { name: 'A', durationDays: 5 },
        { name: 'B', durationDays: 3, withPrevious: true },
        { name: 'C', durationDays: 2 },
      ],
      DEFAULT_CALENDAR,
    );
    expect(subs.map((s) => [s.name, s.start, s.end])).toEqual([
      ['A', '2026-10-05', '2026-10-09'],
      ['B', '2026-10-05', '2026-10-07'],
      ['C', '2026-10-12', '2026-10-13'],
    ]);
  });

  it('ignores withPrevious on the first sub-phase', () => {
    const [first] = scheduleSubPhases('2026-10-05', [{ name: 'A', durationDays: 1, withPrevious: true }], DEFAULT_CALENDAR);
    expect(first).toMatchObject({ start: '2026-10-05', end: '2026-10-05', withPrevious: false });
  });

  it('keeps extra properties on phases and sub-phases', () => {
    const input = [{ name: 'Dev', durationDays: 1, tag: 'x', subPhases: [{ name: 'S', durationDays: 1, tag: 'y' }] }];
    const [p] = schedulePhases('2026-10-05', input, DEFAULT_CALENDAR);
    expect(p.tag).toBe('x');
    expect((p.subPhases[0] as { tag?: string }).tag).toBe('y');
  });
});
```

In `server/projects/projects.test.ts`, add tests using the file's existing setup (`openDb(':memory:')` plus the existing calendar and project helpers):
- **Create a project with sub-phases.** Its second phase has two sub-phases, the second with `withPrevious: true`. Put one assignment on the phase and one on a sub-phase. Then check that:
  - `getProject` returns two top-level phases;
  - the second phase's `subPhases` have the right names, orders 0 and 1, `withPrevious` values `[false, true]`, and the scheduled dates;
  - `assignments` contains both assignments, and the sub-phase assignment's `phaseId` is the sub-phase's id;
  - `listProjects` returns the same nesting.
- **No sub-phases.** For a project without sub-phases, every phase has `subPhases: []`.

In `server/assignments/assignments.test.ts`: for an assignment on sub-phase "Increment 1" of "Development", `workloadData(db).assignments` has `phaseName: 'Development › Increment 1'` and the sub-phase's own start and end.

In `server/lists/lists.test.ts`, with a sub-phase named "QA" (free text):
- it does not make the Phases-list value "QA" count as in use;
- renaming the "QA" list value does not rename that sub-phase.

In `server/db.test.ts`: after migrating, `PRAGMA table_info(phases)` includes `parent_id` and `with_previous`, and `PRAGMA user_version` is at least 8. If an existing test asserts an exact version or migration count, update it to the new count.

In `server/app.test.ts`: `POST /api/projects` with a sub-phase assigned to a business contact returns 400, with an issue at path `phases.0.subPhases.0.assignments.0.resourceId`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run shared/scheduler.test.ts server`
Expected: FAIL. `scheduleSubPhases` is not exported, `subPhases` is missing, and the table has no `parent_id` column.

- [ ] **Step 3: Migration 8**

Append to `MIGRATIONS` in `server/db.ts`:

```ts
  `
  ALTER TABLE phases ADD COLUMN parent_id INTEGER REFERENCES phases(id) ON DELETE CASCADE;
  ALTER TABLE phases ADD COLUMN with_previous INTEGER NOT NULL DEFAULT 0;
  CREATE INDEX phases_parent ON phases(parent_id);
  `,
```

- [ ] **Step 4: Scheduler**

In `shared/scheduler.ts`, replace everything above `projectSpan` with:

```ts
import { addDays, addWorkingDays, countWorkingDays, nextWorkingDay, type DateRange, type ISODate, type WorkCalendar } from './calendar';

export interface SubPhaseInput {
  name: string;
  durationDays: number;
  /** Start on the same day as the sub-phase directly above. Ignored on the first sub-phase. */
  withPrevious?: boolean;
}

export interface PhaseInput {
  name: string;
  durationDays: number;
  /** When present and not empty, the phase's dates come from these. */
  subPhases?: SubPhaseInput[];
}

export interface ScheduledSubPhase extends SubPhaseInput {
  order: number;
  start: ISODate;
  end: ISODate;
  withPrevious: boolean;
}

export interface ScheduledPhase extends PhaseInput {
  order: number;
  start: ISODate;
  end: ISODate;
  subPhases: ScheduledSubPhase[];
}

/**
 * Sub-phases inside a phase that starts on `phaseStart`. The first starts with the phase. A sub-phase marked
 * withPrevious starts with the one directly above; any other starts after every earlier sub-phase has ended.
 */
export function scheduleSubPhases<S extends SubPhaseInput>(phaseStart: ISODate, subs: S[], cal: WorkCalendar): (S & ScheduledSubPhase)[] {
  const result: (S & ScheduledSubPhase)[] = [];
  let latestEnd: ISODate | null = null;
  subs.forEach((sub, index) => {
    const withPrevious = index > 0 && sub.withPrevious === true;
    const start = withPrevious
      ? result[index - 1].start
      : latestEnd === null
        ? nextWorkingDay(phaseStart, cal)
        : nextWorkingDay(addDays(latestEnd, 1), cal);
    const end = addWorkingDays(start, sub.durationDays, cal);
    result.push({ ...sub, order: index, start, end, withPrevious });
    if (latestEnd === null || end > latestEnd) latestEnd = end;
  });
  return result;
}

export function schedulePhases<P extends PhaseInput>(projectStart: ISODate, phases: P[], cal: WorkCalendar): (P & ScheduledPhase)[] {
  const result: (P & ScheduledPhase)[] = [];
  let cursor = projectStart;
  phases.forEach((phase, index) => {
    const start = nextWorkingDay(cursor, cal);
    const subPhases = scheduleSubPhases(start, phase.subPhases ?? [], cal);
    let end: ISODate;
    let durationDays = phase.durationDays;
    if (subPhases.length === 0) {
      end = addWorkingDays(start, phase.durationDays, cal);
    } else {
      end = subPhases.reduce((latest, s) => (s.end > latest ? s.end : latest), subPhases[0].end);
      durationDays = countWorkingDays(start, end, cal);
    }
    result.push({ ...phase, order: index, start, end, durationDays, subPhases });
    cursor = addDays(end, 1);
  });
  return result;
}
```

Keep `projectSpan` as it is. It is only ever given top-level phases, and those already span their sub-phases. If TypeScript complains that the spread result doesn't match `P & ScheduledPhase`, cast at the `push` (`as P & ScheduledPhase`). Don't loosen the return type.

- [ ] **Step 5: Types and schemas**

In `shared/types.ts`, add `SubPhaseRecord` and extend `PhaseRecord` exactly as in **Interfaces** above. Give `subPhases` the doc comment: "Ordered by order. A sub-phase's dates sit inside its phase."

In `shared/schemas.ts`, pull the phase duration rule into a shared constant, and add sub-phases:

```ts
const workingDays = z
  .number({ invalid_type_error: 'Duration must be a number' })
  .int('Duration must be a whole number of days')
  .min(1, 'Duration must be at least 1 working day')
  .max(2000, 'Duration is too long');

export const subPhaseInputSchema = z.object({
  name: z.string().trim().min(1, 'Sub-phase name is required').max(200),
  durationDays: workingDays,
  withPrevious: z.boolean().default(false),
  assignments: phaseAssignmentsSchema.default([]),
});

export const phaseInputSchema = z.object({
  name: z.string().trim().min(1, 'Phase name is required').max(200),
  durationDays: workingDays,
  assignments: phaseAssignmentsSchema.default([]),
  subPhases: z.array(subPhaseInputSchema).max(100, 'A phase can have at most 100 sub-phases').default([]),
});

export type SubPhaseInputData = z.output<typeof subPhaseInputSchema>;
```

- [ ] **Step 6: Create and read (`server/projects/repo.ts`)**

- Add `parent_id: number | null` and `with_previous: number` to `PhaseRow`.
- Replace `toPhase` with a nesting helper:

```ts
/** Top-level phases in order, each with its sub-phases in order. Rows may come in any order. */
function nestPhases(rows: PhaseRow[]): PhaseRecord[] {
  const subs = new Map<number, SubPhaseRecord[]>();
  for (const r of rows) {
    if (r.parent_id === null) continue;
    const list = subs.get(r.parent_id) ?? [];
    list.push({
      id: r.id, name: r.name, order: r.sort_order, durationDays: r.duration_days,
      start: r.planned_start, end: r.planned_end, withPrevious: r.with_previous === 1,
    });
    subs.set(r.parent_id, list);
  }
  return rows
    .filter((r) => r.parent_id === null)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((r) => ({
      id: r.id, name: r.name, order: r.sort_order, durationDays: r.duration_days, start: r.planned_start, end: r.planned_end,
      subPhases: (subs.get(r.id) ?? []).sort((a, b) => a.order - b.order),
    }));
}
```

- `getProject`: load all of the project's phase rows (`SELECT * FROM phases WHERE project_id = ?`), and pass `nestPhases(rows)` to `toProject`.
- `listProjects`: group all phase rows by project with the existing `byProject(rows, (r) => r)`, then call `nestPhases` for each project.
- `createProject`: after inserting each top-level phase, insert its sub-phases and save their assignments:

```ts
    const insertPhase = db.prepare(
      `INSERT INTO phases (project_id, parent_id, name, sort_order, duration_days, planned_start, planned_end, with_previous)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    scheduled.forEach((p, i) => {
      const phaseId = Number(insertPhase.run(projectId, null, p.name, p.order, p.durationDays, p.start, p.end, 0).lastInsertRowid);
      saveAssignments(db, phaseId, input.phases[i].assignments);
      p.subPhases.forEach((s, j) => {
        const subId = Number(
          insertPhase.run(projectId, phaseId, s.name, s.order, s.durationDays, s.start, s.end, s.withPrevious ? 1 : 0).lastInsertRowid,
        );
        saveAssignments(db, subId, input.phases[i].subPhases[j].assignments);
      });
    });
```

- [ ] **Step 7: Assignments and workload (`server/assignments/repo.ts`)**

- `SELECT_ASSIGNMENTS` joins each phase's parent so that results sort in plan order. A phase's own people come first, then each of its sub-phases' people:

```ts
const SELECT_ASSIGNMENTS = `
  SELECT a.*, r.name AS resource_name, p.project_id
  FROM assignments a
  JOIN resources r ON r.id = a.resource_id
  JOIN phases p ON p.id = a.phase_id
  LEFT JOIN phases parent ON parent.id = p.parent_id`;
const PLAN_ORDER = 'COALESCE(parent.sort_order, p.sort_order), p.parent_id IS NOT NULL, p.sort_order, a.id';
```

  `projectAssignments` uses `ORDER BY ${PLAN_ORDER}`, and `assignmentsByProject` uses `ORDER BY p.project_id, ${PLAN_ORDER}`.
- `workloadData`'s assignment query adds `LEFT JOIN phases parent ON parent.id = p.parent_id` and selects `CASE WHEN parent.id IS NULL THEN p.name ELSE parent.name || ' › ' || p.name END AS phase_name`.

- [ ] **Step 8: Phases list (`server/lists/repo.ts`)**

- The `phase` usage SQL becomes `SELECT COUNT(DISTINCT project_id) AS n FROM phases WHERE parent_id IS NULL AND name = ? COLLATE NOCASE`.
- The rename becomes `UPDATE phases SET name = ? WHERE parent_id IS NULL AND name = ? COLLATE NOCASE`.

- [ ] **Step 9: The create route checks sub-phase people (`server/app.ts`)**

In `POST /api/projects`, the list of issues also checks every sub-phase:

```ts
      ...parsed.data.phases.flatMap((p, i) => [
        ...checkAssignmentPeople(db, p.assignments, `phases.${i}.assignments`),
        ...p.subPhases.flatMap((s, j) => checkAssignmentPeople(db, s.assignments, `phases.${i}.subPhases.${j}.assignments`)),
      ]),
```

- [ ] **Step 10: Fixtures**

In `client/testing/mockFetch.ts`, add `subPhases: []` to every phase object in `sampleProject`, and in any other fixture that builds `PhaseRecord`s (grep for `durationDays:`). Run `npm run typecheck` to find any that are left.

- [ ] **Step 11: Run the tests, the whole suite and the type check**

Run: `npx vitest run shared/scheduler.test.ts server`, then `npm test`, then `npm run typecheck`.
Expected: everything passes, and typecheck exits with code 0. The existing scheduler, project, workload and demo tests must pass unchanged, apart from the fixture additions.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: sub-phases in the schedule, saved with their people and shown as Phase › Sub-phase in the workload"
```

---

### Task 2: Editing a project's phases — the schedule API

**Files:**
- Modify: `shared/schemas.ts`, `shared/types.ts`, `server/projects/repo.ts`, `server/app.ts`, `client/api.ts`
- Test: `server/projects/projects.test.ts`, `server/app.test.ts`

**Interfaces:**
- Consumes: `schedulePhases` and the sub-phase rules (Task 1); `nestPhases` and `getProject` (Task 1); `transaction` (`server/db.ts`).
- Produces:
  - `shared/schemas.ts`:
    ```ts
    export const scheduleSubPhaseSchema   // { id?: number; name; durationDays; withPrevious }
    export const schedulePhaseSchema      // { id?: number; name; durationDays; subPhases: scheduleSubPhase[] }
    export const scheduleUpdateSchema     // { startDate: ISODate; phases: schedulePhase[] (at least 1) }
    export type ScheduleUpdateInput = z.input<typeof scheduleUpdateSchema>;
    export type ScheduleUpdate = z.output<typeof scheduleUpdateSchema>;
    ```
  - `shared/types.ts`: `export interface ScheduleSaved { project: ProjectRecord; addedPhaseIds: number[] }`. `addedPhaseIds` holds the ids of **new top-level** phases only. Task 9 uses it to offer starter to-dos.
  - `server/projects/repo.ts`:
    ```ts
    export type ScheduleResult =
      | { ok: true; saved: ScheduleSaved }
      | { ok: false; status: 404; error: string }
      | { ok: false; status: 400; issues: ValidationIssue[] };
    export function updateSchedule(db: DatabaseSync, cal: WorkCalendar, projectId: number, input: ScheduleUpdate): ScheduleResult
    ```
  - `PUT /api/projects/:id/schedule` responds:
    - 200 with `ScheduleSaved`;
    - 400 `{ error: 'Invalid schedule', issues }`;
    - 404 `{ error: 'Project not found' }`.
  - `client/api.ts`: `updateSchedule: (id: number, input: ScheduleUpdateInput) => request<ScheduleSaved>(\`/api/projects/${id}/schedule\`, withBody('PUT', input))`.

**Rules:**
- The request is the whole new structure: the start date, then every top-level phase in order, each with every sub-phase in order.
  - A phase or sub-phase that carries an `id` is an existing one; it is updated in place and **keeps its people** (assignments).
  - An item without an `id` is new.
  - Any existing phase or sub-phase of the project that is not in the request is **deleted**, along with its people (the existing `ON DELETE CASCADE`). A deleted phase's own sub-phases go with it, unless they were sent under another phase.
- Assignments are not part of this request. People are changed on the People card, as today.
- **Id validation** (all problems are collected and returned together; nothing is saved when there is any):
  - A top-level `id` must be an existing **top-level** phase of this project. Otherwise: `phases.<i>.id` → "Unknown phase".
  - A sub-phase `id` must be an existing **sub-phase** of this project. It may currently belong to a different phase; it moves. Otherwise: `phases.<i>.subPhases.<j>.id` → "Unknown sub-phase".
  - An id may appear only once in the request. A repeat is reported on its second occurrence: "The same phase appears twice".
- Dates, orders and working days are recomputed with `schedulePhases(startDate, phases, getCalendar(db))`. The project's `start_date` is updated too.
- Everything happens in one transaction, in this order:
  1. update the start date;
  2. update or insert every phase and sub-phase in the request (existing sub-phases get their new `parent_id` here);
  3. delete the project's phase rows whose ids were neither updated nor inserted.

  Moving sub-phases before deleting means a moved sub-phase survives the deletion of its old phase.

- [ ] **Step 1: Write the failing tests**

In `server/projects/projects.test.ts`, add a `describe('updateSchedule', …)` block. Create the project with the existing helpers (start `2026-10-05`, a Monday): phases **A** (5 days), **B** (5 days, one assignment on it), and **C** (5 days, with sub-phases **C1** of 3 days and **C2** of 2 days, and one assignment on C2). Each test reads the ids back from `getProject`.

```ts
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
```

Add these tests too, each with explicit expectations:
- **New items.** Adding a new top-level phase and a new sub-phase under **A**:
  - both get ids;
  - `addedPhaseIds` equals `[<the new top-level phase's id>]` only;
  - A's dates now span its new sub-phase.
- **Removing a phase.** Leaving **B** out of the request deletes it, and its assignment is gone from `projectAssignments`.
- **Moving a sub-phase.** Sending **C2** (with its id) under **A** and leaving **C** out entirely:
  - C and C1 are deleted;
  - C2 is now A's sub-phase and still has its assignment.
- **Changing the start date** to `2026-10-12` moves every phase and sub-phase by one week.
- **Unknown or misplaced ids.** Each of these returns `{ ok: false, status: 400 }` with the stated path and message, and changes nothing (`getProject` is unchanged afterwards):
  - an id from another project at top level: `phases.0.id` "Unknown phase";
  - a sub-phase id sent at top level: `phases.0.id` "Unknown phase";
  - a top-level id sent as a sub-phase: `phases.0.subPhases.0.id` "Unknown sub-phase";
  - the same id twice: "The same phase appears twice" at the second occurrence's path.
- **Missing project.** A project that doesn't exist returns `{ ok: false, status: 404 }`.

In `server/app.test.ts`:
- `PUT /api/projects/:id/schedule` with a valid body returns 200 and `{ project, addedPhaseIds }`;
- an empty `phases` array returns 400 with "Add at least one phase";
- a missing project returns 404;
- after a schedule change, `GET /api/workload` shows the moved assignment's new dates.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run server/projects server/app.test.ts`
Expected: FAIL. `updateSchedule` and `scheduleUpdateSchema` don't exist.

- [ ] **Step 3: Schemas and type**

In `shared/schemas.ts`, reuse Task 1's `workingDays` constant and pull the two name rules into constants that both the create and schedule schemas use:

```ts
const phaseName = z.string().trim().min(1, 'Phase name is required').max(200);
const subPhaseName = z.string().trim().min(1, 'Sub-phase name is required').max(200);
const existingId = z.number().int().positive().optional();

export const scheduleSubPhaseSchema = z.object({
  id: existingId,
  name: subPhaseName,
  durationDays: workingDays,
  withPrevious: z.boolean().default(false),
});

export const schedulePhaseSchema = z.object({
  id: existingId,
  name: phaseName,
  durationDays: workingDays,
  subPhases: z.array(scheduleSubPhaseSchema).max(100, 'A phase can have at most 100 sub-phases').default([]),
});

export const scheduleUpdateSchema = z.object({
  startDate: isoDate,
  phases: z.array(schedulePhaseSchema).min(1, 'Add at least one phase'),
});

export type ScheduleUpdateInput = z.input<typeof scheduleUpdateSchema>;
export type ScheduleUpdate = z.output<typeof scheduleUpdateSchema>;
```

Switch `phaseInputSchema` and `subPhaseInputSchema` to use `phaseName` and `subPhaseName`. The messages don't change.

In `shared/types.ts`, add `ScheduleSaved`, as in **Interfaces**.

- [ ] **Step 4: `updateSchedule` (`server/projects/repo.ts`)**

```ts
export type ScheduleResult =
  | { ok: true; saved: ScheduleSaved }
  | { ok: false; status: 404; error: string }
  | { ok: false; status: 400; issues: ValidationIssue[] };

/** Every id must be this project's phase at the same level, and appear once. */
function checkScheduleIds(db: DatabaseSync, projectId: number, input: ScheduleUpdate): ValidationIssue[] {
  const rows = db.prepare('SELECT id, parent_id FROM phases WHERE project_id = ?').all(projectId) as unknown as
    { id: number; parent_id: number | null }[];
  const topLevel = new Set(rows.filter((r) => r.parent_id === null).map((r) => r.id));
  const subLevel = new Set(rows.filter((r) => r.parent_id !== null).map((r) => r.id));
  const seen = new Set<number>();
  const issues: ValidationIssue[] = [];
  const check = (id: number | undefined, allowed: Set<number>, path: string, unknown: string) => {
    if (id === undefined) return;
    if (seen.has(id)) issues.push({ path, message: 'The same phase appears twice' });
    else if (!allowed.has(id)) issues.push({ path, message: unknown });
    seen.add(id);
  };
  input.phases.forEach((p, i) => {
    check(p.id, topLevel, `phases.${i}.id`, 'Unknown phase');
    p.subPhases.forEach((s, j) => check(s.id, subLevel, `phases.${i}.subPhases.${j}.id`, 'Unknown sub-phase'));
  });
  return issues;
}

/** Replaces the project's start date and phase structure, keeping every phase sent back by id with its people. */
export function updateSchedule(db: DatabaseSync, cal: WorkCalendar, projectId: number, input: ScheduleUpdate): ScheduleResult {
  if (!db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId)) return { ok: false, status: 404, error: 'Project not found' };
  const issues = checkScheduleIds(db, projectId, input);
  if (issues.length > 0) return { ok: false, status: 400, issues };

  const scheduled = schedulePhases(input.startDate, input.phases, cal);
  const addedPhaseIds: number[] = [];
  transaction(db, () => {
    db.prepare('UPDATE projects SET start_date = ? WHERE id = ?').run(input.startDate, projectId);
    const update = db.prepare(
      `UPDATE phases SET parent_id = ?, name = ?, sort_order = ?, duration_days = ?, planned_start = ?, planned_end = ?, with_previous = ?
       WHERE id = ?`,
    );
    const insert = db.prepare(
      `INSERT INTO phases (project_id, parent_id, name, sort_order, duration_days, planned_start, planned_end, with_previous)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const kept = new Set<number>();
    const save = (id: number | undefined, parentId: number | null, s: { name: string; order: number; durationDays: number; start: string; end: string }, withPrevious: boolean): number => {
      const flag = withPrevious ? 1 : 0;
      if (id !== undefined) {
        update.run(parentId, s.name, s.order, s.durationDays, s.start, s.end, flag, id);
        kept.add(id);
        return id;
      }
      const newId = Number(insert.run(projectId, parentId, s.name, s.order, s.durationDays, s.start, s.end, flag).lastInsertRowid);
      kept.add(newId);
      return newId;
    };
    scheduled.forEach((p, i) => {
      const phaseId = save(input.phases[i].id, null, p, false);
      if (input.phases[i].id === undefined) addedPhaseIds.push(phaseId);
      p.subPhases.forEach((s, j) => save(input.phases[i].subPhases[j].id, phaseId, s, s.withPrevious));
    });
    const all = db.prepare('SELECT id FROM phases WHERE project_id = ?').all(projectId) as unknown as { id: number }[];
    const remove = db.prepare('DELETE FROM phases WHERE id = ?');
    for (const { id } of all) if (!kept.has(id)) remove.run(id);
  });
  return { ok: true, saved: { project: getProject(db, projectId)!, addedPhaseIds } };
}
```

- [ ] **Step 5: Route (`server/app.ts`)**

```ts
  app.put<{ Params: { id: string } }>('/api/projects/:id/schedule', async (req, reply) => {
    const parsed = scheduleUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid schedule', issues: toIssues(parsed.error) });
    const result = updateSchedule(db, getCalendar(db), Number(req.params.id), parsed.data);
    if (result.ok) return result.saved;
    if (result.status === 404) return reply.code(404).send({ error: result.error });
    return reply.code(400).send({ error: 'Invalid schedule', issues: result.issues });
  });
```

Add `updateSchedule` to `client/api.ts`, as in **Interfaces**.

- [ ] **Step 6: Run the tests, the whole suite and the type check**

Run: `npx vitest run server/projects server/app.test.ts`, then `npm test`, then `npm run typecheck`.
Expected: everything passes.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: change a project's phases and sub-phases after creation, keeping people on the phases that stay"
```

---

### Task 3: Sub-phases on the Gantt charts and the project page

**Files:**
- Modify: `client/gantt/rows.ts`, `client/pages/manage/ProjectPage.tsx` (the Phases table), `client/styles.css`
- Test: `client/gantt/rows.test.ts` (it exists; if not, create it), `client/pages/manage/ProjectPage.test.tsx`, `client/pages/present/FocusPage.test.tsx` (create it if missing)

**Interfaces:**
- Consumes: `PhaseRecord.subPhases` and `SubPhaseRecord` (Task 1); `ScheduledPhase.subPhases` (Task 1, used by the wizard preview); `phaseColorFor` (M1).
- Produces:
  - `phaseRows(project)` returns, for each phase, its own row followed by one row per sub-phase.
    - A sub-phase row has `kind: 'child'`, so its label is indented. Its row id and bar id are the sub-phase's id, or `"<phase order>-<sub order>"` in a draft with no ids.
    - The bar has `color: phaseColorFor(<parent phase name>)`, `label: <sub-phase name>` and `title: "<phase> › <sub-phase>: <start> → <end>"`.
  - `portfolioRows` and `groupedPortfolioRows` are **unchanged**. The portfolio shows one bar per top-level phase.

**Where it shows:**
- **Project page Gantt**, **wizard Step 3 preview** and **Presentation focus view.** All three already call `phaseRows`, so they pick sub-phases up with no further change. The focus view is M5's addition on the stakeholder side.
- **Project page "Phases" table.** Each sub-phase is its own row directly under its phase:
  - The first cell reads "↳ <name>", with class `sub-phase-name`, indented by `var(--sp-4)`.
  - A sub-phase that starts with the one above adds a muted " · starts with the one above".
  - A phase with sub-phases shows its working days followed by a muted "(from sub-phases)".
  - Dates use `dayDate` (for example "Mon 5 Oct"), as elsewhere since M4. Keep the existing columns (Phase, Start, End, Working days), and change the existing Start and End cells from raw ISO to `dayDate` as well.

- [ ] **Step 1: Write the failing tests**

In `client/gantt/rows.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { phaseColorFor, phaseRows, portfolioRows } from './rows';

const project = {
  phases: [
    { id: 1, order: 0, name: 'Requirements', start: '2026-10-05', end: '2026-10-09', subPhases: [] },
    {
      id: 2, order: 1, name: 'Development', start: '2026-10-12', end: '2026-10-23',
      subPhases: [
        { id: 3, order: 0, name: 'Increment 1', start: '2026-10-12', end: '2026-10-16' },
        { id: 4, order: 1, name: 'Increment 2', start: '2026-10-12', end: '2026-10-23' },
      ],
    },
  ],
};

describe('phaseRows with sub-phases', () => {
  it('puts each sub-phase on its own indented row under its phase, in the phase colour', () => {
    const rows = phaseRows(project);
    expect(rows.map((r) => [r.id, r.label, r.kind ?? 'row'])).toEqual([
      ['1', 'Requirements', 'row'],
      ['2', 'Development', 'row'],
      ['3', 'Increment 1', 'child'],
      ['4', 'Increment 2', 'child'],
    ]);
    expect(rows[2].bars[0]).toMatchObject({
      color: phaseColorFor('Development'),
      label: 'Increment 1',
      title: 'Development › Increment 1: 2026-10-12 → 2026-10-16',
    });
  });

  it('gives draft sub-phases without ids stable row ids', () => {
    const rows = phaseRows({ phases: [{ order: 0, name: 'Dev', start: '2026-10-05', end: '2026-10-09', subPhases: [{ order: 0, name: 'S', start: '2026-10-05', end: '2026-10-09' }] }] });
    expect(rows.map((r) => r.id)).toEqual(['0', '0-0']);
  });

  it('keeps the portfolio to one bar per top-level phase', () => {
    const [row] = portfolioRows([sampleProject({ phases: project.phases.map((p) => ({ ...p, durationDays: 5, subPhases: p.subPhases.map((sp) => ({ ...sp, durationDays: 5, withPrevious: false })) })) })]);
    expect(row.bars).toHaveLength(2);
  });
});
```

Start the file with `// @vitest-environment jsdom`, and import `sampleProject` from `../testing/mockFetch`.

In `client/pages/manage/ProjectPage.test.tsx`: with a project whose Development phase has sub-phases "Increment 1" and "Increment 2" (the second `withPrevious: true`):
- the Phases table shows a row containing "↳ Increment 1";
- a row containing "↳ Increment 2" and "starts with the one above";
- and the Development row contains "(from sub-phases)".
- The Gantt has a row with test id `gantt-row-<Increment 1's id>`.

In `client/pages/present/FocusPage.test.tsx`: the focus view's Gantt shows the sub-phase rows (by test id), and the page has no buttons or links other than the back link. That is the read-only guard.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run client/gantt client/pages/manage/ProjectPage.test.tsx client/pages/present`
Expected: FAIL. There are no sub-phase rows yet.

- [ ] **Step 3: `phaseRows` (`client/gantt/rows.ts`)**

```ts
interface PhaseLike {
  id?: number;
  order: number;
  name: string;
  start: ISODate;
  end: ISODate;
  subPhases?: { id?: number; order: number; name: string; start: ISODate; end: ISODate }[];
}

export function phaseRows(project: { phases: PhaseLike[] }): GanttRow[] {
  return project.phases.flatMap((p) => {
    const id = String(p.id ?? p.order);
    const color = phaseColorFor(p.name);
    const own: GanttRow = {
      id,
      label: p.name,
      bars: [{ id, start: p.start, end: p.end, color, label: p.name, title: `${p.name}: ${p.start} → ${p.end}` }],
    };
    const subs: GanttRow[] = (p.subPhases ?? []).map((s) => {
      const subId = s.id !== undefined ? String(s.id) : `${p.order}-${s.order}`;
      return {
        id: subId,
        label: s.name,
        kind: 'child',
        bars: [{ id: subId, start: s.start, end: s.end, color, label: s.name, title: `${p.name} › ${s.name}: ${s.start} → ${s.end}` }],
      };
    });
    return [own, ...subs];
  });
}
```

- [ ] **Step 4: The project page's Phases table**

In `ProjectPage.tsx`, render each phase row followed by its sub-phase rows, as described in **Where it shows**. Import `dayDate` from `client/overloads.ts`. Add to `client/styles.css`:

```css
.sub-phase-name { padding-left: var(--sp-4); }
```

- [ ] **Step 5: Run the tests, the whole suite and the type check**

Run: `npx vitest run client`, then `npm test`, then `npm run typecheck`.
Expected: everything passes. Existing ProjectPage tests that assert raw ISO dates in the Phases table are updated to the `dayDate` form, not deleted.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: sub-phases on the project, preview and focus Gantt charts and in the phases table"
```

---

### Task 4: The phases editor with sub-phases, and the Edit phases page

**Files:**
- Create: `client/pages/manage/SubPhaseList.tsx`, `client/pages/manage/EditPhasesPage.tsx`
- Modify: `shared/scheduler.ts` (add `subPhaseSpan`), `client/pages/manage/PhasesFields.tsx`, `client/pages/manage/projectDraft.ts`, `client/pages/manage/ProjectPage.tsx` (the "Edit phases" link), `client/pages/manage/EditProjectPage.tsx` (the note), `client/App.tsx` (the route), `client/styles.css`
- Test: `shared/scheduler.test.ts`, `client/pages/manage/projectDraft.test.ts`, `client/pages/manage/EditPhasesPage.test.tsx` (new), `client/pages/manage/CreateProjectPage.test.tsx`, `client/pages/manage/ProjectPage.test.tsx`

**Interfaces:**
- Consumes: `schedulePhases`, `SubPhaseInput` (Task 1); `scheduleUpdateSchema`, `ScheduleUpdateInput`, `api.updateSchedule`, `ScheduleSaved` (Task 2); `phaseRows` (Task 3); `useReorder`, `moveItem` (M1); `OptionPicker` (M3).
- Produces:
  - `shared/scheduler.ts`: `export function subPhaseSpan(subs: SubPhaseInput[]): number`. It gives the working days a phase spans because of its sub-phases, using the same rules as `scheduleSubPhases` but counted in working days, so no calendar is needed. It returns 0 for an empty list.
  - `client/pages/manage/projectDraft.ts`:
    ```ts
    export interface SubPhaseDraft { id?: number; name: string; durationDays: number; withPrevious: boolean; assignments?: DraftAssignment[] }
    export interface PhaseDraft extends PhaseInput { id?: number; assignments?: DraftAssignment[]; subPhases?: SubPhaseDraft[] }
    export function phasesToInput(phases: PhaseDraft[])                    // now also maps subPhases, with their assignments
    export function scheduleFromProject(p: ProjectRecord): { startDate: string; phases: PhaseDraft[] }   // keeps ids
    export function scheduleToInput(startDate: string, phases: PhaseDraft[]): ScheduleUpdateInput      // ids, no assignments
    export function removedWithPeople(p: ProjectRecord, phases: PhaseDraft[]): { label: string; people: number }[]
    ```
    - `removedWithPeople` lists every saved phase and sub-phase whose id is no longer anywhere in `phases` and that has at least one assignment, in plan order.
    - A sub-phase's label is "Phase › Sub-phase".
    - A removed phase's sub-phases that were **not** moved elsewhere count as removed too.
  - Route `/manage/projects/:id/phases` → `EditPhasesPage`.

**What the user sees:**
- **In `PhasesFields`** (wizard Step 3 and the Edit phases page):
  - Under each phase row there is a `.sub-phases` block, indented by `var(--sp-5)`. It holds that phase's sub-phase rows, followed by a small secondary button, **"+ Add sub-phase"**, with `aria-label="Add sub-phase to phase <n>"`. A new sub-phase starts as `{ name: '', durationDays: 5, withPrevious: false }`.
  - **A sub-phase row** is a grip handle, a name text input, a working-days number input, a "Starts" select and a remove button:
    - The grip handle has `aria-label="Reorder phase <n> sub-phase <m>"`, and dragging reorders within the phase only.
    - The name input has `aria-label="Phase <n> sub-phase <m> name"` and `placeholder="e.g. Increment 1 – Sign-in"`.
    - The working-days input has `aria-label="Phase <n> sub-phase <m> working days"`.
    - The "Starts" select has `aria-label="Phase <n> sub-phase <m> starts"` and the options **"After the ones above"** (`after`) and **"With the one above"** (`with`). The first sub-phase has no select; it shows a muted "Starts with the phase".
    - The remove button has `aria-label="Remove phase <n> sub-phase <m>"`.
  - **A phase that has sub-phases** replaces its working-days input with `<span className="derived-days" aria-label="Phase <n> working days">N working days (from sub-phases)</span>`, where N is `subPhaseSpan(subPhases)`, counting valid sub-phases only.
  - **The Preview Gantt** shows the valid sub-phases, those with a name and at least 1 day, as indented rows under their phase (Task 3).
- **The Edit phases page** (`/manage/projects/:id/phases`):
  - A back link to the project, then the heading **"Edit phases"**, then the hint "People stay on the phases you keep. Removing a phase also removes the people assigned to it."
  - The page loads the project and fills `PhasesFields` from `scheduleFromProject`. The phase dropdowns come from `useLists()`.
  - It has **Cancel** (a link back to the project) and **Save phases**.
  - On Save:
    1. Validate `scheduleToInput(...)` with `scheduleUpdateSchema`, and show any issues in the usual `.errors` alert.
    2. Then, if `removedWithPeople` is not empty and hasn't been confirmed, show a `role="alert"` block without saving: "Saving will remove Development › Increment 2 (2 people) and QA (1 person). The people on them will be unassigned." It has the buttons **Save anyway** and **Keep editing**. Join the items with commas and a final "and"; write "1 person" or "N people".
    3. Otherwise call `api.updateSchedule`, then `navigate(\`/manage/projects/${id}\`)`. Task 9 extends this navigation.
  - Server issues from a 400 are shown in the same alert.
- **The project page header** gets a secondary link, **"Edit phases"**, to `/manage/projects/:id/phases`, beside "Edit details".
- **The Edit details page**'s muted note becomes "Phases are changed on their own page: " followed by a link, "Edit phases".

- [ ] **Step 1: Write the failing tests**

In `shared/scheduler.test.ts`:

```ts
  it('counts the working days a phase spans because of its sub-phases', () => {
    expect(subPhaseSpan([])).toBe(0);
    expect(subPhaseSpan([{ name: 'A', durationDays: 5 }, { name: 'B', durationDays: 5 }])).toBe(10);
    expect(subPhaseSpan([{ name: 'A', durationDays: 5 }, { name: 'B', durationDays: 3, withPrevious: true }, { name: 'C', durationDays: 2 }])).toBe(7);
    expect(subPhaseSpan([{ name: 'A', durationDays: 2 }, { name: 'B', durationDays: 6, withPrevious: true }])).toBe(6);
  });
```

In `client/pages/manage/projectDraft.test.ts`:
- `scheduleFromProject` → `scheduleToInput` round-trips a project with sub-phases: the ids, names, days and `withPrevious` values are kept, and no `assignments` key is present.
- `phasesToInput` maps a sub-phase's draft assignment with `resourceId: null` to `resourceId: 0`.
- `removedWithPeople`:
  - removing a sub-phase that has 2 assignments gives `[{ label: 'Development › Increment 2', people: 2 }]`;
  - moving that sub-phase under another phase gives `[]`;
  - removing a phase without people gives `[]`.

In `client/pages/manage/EditPhasesPage.test.tsx` (new; use `mockFetch` with `GET /api/projects/1`, `GET /api/lists` and `GET /api/settings/calendar`, render inside a `MemoryRouter` at `/manage/projects/1/phases` with the route, and add a stub route for `/manage/projects/:id` that renders "Project page"):
- The page shows each saved phase in the dropdowns, and each saved sub-phase in its own name input.
- **Add a sub-phase.** Click "Add sub-phase to phase 2", type "Increment 3" and 4 days, then click Save phases. The PUT body's phase 2 keeps its `id`, the new sub-phase has no `id`, and the page navigates to "Project page".
- **Remove a sub-phase that has people.** Click "Remove phase 2 sub-phase 1" on a sub-phase with an assignment, then Save phases. The alert names it, with "(1 person)", and no PUT has been sent. Clicking **Save anyway** sends the PUT without that sub-phase's id.
- **The derived days.** Phase 2's working days show "(from sub-phases)" and the right number.
- **Moving a sub-phase.** Pressing ArrowDown on the grip "Reorder phase 2 sub-phase 1" moves it below sub-phase 2. Check this through the name inputs' order.

In `client/pages/manage/CreateProjectPage.test.tsx`:
- On Step 3, add a sub-phase to the Development phase and go through to Create. The POST body's Development phase has `subPhases: [{ name: 'Increment 1', durationDays: 5, withPrevious: false, assignments: [] }]`.

In `client/pages/manage/ProjectPage.test.tsx`:
- A link named "Edit phases" points to `/manage/projects/1/phases`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run shared/scheduler.test.ts client/pages/manage`
Expected: FAIL.

- [ ] **Step 3: `subPhaseSpan`**

```ts
/** Working days a phase spans because of its sub-phases (same rules as scheduleSubPhases, counted in working days). */
export function subPhaseSpan(subs: SubPhaseInput[]): number {
  const starts: number[] = [];
  let latestEnd = -1;
  subs.forEach((s, i) => {
    const start = i > 0 && s.withPrevious === true ? starts[i - 1] : latestEnd + 1;
    starts.push(start);
    latestEnd = Math.max(latestEnd, start + s.durationDays - 1);
  });
  return latestEnd + 1;
}
```

- [ ] **Step 4: The draft helpers (`projectDraft.ts`)**

Implement the functions in **Interfaces**. `scheduleToInput` sends `id` only when it is set, and always sends `withPrevious`. `phasesToInput`:

```ts
export function phasesToInput(phases: PhaseDraft[]) {
  const people = (list: DraftAssignment[] = []) =>
    list.map((a) => ({ resourceId: a.resourceId ?? 0, allocation: a.allocation, role: a.role }));
  return phases.map(({ name, durationDays, assignments, subPhases = [] }) => ({
    name,
    durationDays,
    assignments: people(assignments),
    subPhases: subPhases.map((s) => ({ name: s.name, durationDays: s.durationDays, withPrevious: s.withPrevious, assignments: people(s.assignments) })),
  }));
}
```

- [ ] **Step 5: `SubPhaseList` and `PhasesFields`**

`SubPhaseList.tsx` renders one phase's sub-phase rows and "+ Add sub-phase". It owns its own `useReorder(subs.length, (from, to) => onChange(moveItem(subs, from, to)))`. A separate component is needed because hooks can't be called in a loop, and it keeps each phase's drag list separate. Its props are `phaseNumber: number`, `subs: SubPhaseDraft[]` and `onChange(subs)`.

`PhasesFields` changes:
- The prop types become `PhaseDraft[]`.
- Render `<SubPhaseList>` under each phase row.
- Swap the phase's working-days input for the derived span when it has sub-phases.
- The preview schedules only valid phases, and for each of those only its valid sub-phases.

Keep the existing phase-row markup and labels exactly as they are, so the M1 and M3 tests still pass.

- [ ] **Step 6: `EditPhasesPage`, the route and the links**

Build the page as described in **What the user sees**, following `EditProjectPage`'s structure: the loading and error states, `ApiError` issues, and `useLists` with `remember`. Add the route in `client/App.tsx` next to the other `/manage/projects/:id/...` routes. Add the "Edit phases" link to `ProjectPage`, and change `EditProjectPage`'s note.

Add to `client/styles.css`:

```css
.sub-phases { margin-left: var(--sp-5); display: grid; gap: var(--sp-2); margin-bottom: var(--sp-3); }
.sub-phase-row { display: grid; grid-template-columns: auto 1fr 6rem 12rem auto; gap: var(--sp-2); align-items: center; }
.derived-days { color: var(--muted); font-size: 0.875rem; }
@media (max-width: 640px) { .sub-phase-row { grid-template-columns: auto 1fr 5rem; } }
```

Match the existing `.phase-row` look. Adjust the column sizes if the existing CSS variables differ, but keep sub-phase rows usable at 390px wide. Their inputs may wrap onto a second line.

- [ ] **Step 7: Run the tests, the whole suite and the type check**

Run: `npx vitest run client shared`, then `npm test`, then `npm run typecheck`.
Expected: everything passes.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add, reorder and remove sub-phases in the wizard, and edit a project's phases on their own page"
```

---

### Task 5: People on sub-phases, and what each person is working on

**Files:**
- Create: `client/pages/manage/PersonWork.tsx`
- Modify: `client/pages/manage/PeopleFields.tsx`, `client/pages/manage/ProjectPeople.tsx`, `client/pages/manage/PersonPage.tsx`, `client/pages/manage/projectDraft.ts` (`stepOfIssue`), `client/styles.css`
- Test: `client/pages/manage/CreateProjectPage.test.tsx`, `client/pages/manage/ProjectPage.test.tsx`, `client/pages/manage/PersonPage.test.tsx`, `client/pages/manage/projectDraft.test.ts`

**Interfaces:**
- Consumes:
  - `PhaseRecord.subPhases` and the "Phase › Sub-phase" workload names (Task 1);
  - `PhaseDraft.subPhases` and `SubPhaseDraft` (Task 4);
  - `AssignmentsEditor`, `overloadsWith`, `phaseWarnings`, `plannedFrom`, `dayDate` and `useWorkload` (M4);
  - `api.setPhaseAssignments` (M4), which works for a sub-phase id unchanged.
- Produces:
  - `stepOfIssue` sends `phases.<i>.subPhases.<j>.assignments…` issues to Step 4 (index 3). Use the regex `/^phases\.\d+\.(subPhases\.\d+\.)?assignments/`.
  - `PersonWork({ personId, workload, today })`: the "Working on" card.

**What the user sees:**
- **Wizard Step 4 (People):**
  - Each phase's editor is followed by one editor per sub-phase, in a wrapper with class `sub-phase-people`, indented by `var(--sp-5)`.
  - The editor's `phaseName` is "Development › Increment 1". Its labels become, for example, "Development › Increment 1 person 1", and its add button reads "Add person to Development › Increment 1".
  - Its dates are the sub-phase's own scheduled dates.
  - Warnings count every phase and sub-phase of the new project together, as phases already do. Two parallel increments that book the same person in one week add up.
- **The project page's People card:**
  - After each phase block come its sub-phase blocks, each editable on its own.
  - The Edit and Save buttons' labels use the "Phase › Sub-phase" name, e.g. "Edit people on Development › Increment 1".
  - Saving calls `api.setPhaseAssignments(<sub-phase id>, …)`.
  - The live warnings use the sub-phase's dates and pass that sub-phase's saved assignment ids as `replacing`.
- **A person's page (tech side only), a "Working on" card** between the details form and the Leave card:
  - It lists every one of their assignments that ends today or later, sorted by start date, then by project name.
  - Each item is a link to the project (the project name), then " › " and the workload's `phaseName` (which already includes any sub-phase), then on a second, muted line the dates ("Mon 5 Oct – Fri 16 Oct"), the allocation and the role, e.g. "60% · Responsible".
  - An assignment running today gets a small "Now" badge (`.badge`).
  - If there are none, it shows "Nothing booked from today on."
  - It reads from `useWorkload()`, whose `assignments` include inactive people's work.

- [ ] **Step 1: Write the failing tests**

In `client/pages/manage/projectDraft.test.ts`: `stepOfIssue({ path: 'phases.2.subPhases.0.assignments.1.resourceId', message: 'x' })` is `3`.

In `client/pages/manage/CreateProjectPage.test.tsx`:
- Add a sub-phase "Increment 1" to Development on Step 3, then go to Step 4.
- Choose a person in the combobox named "Development › Increment 1 person 1" and create the project.
- The POST body's sub-phase has that assignment.
- A second test books the same person at 100% on two parallel sub-phases (the second "With the one above"), and a warning line appears under both.

In `client/pages/manage/ProjectPage.test.tsx`, with a project whose Development phase has sub-phase id 31 "Increment 1" and one saved assignment on it:
- the People card shows "Development › Increment 1" with that person;
- clicking "Edit people on Development › Increment 1", changing the allocation and clicking "Save people on Development › Increment 1" sends `PUT /api/phases/31/assignments`.

In `client/pages/manage/PersonPage.test.tsx`, fix today at `2026-10-07` and mock `GET /api/workload` with three of this person's assignments:
- one past;
- one running now: Case Management › QA, 2026-10-05 → 2026-10-09;
- one upcoming: E-Services Mobile App › Development › Increment 3 – Payments, 2026-11-02 → 2026-11-20, 60%, responsible.

Then check that:
- the "Working on" card lists the running and upcoming ones in that order, and not the past one;
- the running one shows "Now";
- the upcoming line reads "E-Services Mobile App › Development › Increment 3 – Payments" and "60% · Responsible";
- the project name is a link to `/manage/projects/<id>`.

A business contact's page has no "Working on" card.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run client/pages/manage`
Expected: FAIL.

- [ ] **Step 3: Implement**

- **`PeopleFields`:** `schedulePhases(startDate, phases, cal)` already schedules sub-phases (Task 1). Build `planned` from each phase's assignments **and** each scheduled sub-phase's `assignments`, using the sub-phase's dates and the name `"<phase> › <sub>"`. Then render the phase editor and each sub-phase's editor. `onChange` for a sub-phase replaces that sub-phase's `assignments` inside `phases[i].subPhases[j]`.
- **`ProjectPeople`:** pull the current per-phase block (both the view and edit states) into a local component, `PhasePeopleBlock`, that takes `{ id, label, start, end }`. Render it for each phase, and then for each of its sub-phases with `label = "<phase> › <sub>"`. Keep the phase-level labels exactly as they are today; the existing tests use them.
- **`PersonWork`:** build it as described in **What the user sees**. Use `ASSIGNMENT_ROLE_LABEL` from `labels.ts`. Render it from `PersonPage` for tech-side people, with `useWorkload()` and `todayLocal()`.

Add to `client/styles.css`:

```css
.sub-phase-people { margin-left: var(--sp-5); }
.work-list { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--sp-3); }
.work-list .muted { display: block; font-size: 0.875rem; }
```

If a `.badge` class doesn't exist yet, add one: a small pill in `var(--accent)` at low opacity, with 0.75rem text.

- [ ] **Step 4: Run the tests, the whole suite and the type check**

Run: `npx vitest run client`, then `npm test`, then `npm run typecheck`.
Expected: everything passes.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: assign people to sub-phases, and show what each person is working on"
```

---

### Task 6: To-dos and "I am" — storage and API

**Files:**
- Create: `server/todos/repo.ts`
- Modify: `server/db.ts` (append migration 9), `shared/types.ts`, `shared/schemas.ts` (to-do schemas, plus `removedToDos` on `scheduleUpdateSchema`), `server/settings.ts`, `server/resources/repo.ts`, `server/projects/repo.ts` (`updateSchedule` handles a removed phase's to-dos), `server/app.ts`, `client/api.ts`, `client/testing/mockFetch.ts` (add a `sampleToDos()` fixture)
- Test: `server/todos/todos.test.ts` (new), `server/resources/resources.test.ts`, `server/app.test.ts`

**Interfaces:**
- Consumes: `transaction`; `usageReasons` and `USAGE` (`server/resources/repo.ts`); `todayLocal`; `optionalText` and `optionalId` (`shared/schemas.ts`, already there).
- Produces:
  - `shared/types.ts`:
    ```ts
    export interface ToDoRecord {
      id: number;
      projectId: number;
      projectName: string;
      title: string;
      note: string | null;
      assignee: Ref | null;
      dueDate: ISODate | null;
      done: boolean;
      /** The day it was ticked off. */
      doneDate: ISODate | null;
      /** The phase or sub-phase it belongs to; a sub-phase's name reads "Phase › Sub-phase". */
      phase: Ref | null;
      /** Set when the phase it was linked to was removed and the to-do was kept; cleared once it is linked again. */
      formerPhase: { name: string; removedOn: ISODate } | null;
      createdAt: string;
    }
    /** Who "I am" is: the PM using the tool. */
    export interface Me { resourceId: number | null; name: string | null }
    ```
  - `shared/schemas.ts`:
    ```ts
    export const toDoInputSchema = z.object({
      title: z.string().trim().min(1, 'Write what needs doing').max(200, 'Keep the title under 200 characters'),
      note: optionalText(2000),
      assigneeId: optionalId,
      dueDate: isoDate.nullish().transform((v) => v ?? null),
      phaseId: optionalId,
      done: z.boolean().default(false),
    });
    export const meInputSchema = z.object({ resourceId: z.number().int().positive().nullable() });
    export type ToDoInput = z.input<typeof toDoInputSchema>;
    export type ToDoData = z.output<typeof toDoInputSchema>;
    ```
  - `server/settings.ts`: `getMe(db): Me` and `setMe(db, resourceId: number | null): void`, stored under the settings key `'me'` as `{"resourceId": n}`.
  - `server/todos/repo.ts`:
    ```ts
    export interface ToDoFilter { projectId?: number; assigneeId?: number; includeDone?: boolean }
    export function listToDos(db, filter?: ToDoFilter): ToDoRecord[]              // open first, then urgency order
    export function getToDo(db, id): ToDoRecord | undefined
    export function projectPeopleIds(db, projectId): Set<number>                    // PMs, assigned people, and "I am"
    export function checkToDo(db, projectId, data: ToDoData, existing?: ToDoRecord): ValidationIssue[]
    export function createToDo(db, projectId, data: ToDoData, today: ISODate): ToDoRecord
    export function updateToDo(db, id, data: ToDoData, today: ISODate): ToDoRecord | undefined
    export function deleteToDo(db, id): boolean
    ```
  - Routes:
    | Method and path | Answers |
    |---|---|
    | `GET /api/todos?projectId=&assigneeId=&done=include` | `ToDoRecord[]` |
    | `POST /api/projects/:id/todos` | 201 with the record; 400 `{ error: 'Invalid to-do', issues }`; 404 when the project is missing |
    | `PUT /api/todos/:id` | 200, 400 or 404 |
    | `DELETE /api/todos/:id` | 204 or 404 |
    | `GET /api/settings/me` | `Me` |
    | `PUT /api/settings/me` | 200 with `Me`; 400 when the person is not an active tech-team person |
  - `client/api.ts`: `listToDos(filter)`, `createToDo(projectId, input)`, `updateToDo(id, input)`, `deleteToDo(id)`, `getMe()`, `setMe(resourceId)`.
  - `client/testing/mockFetch.ts`: `sampleToDos(): ToDoRecord[]`. It includes one overdue item, one due later, one with no due date, one done, one linked to a sub-phase, and one assigned to a business contact. Use the sample people's ids.

**Rules:**
- **Migration 9:**

```sql
CREATE TABLE todos (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  note TEXT,
  assignee_id INTEGER REFERENCES resources(id),
  due_date TEXT,
  phase_id INTEGER REFERENCES phases(id) ON DELETE SET NULL,
  done_date TEXT,
  former_phase TEXT,
  former_phase_removed_on TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX todos_project ON todos(project_id);
CREATE INDEX todos_assignee ON todos(assignee_id);
```

- **"I am"** must be an **active tech-team** person. Otherwise `PUT /api/settings/me` answers 400 `{ error: 'Choose someone from your tech team' }`. `null` clears it. `getMe` returns `{ resourceId: null, name: null }` when it isn't set, or when the stored person no longer exists.
- **Assignee rule** (`checkToDo`):
  - `assigneeId` may be `null` (unassigned).
  - Otherwise, when creating, or when an update changes the assignee, it must be in `projectPeopleIds(db, projectId)`: the project's tech PM, its business PM, anyone assigned to any of its phases or sub-phases, and "I am". If it isn't, the issue is `assigneeId` → "`<name>` isn't on this project", or "Unknown person" when there is no such person.
  - An update that keeps the same assignee is not checked, so someone who has left the project keeps their to-dos.
- **Phase rule:** `phaseId` may be `null`. Otherwise it must be a phase or sub-phase of this project. If not, the issue is `phaseId` → "Unknown phase".
- **Done:**
  - An update with `done: true` on an open to-do sets `done_date` to today.
  - `done: true` on one that is already done keeps its original date.
  - `done: false` clears it.
  - A create with `done: true` sets it to today.
- **Order of `listToDos`:**
  1. open before done;
  2. open ones by `due_date` ascending, with undated ones after dated ones;
  3. ties by id;
  4. done ones by `done_date` descending.

  Filters combine: `projectId`, `assigneeId`, and `includeDone` (false by default).
- **The phase name** in a record is "Phase › Sub-phase" for a sub-phase. Get it with a `LEFT JOIN` to the parent phase.
- **The project must exist** for create: 404 `{ error: 'Project not found' }`.
- **Relinking clears the note.** An update that sets a `phaseId` clears `former_phase` and `former_phase_removed_on`.
- **Removed phases' to-dos** (this extends Task 2's `updateSchedule`):
  - `scheduleUpdateSchema` gains `removedToDos: z.enum(['keep', 'delete']).default('keep')`.
  - `updateSchedule` gains a `today: ISODate` parameter, which the route passes from `today()`.
  - Before deleting the phase rows that are not kept, handle every to-do linked to one of them (or to a sub-phase that goes with them):
    - **done** to-dos are deleted;
    - **open** ones, with `'delete'`, are deleted;
    - **open** ones, with `'keep'`, get `phase_id = NULL`, `former_phase = '<Phase>'` or `'<Phase> › <Sub-phase>'` (the name **before** this save), and `former_phase_removed_on = today`.

    All of this happens in the same transaction.
  - A to-do linked to a phase that is **kept** (even one that moves or is renamed) is untouched.
- **Filter:** `ToDoFilter` gains `fromRemovedPhases?: boolean`. When it is set, only to-dos with a `former_phase` are returned. The route reads it from `?removed=1`.
- **People in use:** add to `USAGE` in `server/resources/repo.ts`:

  ```ts
  { sql: 'SELECT COUNT(*) AS n FROM todos WHERE assignee_id = ?', reason: (n) => `they have ${n} to-do${n === 1 ? '' : 's'}`, sideChange: false },
  ```

  Mark the two existing entries `sideChange: true`, and make the side-change guard (`updateResourceChecked`) consider only entries with `sideChange: true`, while delete considers all of them. Also, when deleting a person succeeds, clear "I am" if it pointed at them. In practice this can't happen while they are in use, but it stays correct if that changes.

- [ ] **Step 1: Write the failing tests**

`server/todos/todos.test.ts` (new). Use `openDb(':memory:')`, and create people and a project with the existing repo helpers:
- a tech PM "Pat";
- a business PM "Bea";
- a tech person "Ted" assigned to a sub-phase;
- a tech person "Out", who is on no project;
- "Me", set with `setMe`.

Tests:
- **Assignees.** `checkToDo` accepts Pat, Bea (a business contact), Ted (through the sub-phase), Me and `null`. It rejects Out with "Out isn't on this project", and id 999 with "Unknown person".
- **Updates.** An update keeping Out as the assignee is accepted, after first inserting such a to-do directly with SQL. Changing a to-do's assignee to Out is rejected.
- **Phases.** A phase from another project is rejected with `phaseId` "Unknown phase". The project's own sub-phase is accepted, and the record's `phase.name` is "Development › Increment 1".
- **Done date.** Create, then set `done: true` with today `2026-10-07`: `doneDate` is `2026-10-07`. Updating again with `done: true` and today `2026-10-09` keeps `2026-10-07`. `done: false` clears it.
- **Order.** Open to-dos come in the order: overdue `2026-10-01`, then `2026-10-10`, then undated. Done ones are excluded unless `includeDone`. Filters by `projectId` and `assigneeId` work.
- **Removing a phase through `updateSchedule`,** with one open and one done to-do on sub-phase "Development › Increment 1":
  - With the default (`keep`, today `2026-09-25`), the open one has `phase: null` and `formerPhase: { name: 'Development › Increment 1', removedOn: '2026-09-25' }`, and the done one is gone.
  - With `removedToDos: 'delete'`, both are gone.
  - A to-do on a phase that is kept but renamed keeps its link, and `formerPhase` stays null.
- **Relinking.** Updating a kept to-do with a `phaseId` clears `formerPhase`.
- **The filter.** `listToDos(db, { fromRemovedPhases: true })` returns only to-dos with a `formerPhase`.
- **Deleting the project** deletes its to-dos.

In `server/resources/resources.test.ts`:
- deleting a person who has a to-do answers 409, with a message containing "they have 1 to-do";
- switching a business contact who has a to-do (and nothing else) to the tech team succeeds.

In `server/app.test.ts`:
- **To-dos:**
  - `POST /api/projects/:id/todos` answers 201 with the record, and 404 for a missing project;
  - `POST` with an empty title answers 400 with "Write what needs doing";
  - `PUT /api/todos/:id` with `done: true` answers with `done: true` and today's `doneDate` (the app is built with `today: () => '2026-10-07'`);
  - `DELETE` answers 204, then 404;
  - `GET /api/todos?assigneeId=<Ted>` returns only Ted's;
  - `GET /api/todos?done=include` includes done ones.
- **I am:**
  - `PUT /api/settings/me` with a business contact answers 400 with "Choose someone from your tech team";
  - with a tech person, then `GET /api/settings/me` returns their id and name;
  - `PUT` with `null` clears it.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run server`
Expected: FAIL. The `todos` table and routes don't exist.

- [ ] **Step 3: Implement**

- Add the migration, types, schemas, settings helpers, repo, `USAGE` change, routes and client API described above.
- `listToDos` builds one parameterised SQL statement. Its `WHERE` clauses are added only for the filters given, and each value is bound with `?`, never interpolated.
- The route reads query strings with `Number()` and ignores a filter that isn't a positive integer.

- [ ] **Step 4: Run the tests, the whole suite and the type check**

Run: `npx vitest run server`, then `npm test`, then `npm run typecheck`.
Expected: everything passes.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: to-dos with an on-the-project assignee rule, and who \"I am\" is, storage and API"
```

---

### Task 7: To-dos on the project page, Next up, and "I am" in Settings

**Files:**
- Create: `client/todos.ts`, `client/useMe.ts`, `client/components/ToDoForm.tsx`, `client/pages/manage/ProjectToDos.tsx`, `client/pages/manage/NextUp.tsx`, `client/pages/manage/MeSetting.tsx`
- Modify: `client/pages/manage/ProjectPage.tsx`, `client/pages/manage/SettingsPage.tsx`, `client/styles.css`
- Test: `client/todos.test.ts` (new), `client/pages/manage/ProjectPage.test.tsx`, `client/pages/manage/SettingsPage.test.tsx`

**Interfaces:**
- Consumes: `ToDoRecord`, `Me`, `toDoInputSchema`, `ToDoInput`, `api.listToDos/createToDo/updateToDo/deleteToDo/getMe/setMe` and `sampleToDos()` (Task 6); `PhaseRecord.subPhases` (Task 1); `dayDate` (M4); `messagesOf` (`client/errors.ts`); `useResources` (M4).
- Produces:
  - `client/todos.ts`:
    ```ts
    export function isOverdue(t: ToDoRecord, today: ISODate): boolean        // open, has a due date, and due before today
    export function byUrgency(list: ToDoRecord[]): ToDoRecord[]               // due date ascending, undated last, ties by id (a copy)
    export function dueLabel(t: ToDoRecord, today: ISODate): string           // "Overdue · Mon 12 Oct" | "Due today" | "Due Mon 12 Oct" | ""
    export function toDoToInput(t: ToDoRecord, patch?: Partial<ToDoInput>): ToDoInput
    export interface AssigneeChoices { me: Ref | null; managers: { id: number; label: string }[]; team: Ref[]; former: Ref | null }
    export function assigneeChoices(project: ProjectRecord, me: Me, current: Ref | null): AssigneeChoices
    export function phaseChoices(project: ProjectRecord): Ref[]              // phases and sub-phases in plan order, sub-phases as "Phase › Sub"
    ```
    `assigneeChoices`:
    - `me` is "I am", when it is set.
    - `managers` are the tech PM (labelled "<name> (project manager)") and the business PM (labelled "<name> (business PM)"), leaving out whoever is `me`.
    - `team` is everyone assigned to a phase or sub-phase, once each, sorted by name, leaving out `me` and the managers.
    - `former` is the current assignee when they are in none of those.
  - `useMe(): { me: Me | undefined; error; reload }`.
  - `ToDoForm({ project, me, initial, onSave, onCancel })`, where `onSave(input: ToDoInput) => Promise<void>` and server errors are shown with `messagesOf`.

**What the user sees:**
- **Project page, "Next up" card**, placed right after the page header and before Timeline:
  - It lists **my** open to-dos on this project (assignee = "I am"), with `byUrgency` and at most 3.
  - Each row has a checkbox (`aria-label="Done: <title>"`), the title, and a muted line with the due label and the phase name, when there is one. An overdue due label has class `overdue` (red, `var(--danger)`).
  - If "I am" isn't set, it shows "Set who you are in Settings to see your next steps here." with "Settings" as a link to `/manage/settings`.
  - If nothing is left, it shows "Nothing on your list for this project."
- **Project page, "To-dos" card**, placed after the People card:
  - **Header:** "To-dos", with a button, **"Add to-do"**, that opens `ToDoForm` inline at the top of the card.
  - **Open to-dos** in `byUrgency` order. Each shows:
    - a checkbox (`aria-label="Done: <title>"`);
    - the title;
    - a muted line with the assignee's name (or "Unassigned"), the due label (class `overdue` when overdue) and the phase name;
    - the note, if any, in muted text with `white-space: pre-wrap`;
    - an **Edit** button (`aria-label="Edit <title>"`), which swaps the row for `ToDoForm` filled from it;
    - a **Delete** button (`aria-label="Delete <title>"`). The first click turns the row's buttons into "Delete this to-do?" with the buttons **Delete** and **Keep**.
  - **Done to-dos:** under the list, a button **"Show N done"** / **"Hide done"** shows the done ones. They show a checked box (unticking reopens the to-do), a struck-through title and "Done Mon 12 Oct".
  - **Empty:** with no open to-dos, it shows "Nothing to do yet."
- **`ToDoForm` fields:**
  - **Title** (text, required);
  - **Assigned to** (a select):
    - "Unassigned";
    - "Me — <name>" when "I am" is set;
    - `<optgroup label="Project managers">`;
    - `<optgroup label="Team on this project">`;
    - and, when `former` is set, "<name> (no longer on this project)";
  - **Due** (date, optional);
  - **Phase** (a select): "Whole project", then `phaseChoices`;
  - **Note** (textarea, optional).

  The buttons are **Save to-do** and **Cancel**.
  - Validate with `toDoInputSchema` before sending. An empty title shows "Write what needs doing".
  - An empty date or select is sent as `null`.
  - New to-dos default the assignee to "Me" when "I am" is set.
- **Ticking a checkbox** (in Next up or To-dos) sends `api.updateToDo(id, toDoToInput(t, { done: true }))`, then both cards reload. `ProjectPage` loads the project's to-dos once, with `api.listToDos({ projectId, includeDone: true })`, and passes them to both cards together with a `reload`.
- **Settings, "I am" card** (`MeSetting`), the first card on the Settings page:
  - It has the heading "I am", the hint "Used for Mine, Next up and My next steps.", and a select labelled "I am" listing "Not set" and then every **active tech-team** person, sorted by name.
  - Changing it saves straight away with `api.setMe`, then shows "Saved" next to the select (`role="status"`).

- [ ] **Step 1: Write the failing tests**

`client/todos.test.ts` (new, with the jsdom header), using `sampleToDos()`, `sampleProject(...)` and a fixed `today = '2026-10-07'`:
- `isOverdue` is true only for the open item due before today, and false for done items and undated ones.
- `byUrgency` orders: overdue, then due later, then undated, with ties by id.
- `dueLabel` gives "Overdue · Thu 1 Oct" for `2026-10-01`, "Due today" for `2026-10-07`, "Due Sat 10 Oct" for `2026-10-10`, and "" when there is no due date.
- `assigneeChoices`:
  - with me = the tech PM, `managers` excludes them and `me` is set;
  - the business PM appears as "Bea … (business PM)";
  - `team` lists assigned people once each, sorted;
  - `former` is set for an assignee who isn't on the project.
- `phaseChoices` lists "Development" then "Development › Increment 1".

In `client/pages/manage/ProjectPage.test.tsx`, with the mock routes `GET /api/todos?projectId=1&done=include` (match the query string your `api.listToDos` builds), `GET /api/settings/me`, and `POST`/`PUT`/`DELETE` to-do routes:
- **Next up** shows my three most urgent open to-dos in order, with the overdue one's label "Overdue · Thu 1 Oct" carrying class `overdue`.
- With `me` not set, Next up shows the Settings link.
- **Add a to-do.** Click **Add to-do**, type a title, choose "Me — …" and a phase, then Save to-do. The POST body is `{ title, note: null, assigneeId: <me>, dueDate: null, phaseId: <id>, done: false }`, and the list reloads.
- **Empty title.** Saving with an empty title shows "Write what needs doing", and nothing is sent.
- **Ticking.** Ticking "Done: <title>" sends a PUT with `done: true`.
- **Delete.** Clicking Delete, then Delete in the confirmation, sends DELETE. Clicking Keep sends nothing.
- **Done to-dos.** "Show 1 done" reveals the done one with its "Done …" date.

In `client/pages/manage/SettingsPage.test.tsx`:
- the "I am" select lists active tech people only;
- choosing one sends `PUT /api/settings/me` with `{ resourceId }`, and "Saved" appears.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run client`
Expected: FAIL.

- [ ] **Step 3: Implement**

Build the files described above. Keep `ProjectPage` readable: it composes `NextUp`, `ProjectToDos` and the existing cards, while loading and reloading live in a small hook inside `ProjectToDos.tsx`, exported as `useProjectToDos(projectId)`.

Add to `client/styles.css`:

```css
.todo-list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--sp-3); }
.todo { display: grid; grid-template-columns: auto 1fr auto; gap: var(--sp-2) var(--sp-3); align-items: start; }
.todo input[type='checkbox'] { width: 1.25rem; height: 1.25rem; margin-top: 0.15rem; }
.todo-meta { color: var(--muted); font-size: 0.875rem; }
.todo-note { color: var(--muted); white-space: pre-wrap; font-size: 0.875rem; }
.todo.done .todo-title { text-decoration: line-through; color: var(--muted); }
.overdue { color: var(--danger); font-weight: 600; }
```

Use whichever existing variables are named for muted text and danger. The checkbox tap target must be at least 1.25rem on a phone.

- [ ] **Step 4: Run the tests, the whole suite and the type check**

Run: `npx vitest run client`, then `npm test`, then `npm run typecheck`.
Expected: everything passes.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: to-dos and a Next up card on the project page, and choosing who I am in Settings"
```

---

### Task 8: To-dos across projects — the To-dos page, My next steps and each person's to-dos

**Files:**
- Create: `client/pages/manage/ToDosPage.tsx`, `client/pages/manage/MyNextSteps.tsx`, `client/components/ToDoRow.tsx` (the shared read-only row, used by the To-dos page, My next steps and the person page)
- Modify: `client/App.tsx` (the route), `client/pages/manage/ManageDashboardPage.tsx`, `client/pages/manage/PersonPage.tsx`, `client/pages/manage/ProjectToDos.tsx` and `NextUp.tsx` (use `ToDoRow` for the read-only part of a row if that keeps them simpler; otherwise leave them), `client/pages/manage/EditPhasesPage.tsx` and `projectDraft.ts` (to-dos in the removal warning), `client/styles.css`
- Test: `client/pages/manage/ToDosPage.test.tsx` (new), `client/pages/manage/ManageDashboardPage.test.tsx`, `client/pages/manage/PersonPage.test.tsx`

**Interfaces:**
- Consumes: `api.listToDos`, `api.updateToDo`, `ToDoRecord`, `sampleToDos()` (Task 6); `byUrgency`, `isOverdue`, `dueLabel`, `toDoToInput` and `useMe` (Task 7).
- Produces:
  - Route `/manage/todos` → `ToDosPage`.
  - `ToDoRow({ todo, today, showProject, onToggle })`. It renders:
    - the checkbox, `aria-label="Done: <title>"`;
    - the title;
    - when `showProject` is set, the project name as a link to `/manage/projects/<id>`;
    - the muted line: assignee, due label and phase.

**What the user sees:**
- **The dashboard:**
  - A header link, **"To-dos"** (secondary button style), sits before "Resources".
  - A **"My next steps"** card sits right after the overbooking notice, before the Timeline.
    - It lists my open to-dos across **all** projects, with `byUrgency` and at most 5, each with its project name.
    - Overdue ones use class `overdue`.
    - A link, **"All to-dos"**, goes to `/manage/todos?assignee=me`.
    - If "I am" isn't set: "Set who you are in Settings to see your next steps here." with a link to Settings.
    - If nothing is left: "Nothing on your list. Nice."
    - Ticking a box marks it done and reloads the card.
- **The To-dos page** (`/manage/todos`):
  - A back link to Projects, then the heading "To-dos", then filters:
    - **Project** (a select): "All projects", then each project by name;
    - **Assigned to** (a select): "Anyone", "Mine" (only when "I am" is set), "Unassigned", then every person who appears as an assignee in the loaded to-dos, sorted by name;
    - **Show done** (a checkbox);
    - **From removed phases** (a checkbox). It is shown only when at least one loaded to-do has a `formerPhase`. When it is ticked, only those to-dos are shown. It is kept in the URL as `removed=1`.
  - The filters are kept in the URL query (`?project=3&assignee=me|unassigned|<id>&done=1`), so "All to-dos" links straight to Mine. Read them with `useSearchParams` and write them back with `setSearchParams(…, { replace: true })`.
  - It loads with `api.listToDos({ includeDone: true })` once and filters in the browser.
  - The list is open to-dos in `byUrgency` order, then, if Show done is ticked, a "Done" heading with the done ones, newest first. Each is a `ToDoRow` with `showProject`.
  - If nothing matches: "No to-dos match these filters."
- **A person's page** (both sides), a **"To-dos"** card after "Working on" (or after the details form for a business contact):
  - It lists that person's open to-dos across projects, with `byUrgency`, using `ToDoRow` with `showProject`.
  - If there are none: "No open to-dos."
  - Ticking one works as on the dashboard.
- **The removed-phase note:** wherever a to-do is shown (`ToDoRow`, the project's To-dos card and Next up), a to-do with a `formerPhase` gets a muted line: "Was on Development › Increment 2 (removed Fri 25 Sep)", using `dayDate` for the date.
- **The Edit phases warning covers to-dos** (this extends Task 4):
  - The page also loads the project's to-dos, with `api.listToDos({ projectId, includeDone: true })`.
  - `removedWithPeople` becomes `removedItems(project, phases, todos): { label: string; people: number; openToDos: number }[]`. It lists every removed phase or sub-phase that has people **or** open to-dos. Rename the function everywhere, and update Task 4's `removedWithPeople` tests to the new name and shape; don't drop them.
  - The warning reads: "Saving will remove Development › Increment 2 (2 people, 3 open to-dos)." Each part appears only when it isn't zero. The singular forms are "1 person" and "1 open to-do".
  - The line "The people on them will be unassigned." appears only when some people are affected.
  - When any open to-dos are affected, a radio group labelled "Their open to-dos" follows, with the options **Keep them on the project** (checked by default) and **Delete them**.
  - **Save anyway** sends `removedToDos` with the choice.
- **To-dos next to the work** (spec §3.8): in the person's "Working on" card (Task 5), under each assignment item, list that person's open to-dos linked to the same phase or sub-phase, as small muted lines ("☐ Review the payment provider's API documentation · Due Fri 18 Dec"). `PersonWork` gains an optional `todos: ToDoRecord[]` prop for this, and the page passes the same list it loaded for the To-dos card.

- [ ] **Step 1: Write the failing tests**

`client/pages/manage/ToDosPage.test.tsx` (new). Fix today at `2026-10-07`, and mock `GET /api/todos?done=include` with `sampleToDos()` plus a second project's to-do, and `GET /api/settings/me`:
- By default it shows every open to-do, overdue first, each with its project link; the done one is hidden.
- Choosing **Mine** shows only mine and puts `assignee=me` in the URL.
- Rendering at `/manage/todos?assignee=me` starts with Mine selected.
- Choosing a project filters to it.
- Ticking **Show done** shows a "Done" heading and the done to-do.
- **Unassigned** shows only to-dos without an assignee.
- A filter that matches nothing shows "No to-dos match these filters."
- Ticking a to-do sends a PUT with `done: true`.

In `client/pages/manage/ManageDashboardPage.test.tsx`:
- My next steps lists my open to-dos (at most 5) with their project names, and the overdue one has class `overdue`;
- "All to-dos" links to `/manage/todos?assignee=me`;
- with `me` not set, the Settings prompt shows;
- the header has a "To-dos" link to `/manage/todos`.

In `client/pages/manage/PersonPage.test.tsx`:
- a tech person's page shows a "To-dos" card with their open to-dos and project links;
- a business contact's page shows their to-dos too;
- a person with none shows "No open to-dos."
- in "Working on", the to-do linked to the "Increment 3 – Payments" sub-phase is shown under that assignment item.

In `client/pages/manage/ToDosPage.test.tsx`:
- a to-do with `formerPhase` shows "Was on Development › Increment 2 (removed Fri 25 Sep)";
- **From removed phases** appears only when such a to-do exists, and ticking it shows only those and puts `removed=1` in the URL.

In `client/pages/manage/EditPhasesPage.test.tsx`:
- Removing a sub-phase that has 1 person and 2 open to-dos shows "Saving will remove Development › Increment 2 (1 person, 2 open to-dos)." and the "Their open to-dos" radio group, with Keep checked.
- Choosing **Delete them**, then **Save anyway**, sends `removedToDos: 'delete'`.
- Removing a phase that has to-dos but no people still shows the warning, without the "unassigned" line.

In `client/pages/manage/projectDraft.test.ts`: `removedItems` counts only **open** to-dos, and counts the sub-phases of a removed phase unless they were moved.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run client/pages/manage`
Expected: FAIL.

- [ ] **Step 3: Implement**

Build the files described above.
- The dashboard and the person page each load with `api.listToDos({ assigneeId })`: the dashboard uses the "I am" id, and the person page uses the person's id. The dashboard skips the request when "I am" isn't set.
- Reuse `ToDoRow` rather than copying markup.

- [ ] **Step 4: Run the tests, the whole suite and the type check**

Run: `npx vitest run client`, then `npm test`, then `npm run typecheck`.
Expected: everything passes. Existing dashboard tests that count header links or cards are updated, not deleted.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: a To-dos page with filters, My next steps on the dashboard, and to-dos on each person's page"
```

---

### Task 9: Starter checklists per phase

**Files:**
- Create: `server/starters/repo.ts`, `client/pages/manage/StarterEditor.tsx`, `client/pages/manage/StarterOffer.tsx`
- Modify: `server/db.ts` (append migration 10), `shared/types.ts`, `shared/schemas.ts`, `server/app.ts`, `client/api.ts`, `client/pages/manage/SettingsPage.tsx`, `client/pages/manage/ProjectPage.tsx`, `client/pages/manage/CreateProjectPage.tsx`, `client/pages/manage/EditPhasesPage.tsx`
- Test: `server/starters/starters.test.ts` (new), `server/app.test.ts`, `client/pages/manage/SettingsPage.test.tsx`, `client/pages/manage/ProjectPage.test.tsx`, `client/pages/manage/CreateProjectPage.test.tsx`, `client/pages/manage/EditPhasesPage.test.tsx`

**Interfaces:**
- Consumes: `getMe` (Task 6); `createToDo` or the `todos` table (Task 6); `useProjectToDos` and its `reload` (Task 7); `ScheduleSaved.addedPhaseIds` (Task 2); the `phase` list (`list_values` where `list = 'phase'`).
- Produces:
  - `shared/types.ts`:
    ```ts
    export interface StarterToDo { id: number; phaseListId: number; title: string; order: number }
    export interface StarterSuggestion { phaseId: number; phaseName: string; title: string }
    ```
  - `shared/schemas.ts`:
    ```ts
    export const starterToDoInputSchema = z.object({ phaseListId: z.number().int().positive(), title: z.string().trim().min(1, 'Write what needs doing').max(200) });
    export const starterTitleSchema = z.object({ title: z.string().trim().min(1, 'Write what needs doing').max(200) });
    export const starterAcceptSchema = z.object({ items: z.array(z.object({ phaseId: z.number().int().positive(), title: z.string().trim().min(1).max(200) })).min(1).max(200) });
    ```
  - `server/starters/repo.ts`:
    ```ts
    export function listStarters(db): StarterToDo[]
    export function addStarter(db, data: z.output<typeof starterToDoInputSchema>): StarterToDo | { error: 'Unknown phase' }
    export function renameStarter(db, id: number, title: string): StarterToDo | undefined
    export function deleteStarter(db, id: number): boolean
    export function starterSuggestions(db, projectId: number, phaseIds?: number[]): StarterSuggestion[]
    export function acceptStarters(db, projectId: number, items: { phaseId: number; title: string }[], today: ISODate): ToDoRecord[] | { issues: ValidationIssue[] }
    ```
  - Routes:
    | Method and path | Answers |
    |---|---|
    | `GET /api/starter-todos` | `StarterToDo[]`, in Phases-list order and then `order` |
    | `POST /api/starter-todos` | 201; 400 "Unknown phase" when `phaseListId` isn't a Phases-list value |
    | `PUT /api/starter-todos/:id` | renames it: `{ title }` → 200, or 404 |
    | `DELETE /api/starter-todos/:id` | 204 or 404 |
    | `GET /api/projects/:id/starter-suggestions?phaseIds=1,2` | `StarterSuggestion[]`; without `phaseIds` it covers every top-level phase; 404 for a missing project |
    | `POST /api/projects/:id/todos/from-starters` | `{ items }` → 201 with `ToDoRecord[]`; 400 when a `phaseId` isn't one of this project's top-level phases |
  - `client/api.ts`: `listStarters`, `addStarter`, `renameStarter`, `deleteStarter`, `starterSuggestions(projectId, phaseIds?)`, `acceptStarters(projectId, items)`.

**Rules:**
- **Migration 10:**

```sql
CREATE TABLE starter_todos (
  id INTEGER PRIMARY KEY,
  phase_list_id INTEGER NOT NULL REFERENCES list_values(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);
CREATE INDEX starter_todos_phase ON starter_todos(phase_list_id);
```

- **Suggestions** are made for the project's **top-level** phases, in plan order (limited to `phaseIds` when given). A phase matches a Phases-list value when its name is the same, ignoring case. Every starter item of the matching value is suggested, in its order.
  - If the project has **two phases with the same name** (the demo's Customer Portal has two "Design" phases), each gets its own suggestions. That's correct, because each is its own piece of work.
- **Accepting** creates one to-do per item, in one transaction:
  - `phaseId` is the item's phase;
  - the assignee is "I am" when it is set, and `null` otherwise (the assignee rule is satisfied, because "I am" is always allowed);
  - there is no due date and no note.
- Starter items are **kept by Phases-list value**, so a rename in Settings keeps the checklist. Deleting a list value deletes its checklist (`ON DELETE CASCADE`). A value in use can't be deleted anyway.

**What the user sees:**
- **Settings, a "Starter to-dos" card** after the "I am" card:
  - The hint reads "Offered, ticked, when a project gets one of these phases. Nothing is added unless you keep it."
  - A select, labelled "Phase", lists the Phases-list values, each followed by its item count, e.g. "UAT (3)".
  - Under it is the chosen phase's list. Each item can be renamed inline (a click on "Rename <title>" turns it into an input with Save/Cancel) or deleted (the button is labelled "Delete starter <title>").
  - Below the list are an input, "New starter to-do", and an **Add** button.
  - With no items: "No starter to-dos for <phase> yet."
- **Project page, a "Starter to-dos" card**, shown only when the URL has `?starter=all` or `?starter=<id>,<id>` **and** there are suggestions:
  - It sits right after Next up, and fetches `api.starterSuggestions(id, ids)`.
  - The hint reads "From your checklists in Settings. Untick any you don't need."
  - Suggestions are grouped under each phase name (`h3`), each as a checkbox with its title as the label, **ticked** by default.
  - The buttons are **Add N to-dos** (disabled when N is 0, with "1 to-do" in the singular) and **Skip**.
  - Adding calls `api.acceptStarters`, reloads the project's to-dos, and removes `starter` from the URL (`setSearchParams(..., { replace: true })`). Skip only removes it.
  - With no suggestions, the card doesn't render and the parameter is removed quietly.
- **Wizard:** after "Create project", navigate to `/manage/projects/<id>?starter=all`.
- **Edit phases:** after saving, navigate to `/manage/projects/<id>?starter=<addedPhaseIds joined with ",">` when some phases were added. Otherwise, go to the plain project URL as before.

- [ ] **Step 1: Write the failing tests**

`server/starters/starters.test.ts` (new):
- **Adding and listing.** Add two items to "UAT" and one to "Deployment". `listStarters` returns them in Phases-list order, then in the order they were added. Adding with a non-phase list value's id (e.g. a department) is rejected with "Unknown phase".
- **Suggestions.** Create a project whose phases include "uat" (lower case) and "Deployment". The suggestions for all phases are the two UAT items (under the "uat" phase's id) followed by the Deployment item. Passing only the Deployment phase's id returns only its item.
- **A renamed list value** (UAT → User acceptance testing) keeps its items, and they still match a phase renamed with it.
- **Accepting.**
  - Creates to-dos assigned to "I am" and linked to their phases.
  - With "I am" not set, the assignee is `null`.
  - A `phaseId` from another project is rejected, and nothing is created.

In `server/app.test.ts`: each route's status codes as listed in **Interfaces**, including 404 for a missing project and for a missing starter item.

In `client/pages/manage/SettingsPage.test.tsx`:
- choosing "UAT" shows its items;
- adding "Get UAT sign-off" sends `POST /api/starter-todos` with `{ phaseListId, title }`;
- deleting sends `DELETE`;
- renaming sends `PUT`.

In `client/pages/manage/ProjectPage.test.tsx`:
- At `/manage/projects/1?starter=all`, with suggestions for UAT (2 items) and Deployment (1), the card shows both groups ticked. Unticking one changes the button to "Add 2 to-dos". Clicking it posts exactly those two items, and the card disappears.
- **Skip** hides the card without posting.
- With no suggestions, no card renders.

In `client/pages/manage/CreateProjectPage.test.tsx`: after a successful create, the page navigates to `/manage/projects/<id>?starter=all`. Assert this with a stub route that renders the location's search string.

In `client/pages/manage/EditPhasesPage.test.tsx`:
- when the PUT answers `addedPhaseIds: [55]`, the page navigates to `/manage/projects/1?starter=55`;
- with `[]`, it navigates to `/manage/projects/1`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run server client/pages/manage`
Expected: FAIL.

- [ ] **Step 3: Implement**

Build what is described above.
- Parse `phaseIds` from the query string by splitting on commas, keeping positive integers, and ignoring the rest.
- Suggestions come from one query over the project's top-level phases, joined to `list_values` (on `list = 'phase'` and the name compared `COLLATE NOCASE`) and then to `starter_todos`, ordered by the phase's `sort_order` and then the starter's `sort_order`.

- [ ] **Step 4: Run the tests, the whole suite and the type check**

Run: `npx vitest run server client`, then `npm test`, then `npm run typecheck`.
Expected: everything passes.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: starter to-do checklists per phase, offered ticked when a project gets those phases"
```

---

### Task 10: Daily backups

**Files:**
- Create: `server/backup.ts`
- Modify: `server/index.ts`, `server/app.ts` (the status route and an app option), `client/api.ts`, `client/pages/manage/SettingsPage.tsx`, `.gitignore`
- Test: `server/backup.test.ts` (new), `server/app.test.ts`, `client/pages/manage/SettingsPage.test.tsx`

**Interfaces:**
- Consumes: the open `DatabaseSync`; `todayLocal`.
- Produces:
  - `server/backup.ts`:
    ```ts
    export const KEEP_BACKUPS = 14;
    export interface BackupStatus { latest: ISODate | null; count: number }
    /** Takes today's backup if there isn't one yet, then keeps only the newest KEEP_BACKUPS. Returns the file written, or null. */
    export function backupIfDue(db: DatabaseSync, dir: string, today: ISODate): string | null
    export function backupStatus(dir: string): BackupStatus
    ```
  - `buildApp(db, { today, backupDir })`: `backupDir` defaults to `'backups'`.
  - `GET /api/backups` → `BackupStatus`.
  - `client/api.ts`: `getBackupStatus()`.

**Rules:**
- **File names** are `pm-YYYY-MM-DD.db`, inside `dir`. Create `dir` if it's missing (`mkdirSync(dir, { recursive: true })`).
- **Writing:** `db.exec(\`VACUUM INTO '${path}'\`)`. `VACUUM INTO` can't take a bound parameter, so build `path` only from `dir` and a date that has already been checked with `isISODate`. Escape any `'` in `dir` by doubling it.
- **At most one backup per day:** if today's file exists, write nothing and return `null`.
- **Pruning:** after writing, list the files that match `/^pm-\d{4}-\d{2}-\d{2}\.db$/` and delete all but the newest 14 by name. Files that don't match the pattern are never touched.
- **`backupStatus`** reports the newest matching file's date and the number of matching files. If the folder is missing, it reports `{ latest: null, count: 0 }`.
- **`server/index.ts`** calls `backupIfDue(db, 'backups', todayLocal())` once after opening the database, and then every hour with `setInterval`. Any error is logged with `console.error` and never stops the server.
- Add `backups/` to `.gitignore`.
- **Settings shows a "Backups" card** at the end:
  - "Last backup: Fri 25 Sep 2026 · 14 kept in the backups folder." Use `formatDate`, and "1 kept" / "N kept".
  - When there are none: "No backup yet. One is taken each day while the app is running."

- [ ] **Step 1: Write the failing tests**

`server/backup.test.ts` (new). Use a temporary folder (`mkdtempSync(join(tmpdir(), 'pvp-backup-'))`, removed in `afterEach`) and `openDb(':memory:')` with one project created:

```ts
  it('writes one backup a day, as a real database', () => {
    const file = backupIfDue(db, dir, '2026-09-25');
    expect(file).toBe(join(dir, 'pm-2026-09-25.db'));
    expect(backupIfDue(db, dir, '2026-09-25')).toBeNull();
    const copy = openDb(file!);
    expect(listProjects(copy)).toHaveLength(1);
    copy.close();
  });

  it('keeps only the newest 14 and leaves other files alone', () => {
    for (let d = 1; d <= 16; d++) writeFileSync(join(dir, `pm-2026-09-${String(d).padStart(2, '0')}.db`), '');
    writeFileSync(join(dir, 'notes.txt'), 'keep me');
    backupIfDue(db, dir, '2026-09-17');
    const names = readdirSync(dir).sort();
    expect(names.filter((n) => n.startsWith('pm-'))).toHaveLength(14);
    expect(names).toContain('pm-2026-09-17.db');
    expect(names).not.toContain('pm-2026-09-03.db');
    expect(names).toContain('notes.txt');
  });

  it('reports the latest backup and the count', () => {
    expect(backupStatus(join(dir, 'missing'))).toEqual({ latest: null, count: 0 });
    backupIfDue(db, dir, '2026-09-25');
    expect(backupStatus(dir)).toEqual({ latest: '2026-09-25', count: 1 });
  });
```

In `server/app.test.ts`: `GET /api/backups` on an app built with `backupDir` set to a temporary folder returns `{ latest: null, count: 0 }`.

In `client/pages/manage/SettingsPage.test.tsx`: with `GET /api/backups` answering `{ latest: '2026-09-25', count: 14 }`, the page shows "Last backup: Fri 25 Sep 2026 · 14 kept in the backups folder." With `{ latest: null, count: 0 }`, it shows the "No backup yet" line.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run server/backup.test.ts server/app.test.ts client/pages/manage/SettingsPage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement** everything described above.

- [ ] **Step 4: Run the tests, the whole suite and the type check**

Run: `npm test`, then `npm run typecheck`.
Expected: everything passes.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: daily database backups, keeping the newest 14, with the last one shown in Settings"
```

---

### Task 11: Demo increments, to-dos, "I am" and starter checklists (completes M5)

With this task the demo shows every M5 feature:
- E-Services Mobile App's Development phase is split into four increments. Two of them run in parallel, and the developers are on individual increments, not on the whole phase.
- The PM ("I am" = Sara Ahmed) has to-dos across three projects, one of them overdue.
- The UAT, Security testing and Deployment phases have starter checklists.

**Files:**
- Modify: `server/demoData.ts`
- Test: `server/demoData.test.ts`

**Interfaces:**
- Consumes: `DEMO_PEOPLE`, `TEAM_BY_PHASE`, `toProjectInput` and `seedDemo` (M4); sub-phase inputs (Task 1); `createToDo`, `setMe` and `toDoInputSchema` (Task 6); `starter_todos` through the starter repo's `addStarter` (Task 9).
- Produces:
  - A demo phase may carry `team?: TeamEntry[]`, which replaces `TEAM_BY_PHASE` for that phase, and `subPhases?: { name; durationDays; withPrevious?; team: TeamEntry[] }[]`. Here `TeamEntry` is the existing `{ person; allocation; role }` shape; give it that name.
  - `DEMO_ME = 'Sara Ahmed'`.
  - `DEMO_TODOS: { project: string; title: string; assignee: string | null; due: string | null; phase: string | null; doneOn?: string }[]`. `phase` is "Phase" or "Phase › Sub-phase".
  - `DEMO_STARTERS: Record<string, string[]>`, keyed by Phases-list name.
  - `seedDemo` also sets "I am", adds the to-dos (after the projects) and adds the starter checklists.

**The data (use it verbatim):**

E-Services Mobile App's **Development** phase (it starts on 2026-11-30 and still spans 60 working days, so every later phase keeps its dates):

| Sub-phase | Days | Starts | Team |
|---|---|---|---|
| Increment 1 – Sign-in and profile | 15 | after (first) | Fatima Noor 60% responsible |
| Increment 2 – Service catalogue | 15 | **with the one above** | Rami Saleh 60% responsible |
| Increment 3 – Payments | 25 | after | Rami Saleh 60% responsible, Fatima Noor 60% contributor |
| Increment 4 – Notifications | 20 | after | Fatima Noor 60% responsible |

The phase itself gets `team: [{ person: 'Hassan Ali', allocation: 30, role: 'responsible' }]`. The expected dates are:
- Increments 1 and 2: 2026-11-30 → 2026-12-18
- Increment 3: 2026-12-21 → 2027-01-22
- Increment 4: 2027-01-25 → 2027-02-19
- The phase: 2026-11-30 → 2027-02-19

`DEMO_TODOS`:

| Project | Title | Assignee | Due | Phase | Done on |
|---|---|---|---|---|---|
| E-Services Mobile App | Send the app store account request to IT | Sara Ahmed | 2026-09-23 | — | |
| E-Services Mobile App | Confirm the requirements workshop dates with Mariam | Sara Ahmed | 2026-09-30 | Requirements gathering | |
| E-Services Mobile App | Collect the list of services for the catalogue | Mariam Al Suwaidi | 2026-10-14 | Requirements gathering | |
| E-Services Mobile App | Draft the sign-in and profile screens | Mei Chen | 2026-11-20 | Design | |
| E-Services Mobile App | Review the payment provider's API documentation | Rami Saleh | 2026-12-18 | Development › Increment 3 – Payments | |
| E-Services Mobile App | Share the release plan with the business | Sara Ahmed | — | — | |
| Case Management System | Book UAT sessions with the business | Aisha Khan | 2026-09-28 | UAT | |
| Case Management System | Confirm the security testing slot | Jonas Weber | 2026-10-05 | Security testing | 2026-09-24 |
| Case Management System | Check the go-live checklist with operations | Sara Ahmed | 2026-10-20 | Deployment | |
| Customer Portal Revamp | Hand over the runbook to operations | Hassan Ali | 2026-06-17 | Launch | 2026-06-18 |

A done to-do is created with `done: true` and `today = doneOn`, so its `doneDate` is that day. Resolve the phase by name among the project's phases, and "Phase › Sub" among its sub-phases. Throw a clear error if a name doesn't resolve, just as `personId` does.

`DEMO_STARTERS`:
- `UAT`: "Book UAT sessions with the business", "Prepare UAT test data", "Get UAT sign-off"
- `Security testing`: "Book the security testing slot"
- `Deployment`: "Confirm the release window with operations", "Prepare the rollback plan"

- [ ] **Step 1: Write the failing test**

In `server/demoData.test.ts`, inside `describe('seedDemo', …)`:

```ts
  it('splits E-Services development into increments, and gives the PM to-dos and starter checklists', () => {
    const db = openDb(':memory:');
    seedDemo(db, DEFAULT_CALENDAR);
    const app = listProjects(db).find((p) => p.name === 'E-Services Mobile App')!;
    const dev = app.phases.find((ph) => ph.name === 'Development')!;
    expect(dev).toMatchObject({ start: '2026-11-30', end: '2027-02-19' });
    expect(dev.subPhases.map((s) => [s.name, s.start, s.end, s.withPrevious])).toEqual([
      ['Increment 1 – Sign-in and profile', '2026-11-30', '2026-12-18', false],
      ['Increment 2 – Service catalogue', '2026-11-30', '2026-12-18', true],
      ['Increment 3 – Payments', '2026-12-21', '2027-01-22', false],
      ['Increment 4 – Notifications', '2027-01-25', '2027-02-19', false],
    ]);
    const onDev = app.assignments.filter((a) => a.phaseId === dev.id).map((a) => a.resource.name);
    expect(onDev).toEqual(['Hassan Ali']);
    for (const s of dev.subPhases) expect(app.assignments.some((a) => a.phaseId === s.id)).toBe(true);

    const me = getMe(db);
    expect(me.name).toBe('Sara Ahmed');
    const mine = listToDos(db, { assigneeId: me.resourceId! });
    expect(mine.map((t) => t.title)).toEqual([
      'Send the app store account request to IT',
      'Confirm the requirements workshop dates with Mariam',
      'Check the go-live checklist with operations',
      'Share the release plan with the business',
    ]);
    const all = listToDos(db, { includeDone: true });
    expect(all).toHaveLength(10);
    expect(all.find((t) => t.title.startsWith('Review the payment'))?.phase?.name).toBe('Development › Increment 3 – Payments');
    expect(all.find((t) => t.title === 'Confirm the security testing slot')).toMatchObject({ done: true, doneDate: '2026-09-24' });

    expect(listStarters(db)).toHaveLength(6);
  });
```

The existing M4 assertions in this file (Aisha at 150% in the week of 5 Oct, Jonas's leave week, Fatima's leave week) must keep passing unchanged. If "staffs every demo phase" fails, it is because it reads `p.phases` and the sub-phases are new; extend it so that every sub-phase is staffed too, and don't loosen it.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run server/demoData.test.ts`
Expected: FAIL. There are no sub-phases, "I am", to-dos or starters in the demo.

- [ ] **Step 3: Implement**

- Add the `TeamEntry` type, the per-phase `team` and `subPhases` fields, and `DEMO_ME`, `DEMO_TODOS` and `DEMO_STARTERS`.
- `toProjectInput` uses `phase.team ?? TEAM_BY_PHASE[phase.name] ?? []`, and maps `subPhases` with their teams.
- `seedDemo`, inside its existing transaction and after the projects: `setMe(db, personId(DEMO_ME))`, then the to-dos, then the starters (resolve each list value with `addListValue(db, 'phase', name)`, which returns the existing value).

- [ ] **Step 4: Run the tests, the whole suite and the type check**

Run: `npx vitest run server/demoData.test.ts`, then `npm test`, then `npm run typecheck`.
Expected: everything passes.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: demo increments, the PM's to-dos and starter checklists"
```

---

### ✅ M5 checkpoint: stop and demo to the user

Start from a fresh demo database. An existing `data/pm.db` upgrades automatically (migrations 8–10), but only a fresh one has the M5 demo data.
1. Stop `npm run dev`.
2. Delete `data/pm.db`.
3. Run `npm run seed`. Expected: "Added 6 demo projects."
4. Run `npm run dev`, then open http://localhost:5173, or `http://<this PC's LAN IP>:5173` from a phone.

The user should be able to:
1. **Dashboard:**
   - **My next steps** lists Sara's open to-dos. "Send the app store account request to IT" is red and overdue.
   - **To-dos** in the header opens the To-dos page.
2. **E-Services Mobile App:**
   - **Next up** shows Sara's three most urgent to-dos on this project.
   - The Gantt chart shows Development with four indented increments. Increments 1 and 2 run side by side.
   - The **To-dos** card lists this project's to-dos: add one, tick one off, edit one, delete one.
   - The **People** card shows each increment's people; Hassan is on Development as a whole.
3. **Edit phases** (on the project page):
   - Add a sub-phase to a phase, set it "With the one above", drag it into a different order, and remove another.
   - Removing an increment that has people shows the warning first.
   - After saving, the chart and dates update, and the people on the phases that were kept are still there.
4. **Add a UAT phase** on Edit phases, for a project without one. After saving, the project page offers the three UAT starter to-dos, ticked. Untick one and add the rest.
5. **New project:** Step 3 can add sub-phases, and Step 4 can put people on them, with live overbooking warnings. After creating, the starter to-dos for its phases are offered.
6. **Resources:**
   - **Fatima Noor's page:** "Working on" lists her increments as "E-Services Mobile App › Development › Increment 1 – Sign-in and profile" and so on, and her to-dos card shows hers (none).
   - **Rami Saleh's page** lists his increments and his to-do about the payment provider.
   - In the **Days** heatmap from 30 Nov, Fatima and Rami are each booked 60%. The panel names the increments.
7. **To-dos page:** filter by project, by **Mine** and by **Unassigned**; tick **Show done**.
8. **Settings:**
   - **I am** is Sara Ahmed. Change it and watch Next up and My next steps follow.
   - **Starter to-dos:** add, rename and delete items per phase.
   - **Backups** shows today's backup, and a file `backups/pm-<today>.db` exists.
9. **Presentation → focus view** of E-Services Mobile App shows the increments under Development, and there are no to-dos anywhere under `/present`.

**Ask the user for feedback. When M5 is approved, fast-forward every branch to `build/m5`. Then write the M6 plan (meetings, updates, attachments) on `design/portfolio-spec`.**
