# Milestones 1–2: Create Projects, See Them on a Gantt Chart, Present the Portfolio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the first two demoable slices of the Visual Project Portfolio tool:
- **M1:** create a project with phases and see its Gantt chart in the Project Management side.
- **M2:** open the Project Presentation side and see every project of the year on one portfolio Gantt chart, with stat tiles and a click-through focus view.

**Architecture:** One npm package with three folders:
- `shared/`: pure TypeScript engines and types used by both client and server.
- `server/`: a Fastify REST API over Node's built-in `node:sqlite`.
- `client/`: a React + Vite single-page app.

A custom SVG `Gantt` component renders every chart. Dates are ISO strings (`YYYY-MM-DD`) everywhere, and working-day maths lives in `shared/calendar.ts`.

**Tech Stack:** Node 24, TypeScript 5, React 19, React Router 7, Vite 6, Fastify 5, zod 3, `node:sqlite` (built in), Vitest 3, Testing Library, jsdom, concurrently, tsx.

**Spec:** `docs/superpowers/specs/2026-09-24-visual-project-portfolio-design.md`

## Global Constraints

- **Branch:** all work happens on `build/m1-m2`, created from `design/portfolio-spec`. **Never commit to `main`.** Merging to `main` happens only after the user approves a milestone.
- **Node:** 24.x or later is required (for `node:sqlite`). No native or compiled npm dependencies, because it runs on Windows.
- **Database:** use `node:sqlite` with raw SQL and versioned migrations (`PRAGMA user_version`). *Deviation from spec §1, which named Drizzle.* The ORM needs a native SQLite driver, and the built-in module avoids compiling on Windows.
- **Dates:** always ISO `YYYY-MM-DD` strings. "Today" is the local date (`todayLocal()`), never a UTC slice.
- **Weekend default:** Saturday and Sunday (`weekendDays: [0, 6]`, where 0 is Sunday and 6 is Saturday). It is stored in `settings` so it can be configured.
- **Phase scheduling:** a phase starts on the first working day on or after its cursor, and lasts `durationDays` working days *inclusive*. The next phase starts on the working day after the previous one ends.
- **Server:** binds to `127.0.0.1:3001` (single-user, local). The Vite dev server on `5173` proxies `/api`.
- **Data location:** `data/pm.db` is git-ignored.
- **Tests:** every client test file starts with `// @vitest-environment jsdom`. Server and shared tests run in the default Node environment.
- **Presentation side is read-only:** no create or edit controls under `/present`.

## Milestone Roadmap (the whole product; only M1–M2 are detailed here)

> **Renumbered on 2026-09-26:** Arabic was inserted as M6, so the milestones after it moved up by one. The M4 and M5 plans were written earlier and use the old numbers: in them, M6 is now M7 (meetings), M7 is now M8 (progress), M8 is now M9 (holds), and so on.

Every milestone ends with something the user can run and try in the browser. After each one, the user reviews it before the next plan is written, so later plans can absorb that feedback.

| # | Milestone | What the user can try at the end |
|---|---|---|
| **M1** | **Create a project and see its Gantt chart** | Landing page → Project Management → create a project with phases (live preview) → project page with Gantt chart → dashboard list |
| **M2** | **Portfolio presentation** | Project Presentation → year portfolio Gantt chart with all projects, stat tiles, today line → click a project to see it in focus |
| M3 | Full project details | All wizard fields: classification, main projects (with grouping on the portfolio), scope, out-of-scope, problems and objectives tables, dropdowns with "+ Add new", Settings lists |
| M4 | Resources and workload | Resources page, assigning people to phases, workload heatmap, overload decision prompt, leave; weekday labels, leave day slices, Projects column, sortable columns |
| M5 | Sub-phases and to-dos | Edit phases after creation; sub-phases (can run in parallel) with people assigned to them, shown on the Gantt, the person page and the workload; to-dos for yourself or anyone on the project, Next up card, My next steps, To-dos page, optional starter checklists per phase, "I am" in Settings; daily backups |
| M6 | Arabic first | The app opens in natural Arabic (not a word-for-word translation), laid out right to left, with an English switch; every existing screen, message, list default and date in both languages; an approved Arabic glossary; right-to-left Gantt charts; from here on every milestone ships in both languages |
| M7 | Meetings, updates, attachments | Add meetings and updates with effective dates, upload files, meetings create to-dos, click a Gantt bar to open the side panel timeline; highlighted entries appear in the stakeholder focus view |
| M8 | Progress and decisions | Baseline 1 for every project; actual dates, % complete (each phase and sub-phase bar fills in a darker shade of its colour as it progresses, with the % in its hover details), pace indicator, late detection, early/late shift prompts with cause and responsibility; Delay a phase switches on; "Needs your decision" inbox; holidays with shift prompt; original plan and actual dates for past projects; first **Why did the end date move?** and **Where did the time go?** charts |
| M9 | Holds and project links | Record a hold, hatched hold bar with an arrow on the portfolio, Pause a project switches on, dependency arrows, **follow-on projects** (pre-filled wizard, carry-over, project family strip); first end-to-end browser tests; holds added to the stakeholder charts |
| M10 | Layout pass | Rework page layouts from the user's collected layout comments (spec §7): cards arranged side by side in a grid that uses the page width, sized by their content, instead of one long column; applied to every page built so far, in both Arabic (right to left) and English |
| M11 | Change requests and requirements | Change requests, new baselines with dashed outlines, requirement fields on development sub-phases (source, date received), weights and the development % rule; change requests added to the stakeholder charts |
| M12 | Requirement readiness | Incomplete/Ready with evidence, waiting clock, Clarification to-dos, start at risk, grey waiting segments; waiting time added to the stakeholder charts |
| M13 | Stakeholder insight | Health model, ⭐ milestones and upcoming milestones, the finished charts with drill-down |
| M14 | Playback | Play single project and portfolio, pop-ups with documents, auto-pause |
| M15 | What-if sandbox | Stacked hypothetical changes, hypothetical projects, anonymous resource picking, conflicts, price tag panel, save as proposed |
| M16 | Polish for presenting | PDF export, presenter mode |

## File Structure (after M1–M2)

```
package.json, tsconfig.json, vite.config.ts, vitest.config.ts, test-setup.ts, .gitignore
shared/
  calendar.ts        ISO date helpers + working-day maths (WorkCalendar)
  scheduler.ts       schedulePhases(), projectSpan()
  schemas.ts         zod schemas for API input (shared by client form + server)
  types.ts           ProjectRecord, PhaseRecord, PortfolioResponse
  portfolio.ts       projectStatus(), overlapsYear(), portfolioStats()
server/
  db.ts              openDb(), migrate(), transaction()
  settings.ts        getCalendar(), setCalendar()
  projects/repo.ts   createProject(), getProject(), listProjects()
  app.ts             buildApp(db, opts) — all HTTP routes
  index.ts           entry point: opens data/pm.db, listens on 3001
  demoData.ts        DEMO_PROJECTS
  seed.ts            `npm run seed`
client/
  index.html, main.tsx, App.tsx, styles.css
  api.ts             typed fetch wrapper
  useAsync.ts        load-data hook
  testing/mockFetch.ts  test helpers (not a test file)
  gantt/scale.ts     createTimeScale(), monthPaddedRange()
  gantt/Gantt.tsx    SVG Gantt renderer
  gantt/rows.ts      phaseRows(), portfolioRows(), rangeFor()
  gantt/useElementWidth.ts
  pages/Landing.tsx, NotFound.tsx
  pages/manage/ManageDashboardPage.tsx, CreateProjectPage.tsx, ProjectPage.tsx
  pages/present/PortfolioPage.tsx, FocusPage.tsx
```

---

# MILESTONE 1: Create a project and see its Gantt chart

### Task 1: Walking skeleton (runnable app with landing page and API health check)

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `test-setup.ts`
- Modify: `.gitignore`
- Create: `server/app.ts`, `server/index.ts`, `server/app.test.ts`
- Create: `client/index.html`, `client/main.tsx`, `client/App.tsx`, `client/styles.css`, `client/pages/Landing.tsx`, `client/pages/NotFound.tsx`, `client/pages/Landing.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `buildApp(): FastifyInstance` in `server/app.ts` (the signature changes to `buildApp(db, opts)` in Task 4). `App` component with routes `/` and `*`. CSS class names used by later tasks: `page`, `page-header`, `crumb`, `button`, `button secondary`, `card`, `stats`, `stat`, `stat-value`, `stat-label`, `form-grid`, `phase-row`, `errors`, `chart-scroll`, `muted`, `year-nav`, and the `gantt-*` classes.

- [ ] **Step 1: Create the working branch**

```bash
git switch design/portfolio-spec
git switch -c build/m1-m2
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "visual-project-portfolio",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "engines": { "node": ">=24" },
  "scripts": {
    "dev": "concurrently -k -n api,web -c blue,green \"tsx watch server/index.ts\" \"vite\"",
    "start": "npm run dev",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "seed": "tsx server/seed.ts"
  }
}
```

- [ ] **Step 3: Install dependencies**

```bash
npm install react@19 react-dom@19 react-router@7 fastify@5 zod@3
npm install -D typescript@5 vite@6 @vitejs/plugin-react@4 vitest@3 jsdom@26 @testing-library/react@16 @testing-library/dom@10 @testing-library/user-event@14 @testing-library/jest-dom@6 @types/react@19 @types/react-dom@19 @types/node@24 tsx@4 concurrently@9
```

Expected: both finish without `gyp` or compile errors.

- [ ] **Step 4: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "types": ["node"]
  },
  "include": ["shared", "server", "client", "*.ts"]
}
```

- [ ] **Step 5: Create `vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'client',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:3001' },
  },
  build: { outDir: '../dist', emptyOutDir: true },
});
```

- [ ] **Step 6: Create `vitest.config.ts` and `test-setup.ts`**

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['{shared,server,client}/**/*.test.{ts,tsx}'],
    setupFiles: ['./test-setup.ts'],
  },
});
```

`test-setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';

afterEach(async () => {
  vi.unstubAllGlobals();
  if (typeof document !== 'undefined') {
    const { cleanup } = await import('@testing-library/react');
    cleanup();
  }
});
```

- [ ] **Step 7: Update `.gitignore`** so it contains exactly:

```
.superpowers/
node_modules/
*.db
attachments/
data/
dist/
```

- [ ] **Step 8: Write the failing server test** `server/app.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { buildApp } from './app';

describe('health', () => {
  it('reports ok', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });
});
```

- [ ] **Step 9: Write the failing client test** `client/pages/Landing.test.tsx`

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { Landing } from './Landing';

describe('Landing', () => {
  it('offers the two main features', () => {
    render(<MemoryRouter><Landing /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /Project Management/ })).toHaveAttribute('href', '/manage');
    expect(screen.getByRole('link', { name: /Project Presentation/ })).toHaveAttribute('href', '/present');
  });
});
```

- [ ] **Step 10: Run the tests to verify they fail**

Run: `npx vitest run`
Expected: FAIL. Both files report that they cannot resolve `./app` or `./Landing`.

- [ ] **Step 11: Create `server/app.ts`**

```ts
import Fastify from 'fastify';

export function buildApp() {
  const app = Fastify();
  app.get('/api/health', async () => ({ ok: true }));
  return app;
}
```

- [ ] **Step 12: Create `server/index.ts`**

```ts
import { buildApp } from './app';

const app = buildApp();
app
  .listen({ port: 3001, host: '127.0.0.1' })
  .then(() => console.log('API ready on http://127.0.0.1:3001'))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
```

- [ ] **Step 13: Create the client shell**

`client/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Project Portfolio</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/main.tsx"></script>
  </body>
</html>
```

`client/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
```

`client/App.tsx`:
```tsx
import { Route, Routes } from 'react-router';
import { Landing } from './pages/Landing';
import { NotFound } from './pages/NotFound';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
```

`client/pages/Landing.tsx`:
```tsx
import { Link } from 'react-router';

export function Landing() {
  return (
    <main className="landing">
      <h1>Project Portfolio</h1>
      <div className="landing-tiles">
        <Link to="/manage" className="tile">
          <h2>Project Management</h2>
          <p>Create and manage projects, phases and people.</p>
        </Link>
        <Link to="/present" className="tile">
          <h2>Project Presentation</h2>
          <p>Show the portfolio to stakeholders.</p>
        </Link>
      </div>
    </main>
  );
}
```

