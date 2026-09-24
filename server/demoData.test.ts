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
