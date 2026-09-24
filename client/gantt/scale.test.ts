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
