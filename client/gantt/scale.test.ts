// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { DEFAULT_CALENDAR } from '../../shared/calendar';
import { createTimeScale, monthPaddedRange, workWeekEnds } from './scale';

describe('createTimeScale', () => {
  it('maps dates linearly to pixels', () => {
    const s = createTimeScale('2026-01-01', '2026-01-10', 100);
    expect(s.dayWidth).toBe(10);
    expect(s.x('2026-01-01')).toBe(0);
    expect(s.x('2026-01-06')).toBe(50);
  });
  it('puts a tick on each month start, labelled with the month only, never a year', () => {
    const s = createTimeScale('2026-11-01', '2027-02-28', 1200);
    expect(s.ticks.map((t) => t.label)).toEqual(['Nov', 'Dec', 'Jan', 'Feb']);
  });
  it('skips a month start before the range', () => {
    const s = createTimeScale('2026-01-15', '2026-03-10', 500);
    expect(s.ticks.map((t) => t.date)).toEqual(['2026-02-01', '2026-03-01']);
  });
  it('labels ticks with the month only, and gives a year row', () => {
    const scale = createTimeScale('2025-09-01', '2026-03-31', 700);
    expect(scale.ticks.map((t) => t.label)).toEqual(['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']);
    expect(scale.years).toEqual([
      { year: '2025', x: 0 },
      { year: '2026', x: scale.x('2026-01-01') },
    ]);
  });
  it('gives a single year entry when the range does not cross a new year', () => {
    const scale = createTimeScale('2026-01-01', '2026-06-30', 400);
    expect(scale.years).toEqual([{ year: '2026', x: 0 }]);
  });
});

describe('monthPaddedRange', () => {
  it('pads to whole months', () => {
    expect(monthPaddedRange('2026-02-10', '2026-04-03')).toEqual({ start: '2026-02-01', end: '2026-04-30' });
    expect(monthPaddedRange('2026-12-05', '2026-12-20')).toEqual({ start: '2026-12-01', end: '2026-12-31' });
  });
});

describe('workWeekEnds', () => {
  it('marks each work week by its Friday with the default calendar', () => {
    expect(workWeekEnds({ start: '2026-10-01', end: '2026-10-31' }, DEFAULT_CALENDAR)).toEqual([
      '2026-10-02', '2026-10-09', '2026-10-16', '2026-10-23', '2026-10-30',
    ]);
  });

  it('marks each work week by its Thursday with a Friday/Saturday weekend', () => {
    const cal = { weekendDays: [5, 6], holidays: [] };
    expect(workWeekEnds({ start: '2026-10-01', end: '2026-10-31' }, cal)).toEqual([
      '2026-10-01', '2026-10-08', '2026-10-15', '2026-10-22', '2026-10-29',
    ]);
  });
});
