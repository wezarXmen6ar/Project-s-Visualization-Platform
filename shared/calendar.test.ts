import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CALENDAR, addDays, addWorkingDays, countWorkingDays, dayOfWeek, daysBetween,
  isISODate, isWorkingDay, nextWorkingDay, type WorkCalendar,
} from './calendar';

const cal = DEFAULT_CALENDAR; // Sat + Sun weekend
const withHoliday: WorkCalendar = { weekendDays: [0, 6], holidays: [{ start: '2026-09-28', end: '2026-09-29' }] };
const friSat: WorkCalendar = { weekendDays: [5, 6], holidays: [] };

describe('date helpers', () => {
  it('validates ISO dates strictly', () => {
    expect(isISODate('2026-02-28')).toBe(true);
    expect(isISODate('2026-02-30')).toBe(false);
    expect(isISODate('26-2-1')).toBe(false);
  });
  it('adds calendar days across month ends', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
  it('counts days between dates', () => {
    expect(daysBetween('2026-09-24', '2026-10-01')).toBe(7);
  });
  it('knows the weekday', () => {
    expect(dayOfWeek('2026-09-24')).toBe(4); // Thursday
  });
});

describe('working days', () => {
  it('treats weekends and holidays as non-working', () => {
    expect(isWorkingDay('2026-09-24', cal)).toBe(true);
    expect(isWorkingDay('2026-09-26', cal)).toBe(false);
    expect(isWorkingDay('2026-09-27', cal)).toBe(false);
    expect(isWorkingDay('2026-09-28', withHoliday)).toBe(false);
  });
  it('rolls forward to the next working day', () => {
    expect(nextWorkingDay('2026-09-24', cal)).toBe('2026-09-24');
    expect(nextWorkingDay('2026-09-26', cal)).toBe('2026-09-28');
  });
  it('adds working days inclusively', () => {
    expect(addWorkingDays('2026-09-24', 1, cal)).toBe('2026-09-24');
    expect(addWorkingDays('2026-09-24', 3, cal)).toBe('2026-09-28');
    expect(addWorkingDays('2026-09-26', 1, cal)).toBe('2026-09-28');
    expect(addWorkingDays('2026-09-24', 3, withHoliday)).toBe('2026-09-30');
    expect(addWorkingDays('2026-09-24', 2, friSat)).toBe('2026-09-27');
  });
  it('rejects non-positive durations', () => {
    expect(() => addWorkingDays('2026-09-24', 0, cal)).toThrow();
  });
  it('counts working days inclusively', () => {
    expect(countWorkingDays('2026-09-24', '2026-09-30', cal)).toBe(5);
    expect(countWorkingDays('2026-09-30', '2026-09-24', cal)).toBe(0);
  });
  it('refuses a calendar with no working days', () => {
    expect(() => nextWorkingDay('2026-09-24', { weekendDays: [0, 1, 2, 3, 4, 5, 6], holidays: [] })).toThrow();
  });
});
