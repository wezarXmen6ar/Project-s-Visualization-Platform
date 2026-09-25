// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { DayLoad, WeekLoad } from '../../../shared/capacity';
import type { OverloadDecision } from '../../../shared/types';
import { dayLevel, heatLevel, isAccepted, isoWeek } from './heatmap';

const week = (p: Partial<WeekLoad>): WeekLoad => ({
  weekStart: '2026-10-05', workingDays: 5, leaveDays: 0, load: 0, available: 100, overloaded: false, items: [], ...p,
});

const decision = (id: number, decisionKind: OverloadDecision['decision']): OverloadDecision => ({
  id, resourceId: 71, weekStart: '2026-10-05', decision: decisionKind, note: null, date: '2026-10-01',
});

const day = (p: Partial<DayLoad>): DayLoad => ({
  date: '2026-10-12', working: true, onLeave: false, load: 0, available: 100, overloaded: false, items: [], ...p,
});

describe('heatmap', () => {
  it('grades a week by how much of what is available is booked', () => {
    expect(heatLevel(week({ load: 0 }), false)).toBe('none');
    expect(heatLevel(week({ load: 40 }), false)).toBe('low');
    expect(heatLevel(week({ load: 80 }), false)).toBe('mid');
    expect(heatLevel(week({ load: 100 }), false)).toBe('full');
    expect(heatLevel(week({ load: 160, overloaded: true }), false)).toBe('over');
    expect(heatLevel(week({ load: 160, overloaded: true }), true)).toBe('accepted');
  });

  it('marks weeks with no working days, or fully on leave, as not working', () => {
    expect(heatLevel(week({ workingDays: 0, available: 0 }), false)).toBe('off');
    expect(heatLevel(week({ leaveDays: 5, available: 0 }), false)).toBe('off');
  });

  it('counts a week as accepted only when the latest decision about it is to accept', () => {
    expect(isAccepted([decision(1, 'accept')], 71, '2026-10-05')).toBe(true);
    expect(isAccepted([decision(1, 'accept'), decision(2, 'split')], 71, '2026-10-05')).toBe(false);
    expect(isAccepted([decision(1, 'accept')], 72, '2026-10-05')).toBe(false);
    expect(isAccepted([decision(1, 'accept')], 71, '2026-10-12')).toBe(false);
  });

  it('grades a day with the same bands as a week, with leave as not working unless something is booked', () => {
    expect(dayLevel(day({ load: 0 }), false)).toBe('none');
    expect(dayLevel(day({ load: 40 }), false)).toBe('low');
    expect(dayLevel(day({ load: 80 }), false)).toBe('mid');
    expect(dayLevel(day({ load: 100 }), false)).toBe('full');
    expect(dayLevel(day({ load: 150, overloaded: true }), false)).toBe('over');
    expect(dayLevel(day({ load: 150, overloaded: true }), true)).toBe('accepted');
    expect(dayLevel(day({ onLeave: true, available: 0 }), false)).toBe('off');
    expect(dayLevel(day({ onLeave: true, available: 0, load: 50, overloaded: true }), false)).toBe('over');
  });

  it('numbers weeks the ISO-8601 way', () => {
    expect(isoWeek('2026-10-12')).toBe(42);
    expect(isoWeek('2026-10-18')).toBe(42);
    expect(isoWeek('2026-01-01')).toBe(1);
    expect(isoWeek('2027-01-01')).toBe(53);
  });
});
