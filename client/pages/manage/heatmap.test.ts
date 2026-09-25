// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { WeekLoad } from '../../../shared/capacity';
import type { OverloadDecision } from '../../../shared/types';
import { heatLevel, isAccepted } from './heatmap';

const week = (p: Partial<WeekLoad>): WeekLoad => ({
  weekStart: '2026-10-05', workingDays: 5, leaveDays: 0, load: 0, available: 100, overloaded: false, items: [], ...p,
});

const decision = (id: number, decisionKind: OverloadDecision['decision']): OverloadDecision => ({
  id, resourceId: 71, weekStart: '2026-10-05', decision: decisionKind, note: null, date: '2026-10-01',
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
});