`client/pages/NotFound.tsx`:
```tsx
import { Link } from 'react-router';

export function NotFound() {
  return (
    <main className="page">
      <h1>Page not found</h1>
      <p className="muted">This page does not exist yet.</p>
      <Link to="/" className="button secondary">Back to start</Link>
    </main>
  );
}
```

`client/styles.css`:
```css
:root {
  --bg: #f7f8fa;
  --surface: #ffffff;
  --text: #1f2937;
  --muted: #6b7280;
  --border: #e5e7eb;
  --accent: #2563eb;
  --danger: #dc2626;
  --today: #dc2626;
  font-family: system-ui, 'Segoe UI', sans-serif;
  color: var(--text);
  background: var(--bg);
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); }
a { color: var(--accent); }
h1 { font-size: 1.6rem; }

.page { max-width: 1200px; margin: 0 auto; padding: 24px 16px 64px; }
.page-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 20px; }
.page-header h1 { margin: 0; }
.crumb { color: var(--muted); font-size: 0.9rem; text-decoration: none; }
.muted { color: var(--muted); }

.button { display: inline-block; background: var(--accent); color: #fff; border: 0; border-radius: 8px; padding: 8px 14px; font: inherit; cursor: pointer; text-decoration: none; }
.button.secondary { background: var(--surface); color: var(--text); border: 1px solid var(--border); }
.button:disabled { opacity: 0.6; cursor: default; }

.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-bottom: 16px; }

.landing { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 32px; padding: 16px; }
.landing-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 24px; width: min(720px, 100%); }
.tile { display: block; background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 32px 24px; text-decoration: none; color: var(--text); transition: transform 0.15s, box-shadow 0.15s; }
.tile:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08); }
.tile h2 { margin: 0 0 8px; }
.tile p { margin: 0; color: var(--muted); }

.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 16px; }
.stat { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px; }
.stat-value { font-size: 2rem; font-weight: 700; }
.stat-label { color: var(--muted); }

table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 8px; border-bottom: 1px solid var(--border); }
th { color: var(--muted); font-weight: 600; font-size: 0.85rem; }

.form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px 16px; }
label { display: flex; flex-direction: column; gap: 4px; font-size: 0.9rem; color: var(--muted); }
input { font: inherit; padding: 8px; border: 1px solid var(--border); border-radius: 8px; color: var(--text); background: var(--surface); }
input[type='color'] { padding: 2px; height: 38px; }
.phase-row { display: grid; grid-template-columns: 1fr 140px auto; gap: 8px; align-items: center; margin-bottom: 8px; }
.errors { background: #fef2f2; border: 1px solid #fecaca; color: var(--danger); border-radius: 8px; padding: 8px 16px; margin-bottom: 16px; }

.year-nav { display: flex; align-items: center; gap: 8px; }
.chart-scroll { overflow-x: auto; }

.gantt { display: block; font-size: 12px; }
.gantt-grid { stroke: var(--border); }
.gantt-tick { fill: var(--muted); }
.gantt-row-bg { fill: transparent; }
.gantt-row.clickable { cursor: pointer; }
.gantt-row.clickable:hover .gantt-row-bg { fill: rgba(37, 99, 235, 0.06); }
.gantt-label { fill: var(--text); }
.gantt-bar { stroke: #fff; stroke-width: 1; }
.gantt-bar-label { fill: #fff; font-size: 11px; pointer-events: none; }
.gantt-today { stroke: var(--today); stroke-width: 2; stroke-dasharray: 4 3; }
```

- [ ] **Step 14: Run the tests to verify they pass**

Run: `npx vitest run`
Expected: PASS (2 tests).

Run: `npm run typecheck`
Expected: no output, exit code 0.

- [ ] **Step 15: Smoke-test the app**

Run: `npm run dev`. Open http://localhost:5173 and check that you see the two tiles. Open http://localhost:5173/api/health and check that you see `{"ok":true}`. Stop with Ctrl+C.

- [ ] **Step 16: Commit**

```bash
git add -A
git commit -m "feat: walking skeleton with landing page and API health check"
```

---

### Task 2: Working-day calendar engine

**Files:**
- Create: `shared/calendar.ts`
- Test: `shared/calendar.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (all exported from `shared/calendar.ts`):
  - `type ISODate = string`
  - `interface DateRange { start: ISODate; end: ISODate }`
  - `interface WorkCalendar { weekendDays: number[]; holidays: DateRange[] }`
  - `const DEFAULT_CALENDAR: WorkCalendar`
  - `isISODate(value: string): boolean`
  - `todayLocal(): ISODate`
  - `addDays(d: ISODate, n: number): ISODate`
  - `daysBetween(a: ISODate, b: ISODate): number`
  - `dayOfWeek(d: ISODate): number`
  - `isWorkingDay(d: ISODate, cal: WorkCalendar): boolean`
  - `nextWorkingDay(d: ISODate, cal: WorkCalendar): ISODate`
  - `addWorkingDays(start: ISODate, n: number, cal: WorkCalendar): ISODate`
  - `countWorkingDays(start: ISODate, end: ISODate, cal: WorkCalendar): number`

Reference dates for the tests: 2026-09-24 is a **Thursday**, 26–27 Sep are Saturday–Sunday, and 28 Sep is a Monday.

- [ ] **Step 1: Write the failing test** `shared/calendar.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CALENDAR, addDays, addWorkingDays, countWorkingDays, dayOfWeek, daysBetween,
  isISODate, isWorkingDay, nextWorkingDay, type WorkCalendar,
} from './calendar';

const cal = DEFAULT_CALENDAR; // Sat + Sun weekend
const withHoliday: WorkCalendar = { weekendDays: [0, 6], holidays: [{ start: '2026-09-28', end: '2026-09-29' }] };
const friSat: WorkCalendar = { weekendDays: [5, 6], holidays: [] };

