import { describe, expect, it } from 'vitest';
import { DEFAULT_CALENDAR } from '../shared/calendar';
import { newProjectSchema } from '../shared/schemas';
import { computeWorkload } from '../shared/capacity';
import { phaseName } from '../client/i18n/listNames';
import { workloadData } from './assignments/repo';
import { openDb } from './db';
import { DEMO_ARABIC_PROJECT, DEMO_PEOPLE, DEMO_PROJECTS, seedDemo, toProjectInput } from './demoData';
import { getLists } from './lists/repo';
import { listProjects } from './projects/repo';
import { getMe } from './settings';
import { listStarters } from './starters/repo';
import { listToDos } from './todos/repo';

describe('DEMO_PROJECTS', () => {
  it('are all valid projects with unique names', () => {
    expect(DEMO_PROJECTS).toHaveLength(7);
    for (const demo of DEMO_PROJECTS) {
      expect(
        newProjectSchema.safeParse(
          toProjectInput(demo, () => 1, (name) => DEMO_PEOPLE.findIndex((p) => p.name === name) + 1),
        ).success,
      ).toBe(true);
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
    expect(projects.find((p) => p.name === 'Customer Portal Revamp')).toMatchObject({
      projectManager: { name: 'Sara Ahmed' },
      businessPm: { name: 'Mariam Al Suwaidi', phone: '+971 50 123 4567', email: 'mariam.alsuwaidi@example.com' },
    });

    // The default project types are reused, not duplicated.
    expect(getLists(db).projectType.map((v) => v.name)).toEqual(['Criminal', 'Customer', 'Management']);

    // Every demo phase is a name from the Phases list, so the phase dropdowns show it.
    const phaseNames = new Set(getLists(db).phase.map((v) => v.name));
    for (const p of projects) for (const ph of p.phases) expect(phaseNames).toContain(ph.name);
    // Legacy Archive Migration still sits entirely in 2025.
    const legacy = projects.find((p) => p.name === 'Legacy Archive Migration')!;
    expect(legacy.phases[legacy.phases.length - 1].end < '2026-01-01').toBe(true);
  });

  it('staffs every demo phase and shows real overbookings and leave around October 2026', () => {
    const db = openDb(':memory:');
    seedDemo(db, DEFAULT_CALENDAR);
    for (const p of listProjects(db)) {
      for (const ph of p.phases) {
        expect(p.assignments.some((a) => a.phaseId === ph.id)).toBe(true);
        for (const sub of ph.subPhases) expect(p.assignments.some((a) => a.phaseId === sub.id)).toBe(true);
      }
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
    // The Arabic project's two to-dos (2027) are checked in their own test; this one covers the M5 demo.
    const english = (t: { projectName: string }) => t.projectName !== DEMO_ARABIC_PROJECT;
    const mine = listToDos(db, { assigneeId: me.resourceId! }).filter(english);
    expect(mine.map((t) => t.title)).toEqual([
      'Send the app store account request to IT',
      'Confirm the requirements workshop dates with Mariam',
      'Check the go-live checklist with operations',
      'Share the release plan with the business',
    ]);
    const all = listToDos(db, { includeDone: true }).filter(english);
    expect(all).toHaveLength(10);
    expect(all.find((t) => t.title.startsWith('Review the payment'))?.phase?.name).toBe('Development › Increment 3 – Payments');
    expect(all.find((t) => t.title === 'Confirm the security testing slot')).toMatchObject({ done: true, doneDate: '2026-09-24' });

    expect(listStarters(db)).toHaveLength(6);
  });

  it('adds one fully Arabic project, and Arabic names for the demo list values', () => {
    const db = openDb(':memory:');
    expect(seedDemo(db, DEFAULT_CALENDAR)).toBe(7);
    const arabic = /[؀-ۿ]/;
    const latinWords = /[A-Za-z]{2,}/;

    const lists = getLists(db);
    for (const list of ['department', 'mainProject', 'goal', 'projectType', 'phase', 'role'] as const) {
      for (const v of lists[list]) expect(v.nameAr, `${list}: ${v.name}`).toMatch(arabic);
    }
    expect(lists.mainProject.find((v) => v.name === 'Digital Services')?.nameAr).toBe('الخدمات الرقمية');
    expect(lists.department.find((v) => v.name === 'Customer Service')?.nameAr).toBe('خدمة المتعاملين');

    expect(DEMO_ARABIC_PROJECT).toBe('بوابة الخدمات الذكية');
    const project = listProjects(db).find((p) => p.name === DEMO_ARABIC_PROJECT)!;
    expect(project).toMatchObject({ startDate: '2027-01-10', mainProject: { nameAr: 'الخدمات الرقمية' } });
    expect(project.background).toMatch(arabic);
    expect(project.summary).toMatch(arabic);
    for (const kind of ['scope', 'out-of-scope', 'problem', 'objective'] as const) {
      expect(project.scopeItems.some((i) => i.kind === kind), kind).toBe(true);
    }
    for (const item of project.scopeItems) expect(item.text).not.toMatch(latinWords);
    expect(project.phases[0].start >= '2027-01-10').toBe(true);
    // Stored under their English names, so they display in Arabic through the Phases list.
    for (const ph of project.phases) expect(phaseName(ph.name, lists, 'ar'), ph.name).toMatch(arabic);

    const todos = listToDos(db, { includeDone: true }).filter((t) => t.projectName === DEMO_ARABIC_PROJECT);
    expect(todos).toHaveLength(2);
    for (const t of todos) {
      expect(t.title).toMatch(arabic);
      expect(t.title).not.toMatch(latinWords);
      expect(t.assignee?.name).toBe('Sara Ahmed');
    }
  });
});
