// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { DEFAULT_CALENDAR } from '../shared/calendar';
import {
  dayDate, dayRangeLabel, leaveDaysInWeek, leaveInWeek, overloadsWith, phaseWarnings, shortWeekLabel, weekLabel,
} from './overloads';
import { sampleWorkload } from './testing/mockFetch';

const fatimaAt = (allocation: number, start = '2026-10-05', end = '2026-10-16') =>
  ({ resourceId: 71, start, end, allocation, projectName: 'Portal', phaseName: 'Requirements' });

describe('overloads', () => {
  it('writes short date ranges, naming the month once when it does not change', () => {
    expect(dayRangeLabel('2026-10-12', '2026-10-16')).toBe('12–16 Oct');
    expect(dayRangeLabel('2026-09-28', '2026-10-02')).toBe('28 Sep – 2 Oct');
    expect(dayRangeLabel('2026-10-12', '2026-10-12')).toBe('12 Oct');
    expect(shortWeekLabel('2026-10-12', DEFAULT_CALENDAR)).toBe('12–16 Oct');
    expect(shortWeekLabel('2026-09-28', DEFAULT_CALENDAR)).toBe('28 Sep – 2 Oct');
  });

  it('writes weekday dates', () => {
    expect(dayDate('2026-10-05')).toBe('Mon 5 Oct');
    expect(dayDate('2026-12-31')).toBe('Thu 31 Dec');
  });

  it('labels a week by its working days', () => {
    expect(weekLabel('2026-10-12', DEFAULT_CALENDAR)).toBe('Mon 12 Oct – Fri 16 Oct');
    expect(weekLabel('2026-09-28', DEFAULT_CALENDAR)).toBe('Mon 28 Sep – Fri 2 Oct');
  });

  it('labels a week by a different calendar’s working days', () => {
    const cal = { weekendDays: [5, 6], holidays: [] };
    expect(weekLabel('2026-10-12', cal)).toBe('Mon 12 Oct – Sun 18 Oct');
  });

  it('falls back to a single date when the whole week is weekend', () => {
    const cal = { weekendDays: [0, 1, 2, 3, 4, 5, 6], holidays: [] };
    expect(weekLabel('2026-10-12', cal)).toBe(dayDate('2026-10-12'));
  });

  it('clips leave that runs past the week', () => {
    const leave = [{ start: '2026-10-14', end: '2026-10-20', note: 'Annual leave' }];
    expect(leaveInWeek(leave, '2026-10-12')).toEqual([{ start: '2026-10-14', end: '2026-10-18', note: 'Annual leave' }]);
  });

  it('drops leave ranges that do not overlap the week', () => {
    const leave = [{ start: '2026-10-01', end: '2026-10-02' }];
    expect(leaveInWeek(leave, '2026-10-12')).toEqual([]);
  });

  it('gives each working weekday of the week leave status', () => {
    expect(leaveDaysInWeek([{ start: '2026-10-19', end: '2026-10-21' }], '2026-10-19', DEFAULT_CALENDAR)).toEqual([
      { date: '2026-10-19', onLeave: true },
      { date: '2026-10-20', onLeave: true },
      { date: '2026-10-21', onLeave: true },
      { date: '2026-10-22', onLeave: false },
      { date: '2026-10-23', onLeave: false },
    ]);
  });

  it('does not add a slice for leave ending on a Sunday', () => {
    // 2026-10-25 is a Sunday, a weekend day under the default calendar, so it never gets a slice.
    const days = leaveDaysInWeek([{ start: '2026-10-23', end: '2026-10-25' }], '2026-10-19', DEFAULT_CALENDAR);
    expect(days).toHaveLength(5);
    expect(days.map((d) => d.onLeave)).toEqual([false, false, false, false, true]);
  });

  it('adds planned work to what is already booked and keeps only the overbooked weeks', () => {
    // Fatima is already 100% on HR QA until 9 Oct.
    const overloads = overloadsWith(sampleWorkload(), [fatimaAt(50)]);
    expect([...overloads.keys()]).toEqual([71]);
    expect(overloads.get(71)!.map((w) => [w.weekStart, w.load])).toEqual([['2026-10-05', 150]]);
  });

  it('leaves out saved assignments that are being replaced', () => {
    expect(overloadsWith(sampleWorkload(), [fatimaAt(50)], [500]).size).toBe(0);
  });

  it('checks nothing when nothing is planned', () => {
    expect(overloadsWith(sampleWorkload(), []).size).toBe(0);
  });

  it("writes one line per overbooked week that touches the phase, mentioning leave", () => {
    const data = sampleWorkload();
    // Rami: 60% on Case Management until 16 Oct, capacity 80, on leave 19–20 Oct.
    const rami = { resourceId: 72, start: '2026-10-05', end: '2026-10-23', allocation: 40, projectName: 'Portal', phaseName: 'Dev' };
    const overloads = overloadsWith(data, [rami]);
    expect(phaseWarnings(overloads, { start: '2026-10-05', end: '2026-10-23' }, data.calendar).get(72)).toEqual([
      'Mon 5 Oct – Fri 9 Oct: 100% booked, 80% available',
      'Mon 12 Oct – Fri 16 Oct: 100% booked, 80% available',
    ]);
    const heavy = overloadsWith(data, [{ ...rami, allocation: 80 }]);
    expect(phaseWarnings(heavy, { start: '2026-10-19', end: '2026-10-23' }, data.calendar).get(72)).toEqual([
      'Mon 19 Oct – Fri 23 Oct: 80% booked, 48% available (2 days of leave)',
    ]);
  });
});
