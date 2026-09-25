import { describe, expect, it } from 'vitest';
import { DEFAULT_CALENDAR } from '../shared/calendar';
import { newProjectSchema } from '../shared/schemas';
import { computeWorkload } from '../shared/capacity';
import { workloadData } from './assignments/repo';
import { openDb } from './db';
import { DEMO_PEOPLE, DEMO_PROJECTS, seedDemo, toProjectInput } from './demoData';
import { getLists } from './lists/repo';
import { listProjects } from './projects/repo';

describe('DEMO_PROJECTS', () => {
  it('are all valid projects with unique names', () => {
    expect(DEMO_PROJECTS.length).toBeGreaterThanOrEqual(6);
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
});