describe('date helpers', () => {
  it('validates ISO dates strictly', () => {
    expect(isISODate('2026-02-28')).toBe(true);
    expect(isISODate('2026-02-30')).toBe(false);
    expect(isISODate('26-2-1')).toBe(false);
  });
  it('adds calendar days across month ends', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
  it('counts days between dates', () => {
    expect(daysBetween('2026-09-24', '2026-10-01')).toBe(7);
  });
  it('knows the weekday', () => {
    expect(dayOfWeek('2026-09-24')).toBe(4); // Thursday
  });
});

describe('working days', () => {
  it('treats weekends and holidays as non-working', () => {
    expect(isWorkingDay('2026-09-24', cal)).toBe(true);
    expect(isWorkingDay('2026-09-26', cal)).toBe(false);
    expect(isWorkingDay('2026-09-27', cal)).toBe(false);
    expect(isWorkingDay('2026-09-28', withHoliday)).toBe(false);
  });
  it('rolls forward to the next working day', () => {
    expect(nextWorkingDay('2026-09-24', cal)).toBe('2026-09-24');
    expect(nextWorkingDay('2026-09-26', cal)).toBe('2026-09-28');
  });
  it('adds working days inclusively', () => {
    expect(addWorkingDays('2026-09-24', 1, cal)).toBe('2026-09-24');
    expect(addWorkingDays('2026-09-24', 3, cal)).toBe('2026-09-28');
    expect(addWorkingDays('2026-09-26', 1, cal)).toBe('2026-09-28');
    expect(addWorkingDays('2026-09-24', 3, withHoliday)).toBe('2026-09-30');
    expect(addWorkingDays('2026-09-24', 2, friSat)).toBe('2026-09-27');
  });
  it('rejects non-positive durations', () => {
    expect(() => addWorkingDays('2026-09-24', 0, cal)).toThrow();
  });
  it('counts working days inclusively', () => {
    expect(countWorkingDays('2026-09-24', '2026-09-30', cal)).toBe(5);
    expect(countWorkingDays('2026-09-30', '2026-09-24', cal)).toBe(0);
  });
  it('refuses a calendar with no working days', () => {
    expect(() => nextWorkingDay('2026-09-24', { weekendDays: [0, 1, 2, 3, 4, 5, 6], holidays: [] })).toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run shared/calendar.test.ts`
Expected: FAIL, "Failed to resolve import './calendar'".

- [ ] **Step 3: Implement** `shared/calendar.ts`

```ts
export type ISODate = string; // 'YYYY-MM-DD'

export interface DateRange {
  start: ISODate;
  end: ISODate;
}

export interface WorkCalendar {
  /** Days of the week that are not worked: 0 = Sunday … 6 = Saturday. */
  weekendDays: number[];
  holidays: DateRange[];
}

export const DEFAULT_CALENDAR: WorkCalendar = { weekendDays: [0, 6], holidays: [] };

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;
const MAX_SCAN_DAYS = 3660;

function toDate(d: ISODate): Date {
  return new Date(`${d}T00:00:00Z`);
}

function fromDate(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

export function isISODate(value: string): boolean {
  if (!ISO_RE.test(value)) return false;
  const d = toDate(value);
  return !Number.isNaN(d.getTime()) && fromDate(d) === value;
}

export function todayLocal(): ISODate {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function addDays(d: ISODate, n: number): ISODate {
  const date = toDate(d);
  date.setUTCDate(date.getUTCDate() + n);
  return fromDate(date);
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / MS_PER_DAY);
}

export function dayOfWeek(d: ISODate): number {
  return toDate(d).getUTCDay();
}

export function isWorkingDay(d: ISODate, cal: WorkCalendar): boolean {
  if (cal.weekendDays.includes(dayOfWeek(d))) return false;
  return !cal.holidays.some((h) => d >= h.start && d <= h.end);
}

export function nextWorkingDay(d: ISODate, cal: WorkCalendar): ISODate {
  let current = d;
  for (let i = 0; i < MAX_SCAN_DAYS; i++) {
    if (isWorkingDay(current, cal)) return current;
    current = addDays(current, 1);
  }
  throw new Error('No working day found within 10 years — check the weekend and holiday settings');
}

/** Returns the date of the n-th working day, counting the start (rolled forward to a working day) as day 1. */
export function addWorkingDays(start: ISODate, n: number, cal: WorkCalendar): ISODate {
  if (!Number.isInteger(n) || n < 1) throw new Error(`Working-day count must be a positive whole number, got ${n}`);
  let current = nextWorkingDay(start, cal);
  let counted = 1;
  while (counted < n) {
    current = nextWorkingDay(addDays(current, 1), cal);
    counted++;
  }
  return current;
}

/** Working days from start to end, both inclusive. 0 if end is before start. */
export function countWorkingDays(start: ISODate, end: ISODate, cal: WorkCalendar): number {
  let count = 0;
  for (let d = start; d <= end; d = addDays(d, 1)) {
    if (isWorkingDay(d, cal)) count++;
  }
  return count;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run shared/calendar.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add shared/calendar.ts shared/calendar.test.ts
git commit -m "feat: working-day calendar engine"
```

---

### Task 3: Phase scheduler

**Files:**
- Create: `shared/scheduler.ts`
- Test: `shared/scheduler.test.ts`

**Interfaces:**
- Consumes: `ISODate`, `DateRange`, `WorkCalendar`, `addDays`, `addWorkingDays`, `nextWorkingDay` from `shared/calendar.ts`.
- Produces:
  - `interface PhaseInput { name: string; durationDays: number }`
  - `interface ScheduledPhase extends PhaseInput { order: number; start: ISODate; end: ISODate }`
  - `schedulePhases(projectStart: ISODate, phases: PhaseInput[], cal: WorkCalendar): ScheduledPhase[]`
  - `projectSpan(phases: { start: ISODate; end: ISODate }[]): DateRange | null`

- [ ] **Step 1: Write the failing test** `shared/scheduler.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_CALENDAR } from './calendar';
import { projectSpan, schedulePhases } from './scheduler';

describe('schedulePhases', () => {
  it('runs phases back to back over working days', () => {
    const result = schedulePhases('2026-09-24', [
      { name: 'Requirements', durationDays: 2 },
      { name: 'Development', durationDays: 3 },
    ], DEFAULT_CALENDAR);
    expect(result).toEqual([
      { name: 'Requirements', durationDays: 2, order: 0, start: '2026-09-24', end: '2026-09-25' },
      { name: 'Development', durationDays: 3, order: 1, start: '2026-09-28', end: '2026-09-30' },
    ]);
  });
  it('starts on the next working day when the project starts on a weekend', () => {
    const [first] = schedulePhases('2026-09-26', [{ name: 'A', durationDays: 1 }], DEFAULT_CALENDAR);
    expect(first.start).toBe('2026-09-28');
  });
  it('returns nothing for no phases', () => {
    expect(schedulePhases('2026-09-24', [], DEFAULT_CALENDAR)).toEqual([]);
  });
});

describe('projectSpan', () => {
  it('spans from the earliest start to the latest end', () => {
    expect(projectSpan([
      { start: '2026-03-01', end: '2026-03-10' },
      { start: '2026-02-15', end: '2026-02-20' },
      { start: '2026-03-05', end: '2026-04-01' },
    ])).toEqual({ start: '2026-02-15', end: '2026-04-01' });
  });
  it('is null without phases', () => {
    expect(projectSpan([])).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run shared/scheduler.test.ts`
Expected: FAIL, "Failed to resolve import './scheduler'".

- [ ] **Step 3: Implement** `shared/scheduler.ts`

```ts
import { addDays, addWorkingDays, nextWorkingDay, type DateRange, type ISODate, type WorkCalendar } from './calendar';

export interface PhaseInput {
  name: string;
  durationDays: number;
}

export interface ScheduledPhase extends PhaseInput {
  order: number;
  start: ISODate;
  end: ISODate;
}

export function schedulePhases(projectStart: ISODate, phases: PhaseInput[], cal: WorkCalendar): ScheduledPhase[] {
  const result: ScheduledPhase[] = [];
  let cursor = projectStart;
  phases.forEach((phase, index) => {
    const start = nextWorkingDay(cursor, cal);
    const end = addWorkingDays(start, phase.durationDays, cal);
    result.push({ ...phase, order: index, start, end });
    cursor = addDays(end, 1);
  });
  return result;
}

export function projectSpan(phases: { start: ISODate; end: ISODate }[]): DateRange | null {
  if (phases.length === 0) return null;
  let start = phases[0].start;
  let end = phases[0].end;
  for (const p of phases) {
    if (p.start < start) start = p.start;
    if (p.end > end) end = p.end;
  }
  return { start, end };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run shared/scheduler.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add shared/scheduler.ts shared/scheduler.test.ts
git commit -m "feat: sequential phase scheduler"
```

---

### Task 4: Database, project storage and project API

**Files:**
- Create: `shared/schemas.ts`, `shared/schemas.test.ts`, `shared/types.ts`
- Create: `server/db.ts`, `server/settings.ts`, `server/projects/repo.ts`
- Modify (replace whole file): `server/app.ts`, `server/app.test.ts`, `server/index.ts`
- Create: `server/projects/projects.test.ts`

**Interfaces:**
- Consumes: `schedulePhases`, `PhaseInput` (Task 3); `DEFAULT_CALENDAR`, `isISODate`, `WorkCalendar`, `ISODate` (Task 2).
- Produces:
  - `shared/schemas.ts`: `isoDate`, `phaseInputSchema`, `newProjectSchema`, `type NewProjectInput` (form or JSON input), `type NewProject` (parsed; `jiraKey: string | null`), `type ValidationIssue = { path: string; message: string }`, `toIssues(error: z.ZodError): ValidationIssue[]`
  - `shared/types.ts`: `interface PhaseRecord { id: number; name: string; order: number; durationDays: number; start: ISODate; end: ISODate }`, `interface ProjectRecord { id: number; name: string; jiraKey: string | null; color: string; startDate: ISODate; phases: PhaseRecord[] }`
  - `server/db.ts`: `openDb(file: string): DatabaseSync`, `migrate(db: DatabaseSync): void`, `transaction<T>(db: DatabaseSync, fn: () => T): T`
  - `server/settings.ts`: `getCalendar(db): WorkCalendar`, `setCalendar(db, cal): void`
  - `server/projects/repo.ts`: `createProject(db, cal, input: NewProject): ProjectRecord`, `getProject(db, id: number): ProjectRecord | undefined`, `listProjects(db): ProjectRecord[]` (ordered by start date, then id)
  - `server/app.ts`: `buildApp(db: DatabaseSync)`
  - HTTP:
    - `GET /api/health` → `{ ok: true }`
    - `GET /api/settings/calendar` → `WorkCalendar`
    - `GET /api/projects` → `ProjectRecord[]`
    - `GET /api/projects/:id` → `ProjectRecord`, or 404 `{ error }`
    - `POST /api/projects` → 201 `ProjectRecord`, or 400 `{ error, issues: ValidationIssue[] }`

- [ ] **Step 1: Write the failing schema test** `shared/schemas.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { newProjectSchema, toIssues } from './schemas';

const valid = {
  name: '  Customer Portal  ',
  jiraKey: '',
  color: '#3b82f6',
  startDate: '2026-09-24',
  phases: [{ name: 'Requirements', durationDays: 5 }],
};

describe('newProjectSchema', () => {
  it('accepts a valid project, trims the name and turns an empty Jira key into null', () => {
    const parsed = newProjectSchema.parse(valid);
    expect(parsed.name).toBe('Customer Portal');
    expect(parsed.jiraKey).toBeNull();
  });
  it('reports readable issues with field paths', () => {
    const result = newProjectSchema.safeParse({ ...valid, name: ' ', startDate: '2026-02-30', phases: [{ name: 'A', durationDays: 0 }] });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(toIssues(result.error)).toEqual(expect.arrayContaining([
      { path: 'name', message: 'Project name is required' },
      { path: 'startDate', message: 'Must be a valid date (YYYY-MM-DD)' },
      { path: 'phases.0.durationDays', message: 'Duration must be at least 1 working day' },
    ]));
  });
  it('requires at least one phase', () => {
    const result = newProjectSchema.safeParse({ ...valid, phases: [] });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(toIssues(result.error)).toContainEqual({ path: 'phases', message: 'Add at least one phase' });
  });
});
```

- [ ] **Step 2: Write the failing API test** `server/projects/projects.test.ts`

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { buildApp } from '../app';
import { migrate, openDb } from '../db';
import { setCalendar } from '../settings';

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
      { id: expect.any(Number), name: 'Requirements', order: 0, durationDays: 2, start: '2026-09-24', end: '2026-09-25' },
      { id: expect.any(Number), name: 'Development', order: 1, durationDays: 3, start: '2026-09-28', end: '2026-09-30' },
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
});
```

- [ ] **Step 3: Replace `server/app.test.ts`**. `buildApp` now needs a database.

```ts
import { describe, expect, it } from 'vitest';
import { buildApp } from './app';
import { openDb } from './db';

describe('health', () => {
  it('reports ok', async () => {
    const app = buildApp(openDb(':memory:'));
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx vitest run shared/schemas.test.ts server`
Expected: FAIL. The files report that they cannot resolve `./schemas`, `../db` and `./db`.

- [ ] **Step 5: Implement `shared/schemas.ts` and `shared/types.ts`**

`shared/schemas.ts`:
```ts
import { z } from 'zod';
import { isISODate } from './calendar';

export const isoDate = z.string().refine(isISODate, 'Must be a valid date (YYYY-MM-DD)');

export const phaseInputSchema = z.object({
  name: z.string().trim().min(1, 'Phase name is required').max(200),
  durationDays: z
    .number({ invalid_type_error: 'Duration must be a number' })
    .int('Duration must be a whole number of days')
    .min(1, 'Duration must be at least 1 working day')
    .max(2000, 'Duration is too long'),
});

export const newProjectSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required').max(200),
  jiraKey: z
    .string()
    .trim()
    .max(50)
    .nullish()
    .transform((v) => (v ? v : null)),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Colour must look like #3b82f6'),
  startDate: isoDate,
  phases: z.array(phaseInputSchema).min(1, 'Add at least one phase'),
});

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

`shared/types.ts`:
```ts
import type { ISODate } from './calendar';

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
  phases: PhaseRecord[];
}
```

- [ ] **Step 6: Implement `server/db.ts`**

```ts
import { DatabaseSync } from 'node:sqlite';

/** Each entry is one schema version. Never edit a shipped migration — append a new one. */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE projects (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    jira_key TEXT,
    color TEXT NOT NULL,
    start_date TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE phases (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    duration_days INTEGER NOT NULL,
    planned_start TEXT NOT NULL,
    planned_end TEXT NOT NULL
  );
  CREATE INDEX phases_project ON phases(project_id);
  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
];

export function transaction<T>(db: DatabaseSync, fn: () => T): T {
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

export function migrate(db: DatabaseSync): void {
  const row = db.prepare('PRAGMA user_version').get() as unknown as { user_version: number };
  for (let version = row.user_version; version < MIGRATIONS.length; version++) {
    transaction(db, () => {
      db.exec(MIGRATIONS[version]);
      db.exec(`PRAGMA user_version = ${version + 1}`);
    });
  }
}

export function openDb(file: string): DatabaseSync {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON');
  migrate(db);
  return db;
}
```

- [ ] **Step 7: Implement `server/settings.ts`**

```ts
import type { DatabaseSync } from 'node:sqlite';
import { DEFAULT_CALENDAR, type WorkCalendar } from '../shared/calendar';

export function getCalendar(db: DatabaseSync): WorkCalendar {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'calendar'").get() as unknown as { value: string } | undefined;
  return row ? (JSON.parse(row.value) as WorkCalendar) : DEFAULT_CALENDAR;
}

export function setCalendar(db: DatabaseSync, cal: WorkCalendar): void {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES ('calendar', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(JSON.stringify(cal));
}
```

- [ ] **Step 8: Implement `server/projects/repo.ts`**

```ts
import type { DatabaseSync } from 'node:sqlite';
import type { WorkCalendar } from '../../shared/calendar';
import type { NewProject } from '../../shared/schemas';
import { schedulePhases } from '../../shared/scheduler';
import type { PhaseRecord, ProjectRecord } from '../../shared/types';
import { transaction } from '../db';

interface ProjectRow {
  id: number;
  name: string;
  jira_key: string | null;
  color: string;
  start_date: string;
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

function toProject(row: ProjectRow, phases: PhaseRecord[]): ProjectRecord {
  return { id: row.id, name: row.name, jiraKey: row.jira_key, color: row.color, startDate: row.start_date, phases };
}

export function createProject(db: DatabaseSync, cal: WorkCalendar, input: NewProject): ProjectRecord {
  const scheduled = schedulePhases(input.startDate, input.phases, cal);
  const id = transaction(db, () => {
    const res = db
      .prepare('INSERT INTO projects (name, jira_key, color, start_date, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(input.name, input.jiraKey, input.color, input.startDate, new Date().toISOString());
    const projectId = Number(res.lastInsertRowid);
    const insertPhase = db.prepare(
      'INSERT INTO phases (project_id, name, sort_order, duration_days, planned_start, planned_end) VALUES (?, ?, ?, ?, ?, ?)',
    );
    for (const p of scheduled) insertPhase.run(projectId, p.name, p.order, p.durationDays, p.start, p.end);
    return projectId;
  });
  return getProject(db, id)!;
}

export function getProject(db: DatabaseSync, id: number): ProjectRecord | undefined {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as unknown as ProjectRow | undefined;
  if (!row) return undefined;
  const phases = db
    .prepare('SELECT * FROM phases WHERE project_id = ? ORDER BY sort_order')
    .all(id) as unknown as PhaseRow[];
  return toProject(row, phases.map(toPhase));
}

export function listProjects(db: DatabaseSync): ProjectRecord[] {
  const rows = db.prepare('SELECT * FROM projects ORDER BY start_date, id').all() as unknown as ProjectRow[];
  const phaseRows = db.prepare('SELECT * FROM phases ORDER BY project_id, sort_order').all() as unknown as PhaseRow[];
  const byProject = new Map<number, PhaseRecord[]>();
  for (const p of phaseRows) {
    const list = byProject.get(p.project_id) ?? [];
    list.push(toPhase(p));
    byProject.set(p.project_id, list);
  }
  return rows.map((r) => toProject(r, byProject.get(r.id) ?? []));
}
```

- [ ] **Step 9: Replace `server/app.ts`**

```ts
import Fastify from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { newProjectSchema, toIssues } from '../shared/schemas';
import { createProject, getProject, listProjects } from './projects/repo';
import { getCalendar } from './settings';

export function buildApp(db: DatabaseSync) {
  const app = Fastify();

  app.get('/api/health', async () => ({ ok: true }));

  app.get('/api/settings/calendar', async () => getCalendar(db));

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

  return app;
}
```

- [ ] **Step 10: Replace `server/index.ts`**

```ts
import { mkdirSync } from 'node:fs';
import { buildApp } from './app';
import { openDb } from './db';

mkdirSync('data', { recursive: true });
const db = openDb('data/pm.db');
const app = buildApp(db);

app
  .listen({ port: 3001, host: '127.0.0.1' })
  .then(() => console.log('API ready on http://127.0.0.1:3001'))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
```

- [ ] **Step 11: Run the tests to verify they pass**

Run: `npx vitest run`
Expected: PASS (all tests, including 6 new API tests and 3 schema tests).

Run: `npm run typecheck`
Expected: exit code 0.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: SQLite storage and project API with working-day scheduling"
```

---

### Task 5: SVG Gantt renderer

**Files:**
- Create: `client/gantt/scale.ts`, `client/gantt/scale.test.ts`
- Create: `client/gantt/Gantt.tsx`, `client/gantt/Gantt.test.tsx`
- Create: `client/gantt/rows.ts`, `client/gantt/rows.test.ts`
- Create: `client/gantt/useElementWidth.ts`

**Interfaces:**
- Consumes: `ISODate`, `addDays`, `daysBetween` (Task 2); `ProjectRecord` (Task 4).
- Produces:
  - `scale.ts`: `interface TimeScale { start; end; width; x(date: ISODate): number; dayWidth: number; ticks: { date: ISODate; x: number; label: string }[] }`, `createTimeScale(start, end, width): TimeScale`, `monthPaddedRange(start, end): DateRange`
  - `Gantt.tsx`:
    - `interface GanttBar { id: string; start: ISODate; end: ISODate; color: string; label?: string; title?: string }`
    - `interface GanttRow { id: string; label: string; bars: GanttBar[] }`
    - `interface GanttProps { rows: GanttRow[]; range: DateRange; width: number; today?: ISODate; onRowClick?: (rowId: string) => void }`
    - `Gantt(props)`
    - Test ids: `gantt-row-<rowId>`, `gantt-bar-<barId>`, `gantt-today`
  - `rows.ts`:
    - `phaseRows(project: { color: string; phases: { id?: number; order: number; name: string; start: ISODate; end: ISODate }[] }): GanttRow[]`
    - `portfolioRows(projects: ProjectRecord[]): GanttRow[]`
    - `rangeFor(rows: GanttRow[], fallback: ISODate): DateRange`
  - `useElementWidth.ts`: `useElementWidth<T extends HTMLElement>(fallback?: number): [(el: T | null) => void, number]` (a callback ref, so it works for charts that appear after loading)

- [ ] **Step 1: Write the failing scale test** `client/gantt/scale.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { createTimeScale, monthPaddedRange } from './scale';

describe('createTimeScale', () => {
  it('maps dates linearly to pixels', () => {
    const s = createTimeScale('2026-01-01', '2026-01-10', 100);
    expect(s.dayWidth).toBe(10);
    expect(s.x('2026-01-01')).toBe(0);
    expect(s.x('2026-01-06')).toBe(50);
  });
  it('puts a tick on each month start, with the year on January and the first tick', () => {
    const s = createTimeScale('2026-11-01', '2027-02-28', 1200);
    expect(s.ticks.map((t) => t.label)).toEqual(['Nov 2026', 'Dec', 'Jan 2027', 'Feb']);
  });
  it('skips a month start before the range', () => {
    const s = createTimeScale('2026-01-15', '2026-03-10', 500);
    expect(s.ticks.map((t) => t.date)).toEqual(['2026-02-01', '2026-03-01']);
  });
});

describe('monthPaddedRange', () => {
  it('pads to whole months', () => {
    expect(monthPaddedRange('2026-02-10', '2026-04-03')).toEqual({ start: '2026-02-01', end: '2026-04-30' });
    expect(monthPaddedRange('2026-12-05', '2026-12-20')).toEqual({ start: '2026-12-01', end: '2026-12-31' });
  });
});
```

- [ ] **Step 2: Write the failing Gantt test** `client/gantt/Gantt.test.tsx`

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Gantt, type GanttRow } from './Gantt';

const rows: GanttRow[] = [
  { id: 'a', label: 'Requirements', bars: [{ id: 'a1', start: '2026-01-01', end: '2026-01-05', color: '#3b82f6' }] },
  { id: 'b', label: 'Old work', bars: [{ id: 'b1', start: '2025-12-01', end: '2025-12-10', color: '#999999' }] },
];
const range = { start: '2026-01-01', end: '2026-01-10' };

describe('Gantt', () => {
  it('draws bars sized by working span, offset by the label column', () => {
    render(<Gantt rows={rows} range={range} width={300} />);
    expect(screen.getByText('Requirements')).toBeInTheDocument();
    const rect = screen.getByTestId('gantt-bar-a1').querySelector('rect')!;
    expect(rect.getAttribute('x')).toBe('200');
    expect(rect.getAttribute('width')).toBe('50');
  });
  it('does not draw bars outside the range', () => {
    render(<Gantt rows={rows} range={range} width={300} />);
    expect(screen.queryByTestId('gantt-bar-b1')).toBeNull();
  });
  it('reports row clicks', async () => {
    const onRowClick = vi.fn();
    render(<Gantt rows={rows} range={range} width={300} onRowClick={onRowClick} />);
    await userEvent.click(screen.getByTestId('gantt-row-a'));
    expect(onRowClick).toHaveBeenCalledWith('a');
  });
  it('draws a today line only when today is in range', () => {
    const { rerender } = render(<Gantt rows={rows} range={range} width={300} today="2026-01-03" />);
    expect(screen.getByTestId('gantt-today')).toBeInTheDocument();
    rerender(<Gantt rows={rows} range={range} width={300} today="2026-05-01" />);
    expect(screen.queryByTestId('gantt-today')).toBeNull();
  });
});
```

- [ ] **Step 3: Write the failing rows test** `client/gantt/rows.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import type { ProjectRecord } from '../../shared/types';
import { phaseRows, portfolioRows, rangeFor } from './rows';

const project: ProjectRecord = {
  id: 1, name: 'Portal', jiraKey: null, color: '#3b82f6', startDate: '2026-02-10',
  phases: [
    { id: 11, name: 'Requirements', order: 0, durationDays: 2, start: '2026-02-10', end: '2026-02-11' },
    { id: 12, name: 'Development', order: 1, durationDays: 30, start: '2026-02-12', end: '2026-03-25' },
  ],
};

describe('rows', () => {
  it('makes one row per phase', () => {
    const rows = phaseRows(project);
    expect(rows.map((r) => r.label)).toEqual(['Requirements', 'Development']);
    expect(rows[1].bars[0]).toMatchObject({ id: '12', start: '2026-02-12', end: '2026-03-25', color: '#3b82f6' });
  });
  it('uses the phase order as id for unsaved phases', () => {
    const rows = phaseRows({ color: '#000000', phases: [{ order: 0, name: 'A', start: '2026-01-01', end: '2026-01-02' }] });
    expect(rows[0].id).toBe('0');
  });
  it('makes one row per project with a bar per phase', () => {
    const rows = portfolioRows([project]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: '1', label: 'Portal' });
    expect(rows[0].bars.map((b) => b.label)).toEqual(['Requirements', 'Development']);
  });
  it('computes a month-padded range over all bars', () => {
    expect(rangeFor(phaseRows(project), '2030-01-01')).toEqual({ start: '2026-02-01', end: '2026-03-31' });
    expect(rangeFor([], '2026-09-24')).toEqual({ start: '2026-09-01', end: '2026-09-30' });
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx vitest run client/gantt`
Expected: FAIL. The files report that they cannot resolve `./scale`, `./Gantt` and `./rows`.

- [ ] **Step 5: Implement `client/gantt/scale.ts`**

```ts
import { addDays, daysBetween, type DateRange, type ISODate } from '../../shared/calendar';

export interface TimeScale {
  start: ISODate;
  end: ISODate;
  width: number;
  dayWidth: number;
  x(date: ISODate): number;
  ticks: { date: ISODate; x: number; label: string }[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function firstOfMonth(d: ISODate): ISODate {
  return `${d.slice(0, 7)}-01`;
}

function nextMonth(firstOfMonthDate: ISODate): ISODate {
  const year = Number(firstOfMonthDate.slice(0, 4));
  const month = Number(firstOfMonthDate.slice(5, 7));
  return month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
}

/** Linear day scale; `end` is inclusive, so the last day gets a full day of width. */
export function createTimeScale(start: ISODate, end: ISODate, width: number): TimeScale {
  const totalDays = daysBetween(start, end) + 1;
  const dayWidth = width / totalDays;
  const x = (date: ISODate) => daysBetween(start, date) * dayWidth;

  const ticks: TimeScale['ticks'] = [];
  let m = firstOfMonth(start);
  if (m < start) m = nextMonth(m);
  while (m <= end) {
    const month = Number(m.slice(5, 7));
    const withYear = month === 1 || ticks.length === 0;
    ticks.push({ date: m, x: x(m), label: MONTHS[month - 1] + (withYear ? ` ${m.slice(0, 4)}` : '') });
    m = nextMonth(m);
  }
  return { start, end, width, dayWidth, x, ticks };
}

export function monthPaddedRange(start: ISODate, end: ISODate): DateRange {
  return { start: firstOfMonth(start), end: addDays(nextMonth(firstOfMonth(end)), -1) };
}
```

- [ ] **Step 6: Implement `client/gantt/Gantt.tsx`**

```tsx
import type { DateRange, ISODate } from '../../shared/calendar';
import { createTimeScale } from './scale';

export interface GanttBar {
  id: string;
  start: ISODate;
  end: ISODate;
  color: string;
  label?: string;
  title?: string;
}

export interface GanttRow {
  id: string;
  label: string;
  bars: GanttBar[];
}

export interface GanttProps {
  rows: GanttRow[];
  range: DateRange;
  width: number;
  today?: ISODate;
  onRowClick?: (rowId: string) => void;
}

const LABEL_W = 200;
const HEADER_H = 28;
const ROW_H = 36;
const BAR_H = 20;
const APPROX_CHAR_W = 6.5;

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function Gantt({ rows, range, width, today, onRowClick }: GanttProps) {
  const chartW = Math.max(width - LABEL_W, 100);
  const scale = createTimeScale(range.start, range.end, chartW);
  const height = HEADER_H + rows.length * ROW_H;
  const totalW = LABEL_W + chartW;

  return (
    <svg width={totalW} height={height} role="img" aria-label="Gantt chart" className="gantt">
      <g transform={`translate(${LABEL_W},0)`}>
        {scale.ticks.map((t) => (
          <g key={t.date}>
            <line x1={t.x} x2={t.x} y1={0} y2={height} className="gantt-grid" />
            <text x={t.x + 4} y={18} className="gantt-tick">{t.label}</text>
          </g>
        ))}
      </g>

      {rows.map((row, i) => {
        const y = HEADER_H + i * ROW_H;
        return (
          <g
            key={row.id}
            data-testid={`gantt-row-${row.id}`}
            className={onRowClick ? 'gantt-row clickable' : 'gantt-row'}
            onClick={onRowClick ? () => onRowClick(row.id) : undefined}
          >
            <rect x={0} y={y} width={totalW} height={ROW_H} className="gantt-row-bg" />
            <text x={8} y={y + ROW_H / 2 + 4} className="gantt-label">
              <title>{row.label}</title>
              {truncate(row.label, 28)}
            </text>
            {row.bars
              .filter((bar) => bar.end >= range.start && bar.start <= range.end)
              .map((bar) => {
                const s = bar.start < range.start ? range.start : bar.start;
                const e = bar.end > range.end ? range.end : bar.end;
                const x = LABEL_W + scale.x(s);
                const w = Math.max(scale.x(e) + scale.dayWidth - scale.x(s), 2);
                const showLabel = bar.label !== undefined && bar.label.length * APPROX_CHAR_W + 12 < w;
                return (
                  <g key={bar.id} data-testid={`gantt-bar-${bar.id}`}>
                    <rect x={x} y={y + (ROW_H - BAR_H) / 2} width={w} height={BAR_H} rx={4} fill={bar.color} className="gantt-bar">
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

      {today && today >= range.start && today <= range.end ? (
        <line
          data-testid="gantt-today"
          x1={LABEL_W + scale.x(today)}
          x2={LABEL_W + scale.x(today)}
          y1={HEADER_H - 4}
          y2={height}
          className="gantt-today"
        />
      ) : null}
    </svg>
  );
}
```

- [ ] **Step 7: Implement `client/gantt/rows.ts`**

```ts
import type { DateRange, ISODate } from '../../shared/calendar';
import type { ProjectRecord } from '../../shared/types';
import type { GanttRow } from './Gantt';
import { monthPaddedRange } from './scale';

interface PhaseLike {
  id?: number;
  order: number;
  name: string;
  start: ISODate;
  end: ISODate;
}

export function phaseRows(project: { color: string; phases: PhaseLike[] }): GanttRow[] {
  return project.phases.map((p) => {
    const id = String(p.id ?? p.order);
    return {
      id,
      label: p.name,
      bars: [{ id, start: p.start, end: p.end, color: project.color, title: `${p.name}: ${p.start} → ${p.end}` }],
    };
  });
}

export function portfolioRows(projects: ProjectRecord[]): GanttRow[] {
  return projects.map((p) => ({
    id: String(p.id),
    label: p.name,
    bars: p.phases.map((ph) => ({
      id: `${p.id}-${ph.id}`,
      start: ph.start,
      end: ph.end,
      color: p.color,
      label: ph.name,
      title: `${p.name} · ${ph.name}: ${ph.start} → ${ph.end}`,
    })),
  }));
}

export function rangeFor(rows: GanttRow[], fallback: ISODate): DateRange {
  const bars = rows.flatMap((r) => r.bars);
  if (bars.length === 0) return monthPaddedRange(fallback, fallback);
  let start = bars[0].start;
  let end = bars[0].end;
  for (const b of bars) {
    if (b.start < start) start = b.start;
    if (b.end > end) end = b.end;
  }
  return monthPaddedRange(start, end);
}
```

- [ ] **Step 8: Implement `client/gantt/useElementWidth.ts`**

```ts
import { useCallback, useRef, useState } from 'react';

/**
 * Tracks an element's width so the SVG chart can fill its container.
 * Returns a callback ref, so it also works when the element appears after data loads.
 */
export function useElementWidth<T extends HTMLElement>(fallback = 960): [(el: T | null) => void, number] {
  const [width, setWidth] = useState(fallback);
  const observerRef = useRef<ResizeObserver | null>(null);

  const ref = useCallback((el: T | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.floor(w));
    });
    observer.observe(el);
    observerRef.current = observer;
  }, []);

  return [ref, width];
}
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npx vitest run client/gantt`
Expected: PASS (12 tests).

Run: `npm run typecheck`
Expected: exit code 0.

- [ ] **Step 10: Commit**

```bash
git add client/gantt
git commit -m "feat: SVG Gantt renderer with time scale and row builders"
```

---

### Task 6: Create Project page with live Gantt preview

**Files:**
- Create: `client/api.ts`, `client/useAsync.ts`, `client/testing/mockFetch.ts`
- Create: `client/pages/manage/CreateProjectPage.tsx`, `client/pages/manage/CreateProjectPage.test.tsx`
- Modify (replace whole file): `client/App.tsx`

**Interfaces:**
- Consumes: `newProjectSchema`, `toIssues`, `NewProjectInput`, `ValidationIssue` (Task 4); `ProjectRecord` (Task 4); `schedulePhases`, `PhaseInput` (Task 3); `DEFAULT_CALENDAR`, `isISODate`, `todayLocal`, `WorkCalendar` (Task 2); `Gantt`, `phaseRows`, `rangeFor`, `useElementWidth` (Task 5).
- Produces:
  - `client/api.ts`: `class ApiError extends Error { status: number; issues: ValidationIssue[] }`, and `api.getCalendar()`, `api.listProjects()`, `api.getProject(id)`, `api.createProject(input)`
  - `client/useAsync.ts`: `useAsync<T>(load: () => Promise<T>, deps: unknown[]): { data?: T; error?: Error; loading: boolean }`
  - `client/testing/mockFetch.ts`: `mockFetch(routes: Record<string, MockHandler>)`, where the key is `"METHOD /url"` and `MockHandler = (init?: RequestInit) => { status?: number; body: unknown }`. Returns the `vi.fn`. Also `sampleProject(overrides?)`.
  - Route `/manage/projects/new`.

- [ ] **Step 1: Create the test helper** `client/testing/mockFetch.ts`

```ts
import { vi } from 'vitest';
import type { ProjectRecord } from '../../shared/types';

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
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
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
    phases: [
      { id: 11, name: 'Requirements', order: 0, durationDays: 2, start: '2026-09-24', end: '2026-09-25' },
      { id: 12, name: 'Development', order: 1, durationDays: 3, start: '2026-09-28', end: '2026-09-30' },
    ],
    ...overrides,
  };
}
```

- [ ] **Step 2: Write the failing test** `client/pages/manage/CreateProjectPage.test.tsx`

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router';
import { describe, expect, it } from 'vitest';
import { mockFetch, sampleProject } from '../../testing/mockFetch';
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

const calendarRoute = { 'GET /api/settings/calendar': () => ({ body: { weekendDays: [0, 6], holidays: [] } }) };

describe('CreateProjectPage', () => {
  it('starts with standard phases and previews them on a Gantt chart', async () => {
    mockFetch(calendarRoute);
    renderPage();
    expect(screen.getByLabelText('Phase 4 name')).toHaveValue('Development');
    expect(await screen.findByTestId('gantt-row-3')).toBeInTheDocument();
  });

  it('saves the project and opens its page', async () => {
    const fetchMock = mockFetch({
      ...calendarRoute,
      'POST /api/projects': () => ({ status: 201, body: sampleProject({ id: 7 }) }),
    });
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('Project name'), 'Portal');
    await user.type(screen.getByLabelText('Jira key'), 'PRJ-7');
    await user.click(screen.getByRole('button', { name: 'Create project' }));

    expect(await screen.findByText('Project page 7')).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([url, init]) => url === '/api/projects' && init?.method === 'POST');
    const sent = JSON.parse(post![1]!.body as string);
    expect(sent).toMatchObject({ name: 'Portal', jiraKey: 'PRJ-7', color: '#3b82f6' });
    expect(sent.phases).toHaveLength(7);
  });

  it('shows validation errors and does not submit', async () => {
    const fetchMock = mockFetch(calendarRoute);
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Create project' }));
    expect(await screen.findByText('Project name is required')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('adds and removes phases', async () => {
    mockFetch(calendarRoute);
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Add phase' }));
    expect(screen.getByLabelText('Phase 8 name')).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Remove phase 8' }));
    expect(screen.queryByLabelText('Phase 8 name')).toBeNull();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run client/pages/manage`
Expected: FAIL, "Failed to resolve import './CreateProjectPage'".

- [ ] **Step 4: Implement `client/api.ts`**

```ts
import type { WorkCalendar } from '../shared/calendar';
import type { NewProjectInput, ValidationIssue } from '../shared/schemas';
import type { ProjectRecord } from '../shared/types';

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
  const res = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? `Request failed (${res.status})`, res.status, body.issues ?? []);
  return body as T;
}

export const api = {
  getCalendar: () => request<WorkCalendar>('/api/settings/calendar'),
  listProjects: () => request<ProjectRecord[]>('/api/projects'),
  getProject: (id: number) => request<ProjectRecord>(`/api/projects/${id}`),
  createProject: (input: NewProjectInput) =>
    request<ProjectRecord>('/api/projects', { method: 'POST', body: JSON.stringify(input) }),
};
```

- [ ] **Step 5: Implement `client/useAsync.ts`**

```ts
import { useEffect, useState } from 'react';

interface AsyncState<T> {
  data?: T;
  error?: Error;
  loading: boolean;
}

/** Runs `load` whenever `deps` change; ignores results from outdated runs. */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ loading: true });

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    load().then(
      (data) => { if (!cancelled) setState({ data, loading: false }); },
      (error: Error) => { if (!cancelled) setState({ error, loading: false }); },
    );
    return () => { cancelled = true; };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}
```

- [ ] **Step 6: Implement `client/pages/manage/CreateProjectPage.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { DEFAULT_CALENDAR, isISODate, todayLocal } from '../../../shared/calendar';
import { newProjectSchema, toIssues, type ValidationIssue } from '../../../shared/schemas';
import { schedulePhases, type PhaseInput } from '../../../shared/scheduler';
import { ApiError, api } from '../../api';
import { Gantt } from '../../gantt/Gantt';
import { phaseRows, rangeFor } from '../../gantt/rows';
import { useElementWidth } from '../../gantt/useElementWidth';
import { useAsync } from '../../useAsync';

const DEFAULT_PHASES: PhaseInput[] = [
  { name: 'Requirements gathering', durationDays: 10 },
  { name: 'Business analysis', durationDays: 10 },
  { name: 'Design', durationDays: 10 },
  { name: 'Development', durationDays: 40 },
  { name: 'QA', durationDays: 15 },
  { name: 'UAT', durationDays: 10 },
  { name: 'Go-live', durationDays: 2 },
];

export function CreateProjectPage() {
  const navigate = useNavigate();
  const calendar = useAsync(() => api.getCalendar(), []);
  const [name, setName] = useState('');
  const [jiraKey, setJiraKey] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [startDate, setStartDate] = useState(todayLocal());
  const [phases, setPhases] = useState<PhaseInput[]>(DEFAULT_PHASES);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [saving, setSaving] = useState(false);
  const [chartRef, chartWidth] = useElementWidth<HTMLDivElement>();

  const cal = calendar.data ?? DEFAULT_CALENDAR;
  const previewPhases = phases.filter((p) => p.name.trim() !== '' && Number.isInteger(p.durationDays) && p.durationDays >= 1);
  const scheduled = isISODate(startDate) ? schedulePhases(startDate, previewPhases, cal) : [];
  const rows = phaseRows({ color, phases: scheduled });
  const range = rangeFor(rows, isISODate(startDate) ? startDate : todayLocal());

  function updatePhase(index: number, patch: Partial<PhaseInput>) {
    setPhases((ps) => ps.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = newProjectSchema.safeParse({ name, jiraKey, color, startDate, phases });
    if (!parsed.success) {
      setIssues(toIssues(parsed.error));
      return;
    }
    setIssues([]);
    setSaving(true);
    try {
      const project = await api.createProject(parsed.data);
      navigate(`/manage/projects/${project.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.issues.length > 0) setIssues(err.issues);
      else setIssues([{ path: '', message: err instanceof Error ? err.message : String(err) }]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <Link to="/manage" className="crumb">← Projects</Link>
          <h1>New project</h1>
        </div>
      </div>

      <form onSubmit={onSubmit} noValidate>
        {issues.length > 0 ? (
          <div className="errors" role="alert">
            <ul>{issues.map((i) => <li key={`${i.path}-${i.message}`}>{i.message}</li>)}</ul>
          </div>
        ) : null}

        <section className="card">
          <h2>Details</h2>
          <div className="form-grid">
            <label>Project name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label>Jira key<input value={jiraKey} onChange={(e) => setJiraKey(e.target.value)} placeholder="PRJ-123" /></label>
            <label>Start date<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
            <label>Colour<input type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label>
          </div>
        </section>

        <section className="card">
          <h2>Phases</h2>
          <p className="muted">Durations are in working days. Dates are calculated from the working calendar.</p>
          {phases.map((phase, i) => (
            <div className="phase-row" key={i}>
              <input
                aria-label={`Phase ${i + 1} name`}
                value={phase.name}
                onChange={(e) => updatePhase(i, { name: e.target.value })}
              />
              <input
                aria-label={`Phase ${i + 1} working days`}
                type="number"
                min={1}
                value={Number.isNaN(phase.durationDays) ? '' : phase.durationDays}
                onChange={(e) => updatePhase(i, { durationDays: e.target.valueAsNumber })}
              />
              <button
                type="button"
                className="button secondary"
                aria-label={`Remove phase ${i + 1}`}
                onClick={() => setPhases((ps) => ps.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            </div>
          ))}
          <button type="button" className="button secondary" onClick={() => setPhases((ps) => [...ps, { name: '', durationDays: 5 }])}>
            Add phase
          </button>
        </section>

        <section className="card">
          <h2>Preview</h2>
          <div className="chart-scroll" ref={chartRef}>
            <Gantt rows={rows} range={range} width={chartWidth} />
          </div>
        </section>

        <button type="submit" className="button" disabled={saving}>
          {saving ? 'Saving…' : 'Create project'}
        </button>
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

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/manage/projects/new" element={<CreateProjectPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run client`
Expected: PASS (all client tests, including 4 new ones).

Run: `npm run typecheck`
Expected: exit code 0.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: create-project page with live Gantt preview"
```

---

### Task 7: Projects dashboard and project page (completes M1)

**Files:**
- Create: `client/pages/manage/ManageDashboardPage.tsx`, `client/pages/manage/ManageDashboardPage.test.tsx`
- Create: `client/pages/manage/ProjectPage.tsx`, `client/pages/manage/ProjectPage.test.tsx`
- Modify (replace whole file): `client/App.tsx`

**Interfaces:**
- Consumes: `api`, `useAsync` (Task 6); `Gantt`, `phaseRows`, `portfolioRows`, `rangeFor`, `useElementWidth` (Task 5); `projectSpan` (Task 3); `todayLocal`, `countWorkingDays`, `DEFAULT_CALENDAR` (Task 2); `mockFetch`, `sampleProject` (Task 6).
- Produces: the routes `/manage` and `/manage/projects/:id`.

- [ ] **Step 1: Write the failing dashboard test** `client/pages/manage/ManageDashboardPage.test.tsx`

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { mockFetch, sampleProject } from '../../testing/mockFetch';
import { ManageDashboardPage } from './ManageDashboardPage';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/manage']}>
      <Routes>
        <Route path="/manage" element={<ManageDashboardPage />} />
        <Route path="/manage/projects/:id" element={<div>Project opened</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ManageDashboardPage', () => {
  it('lists projects with links and dates', async () => {
    mockFetch({ 'GET /api/projects': () => ({ body: [sampleProject()] }) });
    renderPage();
    expect(await screen.findByRole('link', { name: 'Portal' })).toHaveAttribute('href', '/manage/projects/1');
    expect(screen.getByText('PRJ-1')).toBeInTheDocument();
    expect(screen.getByText('2026-09-30')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New project' })).toHaveAttribute('href', '/manage/projects/new');
  });

  it('opens a project from the chart', async () => {
    mockFetch({ 'GET /api/projects': () => ({ body: [sampleProject()] }) });
    renderPage();
    await userEvent.click(await screen.findByTestId('gantt-row-1'));
    expect(await screen.findByText('Project opened')).toBeInTheDocument();
  });

  it('shows an empty state', async () => {
    mockFetch({ 'GET /api/projects': () => ({ body: [] }) });
    renderPage();
    expect(await screen.findByText(/No projects yet/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Write the failing project page test** `client/pages/manage/ProjectPage.test.tsx`

```tsx
// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { mockFetch, sampleProject } from '../../testing/mockFetch';
import { ProjectPage } from './ProjectPage';

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/manage/projects/:id" element={<ProjectPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProjectPage', () => {
  it('shows the project header, Gantt chart and phase table', async () => {
    mockFetch({
      'GET /api/projects/1': () => ({ body: sampleProject() }),
      'GET /api/settings/calendar': () => ({ body: { weekendDays: [0, 6], holidays: [] } }),
    });
    renderAt('/manage/projects/1');
    expect(await screen.findByRole('heading', { name: 'Portal' })).toBeInTheDocument();
    expect(screen.getByText(/2026-09-24 → 2026-09-30/)).toBeInTheDocument();
    expect(screen.getByTestId('gantt-row-12')).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByText('Development')).toBeInTheDocument();
    expect(within(table).getByText('3')).toBeInTheDocument();
  });

  it('says when a project does not exist', async () => {
    mockFetch({
      'GET /api/projects/999': () => ({ status: 404, body: { error: 'Project not found' } }),
      'GET /api/settings/calendar': () => ({ body: { weekendDays: [0, 6], holidays: [] } }),
    });
    renderAt('/manage/projects/999');
    expect(await screen.findByText('Project not found')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run client/pages/manage`
Expected: FAIL. The files report that they cannot resolve `./ManageDashboardPage` and `./ProjectPage`.

- [ ] **Step 4: Implement `client/pages/manage/ManageDashboardPage.tsx`**

```tsx
import { Link, useNavigate } from 'react-router';
import { todayLocal } from '../../../shared/calendar';
import { projectSpan } from '../../../shared/scheduler';
import { api } from '../../api';
import { Gantt } from '../../gantt/Gantt';
import { portfolioRows, rangeFor } from '../../gantt/rows';
import { useElementWidth } from '../../gantt/useElementWidth';
import { useAsync } from '../../useAsync';

export function ManageDashboardPage() {
  const navigate = useNavigate();
  const projects = useAsync(() => api.listProjects(), []);
  const [chartRef, chartWidth] = useElementWidth<HTMLDivElement>();
  const today = todayLocal();
  const list = projects.data ?? [];
  const rows = portfolioRows(list);

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <Link to="/" className="crumb">← Start</Link>
          <h1>Projects</h1>
        </div>
        <Link to="/manage/projects/new" className="button">New project</Link>
      </div>

      {projects.error ? <div className="errors" role="alert">{projects.error.message}</div> : null}
      {projects.loading && !projects.data ? <p className="muted">Loading…</p> : null}

      {projects.data && list.length === 0 ? (
        <section className="card">
          <p>No projects yet. Create your first one to see it on the timeline.</p>
        </section>
      ) : null}

      {list.length > 0 ? (
        <>
          <section className="card">
            <h2>Timeline</h2>
            <div className="chart-scroll" ref={chartRef}>
              <Gantt
                rows={rows}
                range={rangeFor(rows, today)}
                width={chartWidth}
                today={today}
                onRowClick={(id) => navigate(`/manage/projects/${id}`)}
              />
            </div>
          </section>

          <section className="card">
            <table>
              <thead>
                <tr><th>Project</th><th>Jira key</th><th>Start</th><th>End</th><th>Phases</th></tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const span = projectSpan(p.phases);
                  return (
                    <tr key={p.id}>
                      <td><Link to={`/manage/projects/${p.id}`}>{p.name}</Link></td>
                      <td>{p.jiraKey ?? '—'}</td>
                      <td>{span?.start ?? '—'}</td>
                      <td>{span?.end ?? '—'}</td>
                      <td>{p.phases.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </>
      ) : null}
    </main>
  );
}
```

- [ ] **Step 5: Implement `client/pages/manage/ProjectPage.tsx`**

```tsx
import { Link, useParams } from 'react-router';
import { DEFAULT_CALENDAR, countWorkingDays, todayLocal } from '../../../shared/calendar';
import { projectSpan } from '../../../shared/scheduler';
import { api } from '../../api';
import { Gantt } from '../../gantt/Gantt';
import { phaseRows, rangeFor } from '../../gantt/rows';
import { useElementWidth } from '../../gantt/useElementWidth';
import { useAsync } from '../../useAsync';

export function ProjectPage() {
  const id = Number(useParams().id);
  const project = useAsync(() => api.getProject(id), [id]);
  const calendar = useAsync(() => api.getCalendar(), []);
  const [chartRef, chartWidth] = useElementWidth<HTMLDivElement>();
  const today = todayLocal();

  if (project.error) {
    return (
      <main className="page">
        <Link to="/manage" className="crumb">← Projects</Link>
        <div className="errors" role="alert">{project.error.message}</div>
      </main>
    );
  }
  if (!project.data) return <main className="page"><p className="muted">Loading…</p></main>;

  const p = project.data;
  const span = projectSpan(p.phases);
  const rows = phaseRows(p);
  const cal = calendar.data ?? DEFAULT_CALENDAR;

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <Link to="/manage" className="crumb">← Projects</Link>
          <h1>{p.name}</h1>
          <p className="muted">
            {p.jiraKey ? `${p.jiraKey} · ` : ''}
            {span ? `${span.start} → ${span.end} · ${countWorkingDays(span.start, span.end, cal)} working days` : 'No phases'}
          </p>
        </div>
      </div>

      <section className="card">
        <div className="chart-scroll" ref={chartRef}>
          <Gantt rows={rows} range={rangeFor(rows, today)} width={chartWidth} today={today} />
        </div>
      </section>

      <section className="card">
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

- [ ] **Step 6: Replace `client/App.tsx`**

```tsx
import { Route, Routes } from 'react-router';
import { Landing } from './pages/Landing';
import { NotFound } from './pages/NotFound';
import { CreateProjectPage } from './pages/manage/CreateProjectPage';
import { ManageDashboardPage } from './pages/manage/ManageDashboardPage';
import { ProjectPage } from './pages/manage/ProjectPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/manage" element={<ManageDashboardPage />} />
      <Route path="/manage/projects/new" element={<CreateProjectPage />} />
      <Route path="/manage/projects/:id" element={<ProjectPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
```

- [ ] **Step 7: Run all tests and the type check**

Run: `npm test`
Expected: PASS (all tests).

Run: `npm run typecheck`
Expected: exit code 0.

- [ ] **Step 8: Commit and push the branch**

```bash
git add -A
git commit -m "feat: projects dashboard and project page with Gantt chart"
git push -u origin build/m1-m2
```

### ✅ M1 checkpoint: stop and demo to the user

Run `npm run dev` and open http://localhost:5173. The user should be able to:
1. Click **Project Management**. They see an empty state with a **New project** button.
2. Create a project. Changing the start date or phase durations updates the preview Gantt chart live, and weekends are skipped.
3. Land on the project page with its Gantt chart, the today line and the phase table.
4. Go back to **Projects** and see the project in the timeline and in the table. Clicking its row opens the project.
5. Restart `npm run dev`. The data is still there (`data/pm.db`).

**Ask the user for feedback before continuing to M2.**

### Task 7a: Phase reordering and shared phase colour palette (M1 demo feedback, 2026-09-24)

The user reviewed the M1 build and asked for three changes before M2 starts. Two are new behaviour; the third turns on something the renderer already supports:

1. Phases can't be reordered — only deleted and re-added. Fix: **drag-and-drop** reordering in the phase list (not up/down buttons — more clicks for the same result).
2. Every phase bar renders in the project's one colour. Fix: a **fixed colour palette keyed by phase name** — "Requirements" is always the same colour on every project, "Development" always another, "UAT" always another, and so on (see spec §2, §3.2 Step 3). Confirmed 2026-09-24: keyed by **name**, not by position — position was considered and rejected because the user wants the *meaning* of the phase, not its slot, to carry the colour.
3. Phase names aren't shown on the bar in this view, only in the row label. `Gantt.tsx` already draws `bar.label` on the bar (portfolio view already sets it) — `phaseRows` just never set it. Turn it on here too.

**Files:**
- Modify: `client/gantt/rows.ts`, `client/gantt/rows.test.ts`
- Modify: `client/pages/manage/CreateProjectPage.tsx`, `client/pages/manage/CreateProjectPage.test.tsx`
- Modify: `client/styles.css` — the phase row's grid gains a 4th column for the new drag handle, plus a minimal `.drag-handle` style reusing existing tokens (noted here after the fact; the implementer flagged this deviation and it was confirmed as a necessary, in-scope consequence of the drag handle rather than scope creep).

**Interfaces:**
- `rows.ts`:
  - `export const PHASE_PALETTE: string[]` — 8 OKLCH colours (`L 0.62 C 0.12`, hues spread across 95–330°), matching the app's existing token system (`client/styles.css`) and deliberately clear of the red/amber hues already used for `--danger` and `--warning` alerts elsewhere in the spec (late phases, waiting-clock).
  - `const KNOWN_PHASE_COLORS: Record<string, string>` — normalised (trimmed, lower-cased) common phase names mapped one-to-one onto `PHASE_PALETTE`, in typical lifecycle order: `requirements` (also matches `gathering requirements`), `analysis`, `design`, `development`, `testing`/`qa`, `uat`, `security testing`, `deployment`. A short alias list (e.g. `gathering requirements` → `requirements`, `go-live` → `deployment`) covers the obvious variants.
  - `export function phaseColorFor(name: string): string` — normalises `name`; returns the mapped colour if the normalised name (or an alias) is known; otherwise derives a stable index from the normalised name (a simple deterministic string hash mod `PHASE_PALETTE.length`) so any custom phase name still always gets the same colour, on every project, without a persisted registry.
  - `phaseRows(project: { phases: PhaseLike[] }): GanttRow[]` — drops the now-unused `color` from the project param type; each bar gets `color: phaseColorFor(p.name)` and `label: p.name`.
  - `portfolioRows` switches from `p.color` to `phaseColorFor(ph.name)` per bar, for the same reason (consistent palette everywhere, not just the project page).
- `CreateProjectPage.tsx`: each phase row gets a drag handle (`aria-label="Reorder phase N"`) that is itself the draggable element (native HTML5 drag-and-drop: `draggable`, `onDragStart` on the handle; `onDragOver`, `onDrop`, `onDragEnd` on the row) — not the whole row, since a draggable row containing text/number inputs risks interfering with clicking or selecting text inside them in some browsers. Dropping re-indexes the phase state array; the preview is derived directly on each render (not from a `useEffect`), so it re-schedules and re-renders unchanged, since it already reacts to phase list changes. Retyping a phase's name into a recognised one (e.g. "UAT") updates its bar colour live, since colour is derived from the name on every render.

**Acceptance:**
- [ ] `rows.test.ts`: `phaseColorFor('Requirements')` and `phaseColorFor('requirements')` are equal (case-insensitive); `phaseColorFor('Gathering Requirements')` equals `phaseColorFor('Requirements')` (alias); `phaseColorFor('Requirements')` and `phaseColorFor('Development')` differ; two different unknown names deterministically get a colour each, and the same unknown name always gets the same colour; `phaseRows(...)[i].bars[0]` has `label` equal to the phase name and no longer depends on a `color` field on the project.
- [ ] `CreateProjectPage.test.tsx`: dragging phase row 2 above phase row 1 swaps `Phase 1 name` / `Phase 2 name` values and the Gantt preview's row order (`gantt-row-*`) updates to match; the existing "adds and removes phases" test still passes with drag handles present.
- [ ] `Gantt.test.tsx`: unchanged — it already asserts on `bar.label`.
- [ ] `npm test` and `npm run typecheck` both pass.

**Non-goals (still not in scope):** the project page (`ProjectPage.tsx`) is read-only and only displays the saved order — no reordering there. Reordering sub-phases (nested phases) is out of scope until sub-phases ship. A per-phase colour override or an editable name→colour mapping in Settings (spec still says static/shared, not user-chosen) is out of scope.

- [ ] **Commit:**

```bash
git add -A
git commit -m "feat: drag-and-drop phase reordering and shared phase colour palette"
```

**Show the user the updated build for review before continuing to M2.**

---

# MILESTONE 2: Portfolio presentation

### Task 8: Portfolio statistics engine and API

**Files:**
- Create: `shared/portfolio.ts`, `shared/portfolio.test.ts`
- Modify (replace whole file): `shared/types.ts`, `server/app.ts`
- Create: `server/portfolio.test.ts`

**Interfaces:**
- Consumes: `projectSpan` (Task 3); `listProjects` (Task 4); `todayLocal`, `DateRange`, `ISODate` (Task 2).
- Produces:
  - `shared/portfolio.ts`: `type ProjectTimeStatus = 'planned' | 'active' | 'done'`, `projectStatus(span: DateRange, today: ISODate): ProjectTimeStatus`, `overlapsYear(span: DateRange, year: number): boolean`, `interface PortfolioStats { active: number; finishedThisYear: number; startingThisYear: number }`, `portfolioStats(projects: { phases: { start; end }[] }[], year: number, today: ISODate): PortfolioStats`
  - `shared/types.ts`: adds `interface PortfolioResponse { year: number; today: ISODate; stats: PortfolioStats; projects: ProjectRecord[] }`
  - `server/app.ts`: `interface AppOptions { today?: () => ISODate }`, `buildApp(db, opts?: AppOptions)`, and `GET /api/portfolio?year=YYYY` → `PortfolioResponse`, or 400 `{ error }`. When `year` is left out, it defaults to the year of `today`.

Definitions (these become the stakeholder tile labels):
- **Active now:** today is between the project's first start and last end, inclusive. This counts across all projects.
- **Finished in YEAR:** the project is done (last end is before today) and the last end falls in YEAR.
- **Scheduled to start in YEAR:** the project is planned (first start is after today) and the first start falls in YEAR.

- [ ] **Step 1: Write the failing unit test** `shared/portfolio.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { overlapsYear, portfolioStats, projectStatus } from './portfolio';

const today = '2026-09-24';
const p = (start: string, end: string) => ({ phases: [{ start, end }] });

describe('projectStatus', () => {
  it('classifies by today', () => {
    expect(projectStatus({ start: '2026-10-01', end: '2026-12-01' }, today)).toBe('planned');
    expect(projectStatus({ start: '2026-09-24', end: '2026-12-01' }, today)).toBe('active');
    expect(projectStatus({ start: '2026-01-01', end: '2026-09-24' }, today)).toBe('active');
    expect(projectStatus({ start: '2026-01-01', end: '2026-09-23' }, today)).toBe('done');
  });
});

describe('overlapsYear', () => {
  it('detects any overlap with the calendar year', () => {
    expect(overlapsYear({ start: '2025-11-01', end: '2026-01-05' }, 2026)).toBe(true);
    expect(overlapsYear({ start: '2025-01-01', end: '2025-12-31' }, 2026)).toBe(false);
  });
});

describe('portfolioStats', () => {
  it('counts active, finished this year and starting this year', () => {
    const projects = [
      p('2026-01-05', '2026-01-09'), // done in 2026
      p('2025-03-03', '2025-03-07'), // done in 2025
      p('2026-09-01', '2026-11-30'), // active
      p('2026-11-02', '2026-11-13'), // planned, starts 2026
      p('2027-02-01', '2027-03-01'), // planned, starts 2027
      { phases: [] },                // no phases: ignored
    ];
    expect(portfolioStats(projects, 2026, today)).toEqual({ active: 1, finishedThisYear: 1, startingThisYear: 1 });
    expect(portfolioStats(projects, 2027, today)).toEqual({ active: 1, finishedThisYear: 0, startingThisYear: 1 });
  });
});
```

- [ ] **Step 2: Write the failing API test** `server/portfolio.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { buildApp } from './app';
import { openDb } from './db';

const make = (name: string, startDate: string, days: number) => ({
  name, color: '#3b82f6', startDate, phases: [{ name: 'Work', durationDays: days }],
});

async function setup() {
  const app = buildApp(openDb(':memory:'), { today: () => '2026-09-24' });
  for (const body of [
    make('Done 2026', '2026-01-05', 5),
    make('Active', '2026-09-01', 60),
    make('Planned', '2026-11-02', 10),
    make('Old', '2025-03-03', 5),
  ]) {
    await app.inject({ method: 'POST', url: '/api/projects', payload: body });
  }
  return app;
}

describe('GET /api/portfolio', () => {
  it('returns projects overlapping the year with stats', async () => {
    const app = await setup();
    const res = await app.inject({ method: 'GET', url: '/api/portfolio?year=2026' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.year).toBe(2026);
    expect(body.today).toBe('2026-09-24');
    expect(body.projects.map((p: { name: string }) => p.name)).toEqual(['Done 2026', 'Active', 'Planned']);
    expect(body.stats).toEqual({ active: 1, finishedThisYear: 1, startingThisYear: 1 });
  });

  it('defaults to the current year', async () => {
    const app = await setup();
    const body = (await app.inject({ method: 'GET', url: '/api/portfolio' })).json();
    expect(body.year).toBe(2026);
  });

  it('shows other years', async () => {
    const app = await setup();
    const body = (await app.inject({ method: 'GET', url: '/api/portfolio?year=2025' })).json();
    expect(body.projects.map((p: { name: string }) => p.name)).toEqual(['Old']);
  });

  it('rejects a bad year', async () => {
    const app = await setup();
    const res = await app.inject({ method: 'GET', url: '/api/portfolio?year=abc' });
    expect(res.statusCode).toBe(400);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run shared/portfolio.test.ts server/portfolio.test.ts`
Expected: FAIL. `./portfolio` does not resolve, and the portfolio route returns 404.

- [ ] **Step 4: Implement `shared/portfolio.ts`**

```ts
import type { DateRange, ISODate } from './calendar';
import { projectSpan } from './scheduler';

export type ProjectTimeStatus = 'planned' | 'active' | 'done';

export interface PortfolioStats {
  active: number;
  finishedThisYear: number;
  startingThisYear: number;
}

export function projectStatus(span: DateRange, today: ISODate): ProjectTimeStatus {
  if (today < span.start) return 'planned';
  if (today > span.end) return 'done';
  return 'active';
}

export function overlapsYear(span: DateRange, year: number): boolean {
  return span.end >= `${year}-01-01` && span.start <= `${year}-12-31`;
}

function inYear(date: ISODate, year: number): boolean {
  return date.startsWith(`${year}-`);
}

export function portfolioStats(
  projects: { phases: { start: ISODate; end: ISODate }[] }[],
  year: number,
  today: ISODate,
): PortfolioStats {
  const stats: PortfolioStats = { active: 0, finishedThisYear: 0, startingThisYear: 0 };
  for (const project of projects) {
    const span = projectSpan(project.phases);
    if (!span) continue;
    const status = projectStatus(span, today);
    if (status === 'active') stats.active++;
    if (status === 'done' && inYear(span.end, year)) stats.finishedThisYear++;
    if (status === 'planned' && inYear(span.start, year)) stats.startingThisYear++;
  }
  return stats;
}
```

- [ ] **Step 5: Replace `shared/types.ts`**

```ts
import type { ISODate } from './calendar';
import type { PortfolioStats } from './portfolio';

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
  phases: PhaseRecord[];
}

export interface PortfolioResponse {
  year: number;
  today: ISODate;
  stats: PortfolioStats;
  projects: ProjectRecord[];
}
```

- [ ] **Step 6: Replace `server/app.ts`**

```ts
import Fastify from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { todayLocal, type ISODate } from '../shared/calendar';
import { overlapsYear, portfolioStats } from '../shared/portfolio';
import { projectSpan } from '../shared/scheduler';
import { newProjectSchema, toIssues } from '../shared/schemas';
import type { PortfolioResponse } from '../shared/types';
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

- [ ] **Step 7: Run all tests and the type check**

Run: `npm test`
Expected: PASS (all tests).

Run: `npm run typecheck`
Expected: exit code 0.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: portfolio statistics and portfolio API"
```

---

### Task 9: Portfolio presentation page and focus view

**Files:**
- Modify (replace whole file): `client/api.ts`, `client/App.tsx`
- Create: `client/pages/present/PortfolioPage.tsx`, `client/pages/present/PortfolioPage.test.tsx`
- Create: `client/pages/present/FocusPage.tsx`, `client/pages/present/FocusPage.test.tsx`

**Interfaces:**
- Consumes: `PortfolioResponse` (Task 8); `Gantt`, `portfolioRows`, `phaseRows`, `rangeFor`, `useElementWidth` (Task 5); `useAsync`, `mockFetch`, `sampleProject` (Task 6); `projectSpan` (Task 3).
- Produces:
  - `api.getPortfolio(year: number): Promise<PortfolioResponse>`
  - Routes `/present` (query `?year=`) and `/present/projects/:id`
  - Test ids `stat-active`, `stat-finished`, `stat-starting`

- [ ] **Step 1: Write the failing portfolio page test** `client/pages/present/PortfolioPage.test.tsx`

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { mockFetch, sampleProject } from '../../testing/mockFetch';
import { PortfolioPage } from './PortfolioPage';

const response = (year: number) => ({
  body: {
    year,
    today: '2026-09-24',
    stats: { active: 1, finishedThisYear: 2, startingThisYear: 3 },
    projects: year === 2026 ? [sampleProject()] : [],
  },
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/present?year=2026']}>
      <Routes>
        <Route path="/present" element={<PortfolioPage />} />
        <Route path="/present/projects/:id" element={<div>Focus opened</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PortfolioPage', () => {
  it('shows the stakeholder tiles and one row per project', async () => {
    mockFetch({ 'GET /api/portfolio?year=2026': () => response(2026) });
    renderPage();
    expect(await screen.findByTestId('stat-active')).toHaveTextContent('1');
    expect(screen.getByTestId('stat-finished')).toHaveTextContent('2');
    expect(screen.getByTestId('stat-starting')).toHaveTextContent('3');
    expect(screen.getByText('Finished in 2026')).toBeInTheDocument();
    expect(screen.getByTestId('gantt-row-1')).toBeInTheDocument();
    expect(screen.getByTestId('gantt-today')).toBeInTheDocument();
  });

  it('opens a project in focus when its row is clicked', async () => {
    mockFetch({ 'GET /api/portfolio?year=2026': () => response(2026) });
    renderPage();
    await userEvent.click(await screen.findByTestId('gantt-row-1'));
    expect(await screen.findByText('Focus opened')).toBeInTheDocument();
  });

  it('moves between years', async () => {
    const fetchMock = mockFetch({
      'GET /api/portfolio?year=2026': () => response(2026),
      'GET /api/portfolio?year=2025': () => response(2025),
    });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Previous year' }));
    expect(await screen.findByText('No projects in 2025.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/portfolio?year=2025', expect.anything());
  });
});
```

- [ ] **Step 2: Write the failing focus test** `client/pages/present/FocusPage.test.tsx`

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { mockFetch, sampleProject } from '../../testing/mockFetch';
import { FocusPage } from './FocusPage';

describe('FocusPage', () => {
  it('shows one project read-only with its phases', async () => {
    mockFetch({ 'GET /api/projects/1': () => ({ body: sampleProject() }) });
    render(
      <MemoryRouter initialEntries={['/present/projects/1']}>
        <Routes>
          <Route path="/present/projects/:id" element={<FocusPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'Portal' })).toBeInTheDocument();
    expect(screen.getByTestId('gantt-row-11')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Portfolio/ })).toHaveAttribute('href', '/present?year=2026');
    expect(screen.queryByRole('button')).toBeNull();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run client/pages/present`
Expected: FAIL. The files report that they cannot resolve `./PortfolioPage` and `./FocusPage`.

- [ ] **Step 4: Replace `client/api.ts`** (adds `getPortfolio`)

```ts
import type { WorkCalendar } from '../shared/calendar';
import type { NewProjectInput, ValidationIssue } from '../shared/schemas';
import type { PortfolioResponse, ProjectRecord } from '../shared/types';

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
  const res = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? `Request failed (${res.status})`, res.status, body.issues ?? []);
  return body as T;
}

export const api = {
  getCalendar: () => request<WorkCalendar>('/api/settings/calendar'),
  listProjects: () => request<ProjectRecord[]>('/api/projects'),
  getProject: (id: number) => request<ProjectRecord>(`/api/projects/${id}`),
  createProject: (input: NewProjectInput) =>
    request<ProjectRecord>('/api/projects', { method: 'POST', body: JSON.stringify(input) }),
  getPortfolio: (year: number) => request<PortfolioResponse>(`/api/portfolio?year=${year}`),
};
```

- [ ] **Step 5: Implement `client/pages/present/PortfolioPage.tsx`**

```tsx
import { Link, useNavigate, useSearchParams } from 'react-router';
import { api } from '../../api';
import { Gantt } from '../../gantt/Gantt';
import { portfolioRows } from '../../gantt/rows';
import { useElementWidth } from '../../gantt/useElementWidth';
import { useAsync } from '../../useAsync';

export function PortfolioPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const year = Number(params.get('year')) || new Date().getFullYear();
  const portfolio = useAsync(() => api.getPortfolio(year), [year]);
  const [chartRef, chartWidth] = useElementWidth<HTMLDivElement>();

  const goToYear = (y: number) => setParams({ year: String(y) });
  const data = portfolio.data?.year === year ? portfolio.data : undefined;
  const rows = data ? portfolioRows(data.projects) : [];

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <Link to="/" className="crumb">← Start</Link>
          <h1>Project Portfolio</h1>
        </div>
        <div className="year-nav">
          <button type="button" className="button secondary" aria-label="Previous year" onClick={() => goToYear(year - 1)}>‹</button>
          <strong>{year}</strong>
          <button type="button" className="button secondary" aria-label="Next year" onClick={() => goToYear(year + 1)}>›</button>
        </div>
      </div>

      {portfolio.error ? <div className="errors" role="alert">{portfolio.error.message}</div> : null}
      {!data && !portfolio.error ? <p className="muted">Loading…</p> : null}

      {data ? (
        <>
          <div className="stats">
            <div className="stat">
              <div className="stat-value" data-testid="stat-active">{data.stats.active}</div>
              <div className="stat-label">Active now</div>
            </div>
            <div className="stat">
              <div className="stat-value" data-testid="stat-finished">{data.stats.finishedThisYear}</div>
              <div className="stat-label">Finished in {year}</div>
            </div>
            <div className="stat">
              <div className="stat-value" data-testid="stat-starting">{data.stats.startingThisYear}</div>
              <div className="stat-label">Scheduled to start in {year}</div>
            </div>
          </div>

          <section className="card">
            {rows.length === 0 ? (
              <p className="muted">No projects in {year}.</p>
            ) : (
              <div className="chart-scroll" ref={chartRef}>
                <Gantt
                  rows={rows}
                  range={{ start: `${year}-01-01`, end: `${year}-12-31` }}
                  width={chartWidth}
                  today={data.today}
                  onRowClick={(id) => navigate(`/present/projects/${id}`)}
                />
              </div>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
```

- [ ] **Step 6: Implement `client/pages/present/FocusPage.tsx`**

```tsx
import { Link, useParams } from 'react-router';
import { todayLocal } from '../../../shared/calendar';
import { projectSpan } from '../../../shared/scheduler';
import { api } from '../../api';
import { Gantt } from '../../gantt/Gantt';
import { phaseRows, rangeFor } from '../../gantt/rows';
import { useElementWidth } from '../../gantt/useElementWidth';
import { useAsync } from '../../useAsync';

export function FocusPage() {
  const id = Number(useParams().id);
  const project = useAsync(() => api.getProject(id), [id]);
  const [chartRef, chartWidth] = useElementWidth<HTMLDivElement>();
  const today = todayLocal();

  if (project.error) {
    return (
      <main className="page">
        <Link to="/present" className="crumb">← Portfolio</Link>
        <div className="errors" role="alert">{project.error.message}</div>
      </main>
    );
  }
  if (!project.data) return <main className="page"><p className="muted">Loading…</p></main>;

  const p = project.data;
  const span = projectSpan(p.phases);
  const rows = phaseRows(p);
  const backYear = span ? span.start.slice(0, 4) : today.slice(0, 4);

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <Link to={`/present?year=${backYear}`} className="crumb">← Portfolio</Link>
          <h1>{p.name}</h1>
          <p className="muted">{span ? `${span.start} → ${span.end}` : 'No phases yet'}</p>
        </div>
      </div>
      <section className="card">
        <div className="chart-scroll" ref={chartRef}>
          <Gantt rows={rows} range={rangeFor(rows, today)} width={chartWidth} today={today} />
        </div>
      </section>
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
      <Route path="/present" element={<PortfolioPage />} />
      <Route path="/present/projects/:id" element={<FocusPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
```

- [ ] **Step 8: Run all tests and the type check**

Run: `npm test`
Expected: PASS (all tests).

Run: `npm run typecheck`
Expected: exit code 0.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: portfolio presentation page with year Gantt and focus view"
```

---

### Task 10: Demo portfolio seed (completes M2)

**Files:**
- Create: `server/demoData.ts`, `server/demoData.test.ts`, `server/seed.ts`

**Interfaces:**
- Consumes: `NewProjectInput`, `newProjectSchema` (Task 4); `openDb` (Task 4); `getCalendar` (Task 4); `createProject` (Task 4).
- Produces:
  - `DEMO_PROJECTS: NewProjectInput[]`
  - `npm run seed` adds the demo projects to `data/pm.db` only if it is empty. `npm run seed -- --force` adds them anyway.

- [ ] **Step 1: Write the failing test** `server/demoData.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { newProjectSchema } from '../shared/schemas';
import { DEMO_PROJECTS } from './demoData';

describe('DEMO_PROJECTS', () => {
  it('are all valid projects with unique names', () => {
    expect(DEMO_PROJECTS.length).toBeGreaterThanOrEqual(6);
    for (const p of DEMO_PROJECTS) expect(newProjectSchema.safeParse(p).success).toBe(true);
    expect(new Set(DEMO_PROJECTS.map((p) => p.name)).size).toBe(DEMO_PROJECTS.length);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run server/demoData.test.ts`
Expected: FAIL, "Failed to resolve import './demoData'".

- [ ] **Step 3: Implement `server/demoData.ts`**

```ts
import type { NewProjectInput } from '../shared/schemas';

export const DEMO_PROJECTS: NewProjectInput[] = [
  {
    name: 'Legacy Archive Migration', jiraKey: 'PRJ-099', color: '#64748b', startDate: '2025-09-07',
    phases: [
      { name: 'Requirements gathering', durationDays: 10 },
      { name: 'Development', durationDays: 50 },
      { name: 'QA', durationDays: 10 },
      { name: 'Go-live', durationDays: 2 },
    ],
  },
  {
    name: 'Customer Portal Revamp', jiraKey: 'PRJ-101', color: '#2563eb', startDate: '2026-01-11',
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
    phases: [
      { name: 'Requirements gathering', durationDays: 5 },
      { name: 'Development', durationDays: 25 },
      { name: 'QA', durationDays: 8 },
      { name: 'UAT', durationDays: 5 },
    ],
  },
  {
    name: 'E-Services Mobile App', jiraKey: 'PRJ-105', color: '#0891b2', startDate: '2026-10-04',
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
```

- [ ] **Step 4: Implement `server/seed.ts`**

```ts
import { mkdirSync } from 'node:fs';
import { newProjectSchema } from '../shared/schemas';
import { openDb } from './db';
import { DEMO_PROJECTS } from './demoData';
import { createProject } from './projects/repo';
import { getCalendar } from './settings';

mkdirSync('data', { recursive: true });
const db = openDb('data/pm.db');
const { n } = db.prepare('SELECT COUNT(*) AS n FROM projects').get() as unknown as { n: number };

if (n > 0 && !process.argv.includes('--force')) {
  console.log(`The database already has ${n} project(s), so nothing was added.`);
  console.log('Run "npm run seed -- --force" to add the demo projects anyway.');
} else {
  const cal = getCalendar(db);
  for (const project of DEMO_PROJECTS) createProject(db, cal, newProjectSchema.parse(project));
  console.log(`Added ${DEMO_PROJECTS.length} demo projects.`);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS (all tests).

Run: `npm run typecheck`
Expected: exit code 0.

- [ ] **Step 6: Try the seed on a fresh database**

Run: `npm run seed`
Expected: `Added 6 demo projects.` (or the "already has" message if you created projects during the M1 demo).

- [ ] **Step 7: Commit and push**

```bash
git add -A
git commit -m "feat: demo portfolio seed data"
git push
```

### ✅ M2 checkpoint: stop and demo to the user

Run `npm run seed` (if the database is empty) and `npm run dev`. Open http://localhost:5173. The user should be able to:
1. Click **Project Presentation** and see the three tiles: Active now, Finished in 2026, Scheduled to start in 2026.
2. See every 2026 project as one row on a January–December Gantt chart, with phases as segments and a dashed red **today** line. Projects that cross the year boundary are clipped at the edges.
3. Use **‹ ›** to switch years. 2025 shows the Legacy Archive Migration.
4. Click a project row to open its **focus view**, which is read-only, with a link back to the portfolio.
5. Confirm there are no create or edit controls anywhere under Presentation.

**Ask the user for feedback. When M1 and M2 are approved, merge `build/m1-m2` into `main` (with permission), and then write the M3 plan.**
