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
