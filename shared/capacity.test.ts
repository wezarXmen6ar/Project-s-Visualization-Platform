import { describe, expect, it } from 'vitest';
import { DEFAULT_CALENDAR } from './calendar';
import { computeWorkload, weekStartOf, weeksCovering, type CapacityAssignment, type CapacityResource } from './capacity';

const fatima: CapacityResource = { id: 1, name: 'Fatima', capacity: 100, leave: [] };

let nextId = 1;
function assign(p: Partial<CapacityAssignment> & Pick<CapacityAssignment, 'start' | 'end' | 'allocation'>): CapacityAssignment {
  return { id: nextId++, resourceId: 1, phaseId: 10, projectId: 100, projectName: 'Portal', phaseName: 'Development', ...p };
}

// 2026-10-05 is a Monday; 2026-10-10/11 are the weekend.
const oneWeek = { start: '2026-10-05', end: '2026-10-11' };
const weekOf = (resources: CapacityResource[], assignments: CapacityAssignment[], cal = DEFAULT_CALENDAR) =>
  computeWorkload(resources, assignments, oneWeek, cal)[0].weeks[0];

describe('weeks', () => {
  it('starts every week on the Monday on or before a date', () => {
    expect(weekStartOf('2026-10-05')).toBe('2026-10-05');
    expect(weekStartOf('2026-10-08')).toBe('2026-10-05');
    expect(weekStartOf('2026-10-11')).toBe('2026-10-05');
    expect(weekStartOf('2026-10-12')).toBe('2026-10-12');
  });

  it('lists the Mondays covering a range', () => {
    expect(weeksCovering({ start: '2026-10-07', end: '2026-10-19' })).toEqual(['2026-10-05', '2026-10-12', '2026-10-19']);
  });
});

describe('computeWorkload', () => {
  it('counts a full week at 100% as fully booked, not overbooked', () => {
    const w = weekOf([fatima], [assign({ start: '2026-10-05', end: '2026-10-09', allocation: 100 })]);
    expect(w).toMatchObject({ weekStart: '2026-10-05', workingDays: 5, leaveDays: 0, load: 100, available: 100, overloaded: false });
    expect(w.items).toEqual([expect.objectContaining({ projectName: 'Portal', phaseName: 'Development', allocation: 100, days: 5 })]);
  });

  it('adds up overlapping assignments and flags the overbooking', () => {
    const w = weekOf([fatima], [
      assign({ start: '2026-10-05', end: '2026-10-09', allocation: 60 }),
      assign({ start: '2026-09-28', end: '2026-10-16', allocation: 60, projectName: 'HR', phaseName: 'QA' }),
    ]);
    expect(w).toMatchObject({ load: 120, available: 100, overloaded: true });
    expect(w.items).toHaveLength(2);
  });

  it('weights a phase that covers only part of the week', () => {
    // Wednesday to Friday = 3 of 5 working days.
    expect(weekOf([fatima], [assign({ start: '2026-10-07', end: '2026-10-16', allocation: 100 })]).load).toBe(60);
  });

  it("uses the person's capacity", () => {
    const rami = { ...fatima, capacity: 80 };
    expect(weekOf([rami], [assign({ start: '2026-10-05', end: '2026-10-09', allocation: 100 })])).toMatchObject({
      load: 100, available: 80, overloaded: true,
    });
  });

  it('takes leave out of what the person can give, so work during leave is an overbooking', () => {
    const onLeave = { ...fatima, leave: [{ start: '2026-10-05', end: '2026-10-06' }] };
    expect(weekOf([onLeave], [])).toMatchObject({ leaveDays: 2, load: 0, available: 60, overloaded: false });
    expect(weekOf([onLeave], [assign({ start: '2026-10-05', end: '2026-10-09', allocation: 100 })])).toMatchObject({
      load: 100, available: 60, overloaded: true,
    });
  });

  it('ignores holidays and weekends when counting days', () => {
    const cal = { weekendDays: [0, 6], holidays: [{ start: '2026-10-05', end: '2026-10-05' }] };
    expect(weekOf([fatima], [assign({ start: '2026-10-05', end: '2026-10-11', allocation: 100 })], cal)).toMatchObject({
      workingDays: 4, load: 100, available: 100, overloaded: false,
    });
  });

  it('shows a week with no working days as empty', () => {
    const cal = { weekendDays: [0, 6], holidays: [{ start: '2026-10-05', end: '2026-10-09' }] };
    expect(weekOf([fatima], [assign({ start: '2026-10-05', end: '2026-10-09', allocation: 100 })], cal)).toMatchObject({
      workingDays: 0, load: 0, available: 0, overloaded: false, items: [],
    });
  });

  it('does not flag rounding noise', () => {
    const w = weekOf([fatima], [34, 33, 33.4].map((allocation) => assign({ start: '2026-10-05', end: '2026-10-09', allocation })));
    expect(w.overloaded).toBe(false);
  });

  it("only counts each person's own assignments, and keeps the order of the people given", () => {
    const rami: CapacityResource = { id: 2, name: 'Rami', capacity: 100, leave: [] };
    const loads = computeWorkload([rami, fatima], [assign({ start: '2026-10-05', end: '2026-10-09', allocation: 50 })], oneWeek, DEFAULT_CALENDAR);
    expect(loads.map((l) => [l.name, l.weeks[0].load])).toEqual([['Rami', 0], ['Fatima', 50]]);
  });
});
