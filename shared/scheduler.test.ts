import { describe, expect, it } from 'vitest';
import { DEFAULT_CALENDAR } from './calendar';
import { projectSpan, schedulePhases, scheduleSubPhases, subPhaseSpan, type ScheduledSubPhase } from './scheduler';

describe('schedulePhases', () => {
  it('runs phases back to back over working days', () => {
    const result = schedulePhases('2026-09-24', [
      { name: 'Requirements', durationDays: 2 },
      { name: 'Development', durationDays: 3 },
    ], DEFAULT_CALENDAR);
    expect(result).toEqual([
      { name: 'Requirements', durationDays: 2, order: 0, start: '2026-09-24', end: '2026-09-25', subPhases: [] },
      { name: 'Development', durationDays: 3, order: 1, start: '2026-09-28', end: '2026-09-30', subPhases: [] },
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
    expect((dev.subPhases as ScheduledSubPhase[]).map((s) => [s.name, s.start, s.end, s.withPrevious])).toEqual([
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

  it('counts the working days a phase spans because of its sub-phases', () => {
    expect(subPhaseSpan([])).toBe(0);
    expect(subPhaseSpan([{ name: 'A', durationDays: 5 }, { name: 'B', durationDays: 5 }])).toBe(10);
    expect(subPhaseSpan([{ name: 'A', durationDays: 5 }, { name: 'B', durationDays: 3, withPrevious: true }, { name: 'C', durationDays: 2 }])).toBe(7);
    expect(subPhaseSpan([{ name: 'A', durationDays: 2 }, { name: 'B', durationDays: 6, withPrevious: true }])).toBe(6);
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
