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
