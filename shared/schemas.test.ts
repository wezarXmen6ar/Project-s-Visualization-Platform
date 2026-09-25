import { describe, expect, it } from 'vitest';
import { newProjectSchema, normalizeUaeMobile, toIssues } from './schemas';

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
      { path: 'name', message: 'Project name is required', code: 'validation.projectNameRequired' },
      { path: 'startDate', message: 'Must be a valid date (YYYY-MM-DD)', code: 'validation.invalidDate' },
      { path: 'phases.0.durationDays', message: 'Duration must be at least 1 working day', code: 'validation.durationMin' },
    ]));
  });
  it('requires at least one phase', () => {
    const result = newProjectSchema.safeParse({ ...valid, phases: [] });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(toIssues(result.error)).toContainEqual(
      { path: 'phases', message: 'Add at least one phase', code: 'validation.addAtLeastOnePhase' },
    );
  });
});

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
