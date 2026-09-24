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
