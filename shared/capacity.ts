import { addDays, countWorkingDays, dayOfWeek, type DateRange, type ISODate, type WorkCalendar } from './calendar';

export interface CapacityResource {
  id: number;
  name: string;
  /** % of a full working week this person can give. */
  capacity: number;
  leave: (DateRange & { note?: string | null })[];
}

export interface CapacityAssignment {
  id: number;
  resourceId: number;
  phaseId: number;
  projectId: number;
  projectName: string;
  phaseName: string;
  start: ISODate;
  end: ISODate;
  /** % of the person's day on this phase. */
  allocation: number;
}

export interface WeekItem {
  assignmentId: number;
  phaseId: number;
  projectId: number;
  projectName: string;
  phaseName: string;
  allocation: number;
  /** Working days of this week the assignment covers. */
  days: number;
}

export interface WeekLoad {
  /** Monday. */
  weekStart: ISODate;
  workingDays: number;
  leaveDays: number;
  /** Work booked this week, as % of a full-time week. */
  load: number;
  /** What the person can give this week, as % of a full-time week: capacity reduced by leave. */
  available: number;
  overloaded: boolean;
  items: WeekItem[];
}

export interface PersonLoad {
  resourceId: number;
  name: string;
  weeks: WeekLoad[];
}

/** Booked may exceed available by this many percentage points before it counts as overbooked (rounding noise). */
export const OVERLOAD_TOLERANCE = 0.5;

/** The Monday on or before the date. */
export function weekStartOf(d: ISODate): ISODate {
  return addDays(d, -((dayOfWeek(d) + 6) % 7));
}

/** The Mondays of every week that touches the range. */
export function weeksCovering(range: DateRange): ISODate[] {
  const weeks: ISODate[] = [];
  for (let w = weekStartOf(range.start); w <= range.end; w = addDays(w, 7)) weeks.push(w);
  return weeks;
}

function overlapWorkingDays(a: DateRange, b: DateRange, cal: WorkCalendar): number {
  const start = a.start > b.start ? a.start : b.start;
  const end = a.end < b.end ? a.end : b.end;
  return start > end ? 0 : countWorkingDays(start, end, cal);
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Weekly load for each person over the range. Booked % = Σ allocation × working days the assignment covers that week
 * ÷ that week's working days. Available % = capacity × (working days − leave days) ÷ working days.
 */
export function computeWorkload(
  resources: CapacityResource[],
  assignments: CapacityAssignment[],
  range: DateRange,
  cal: WorkCalendar,
): PersonLoad[] {
  const weeks = weeksCovering(range);
  return resources.map((person) => {
    const own = assignments.filter((a) => a.resourceId === person.id);
    return {
      resourceId: person.id,
      name: person.name,
      weeks: weeks.map((weekStart): WeekLoad => {
        const week = { start: weekStart, end: addDays(weekStart, 6) };
        const workingDays = countWorkingDays(week.start, week.end, cal);
        const leaveDays = Math.min(workingDays, person.leave.reduce((sum, l) => sum + overlapWorkingDays(week, l, cal), 0));
        const items: WeekItem[] = workingDays === 0 ? [] : own
          .map((a) => ({
            assignmentId: a.id,
            phaseId: a.phaseId,
            projectId: a.projectId,
            projectName: a.projectName,
            phaseName: a.phaseName,
            allocation: a.allocation,
            days: overlapWorkingDays(week, a, cal),
          }))
          .filter((i) => i.days > 0);
        const load = workingDays === 0 ? 0 : items.reduce((sum, i) => sum + (i.allocation * i.days) / workingDays, 0);
        const available = workingDays === 0 ? 0 : (person.capacity * (workingDays - leaveDays)) / workingDays;
        return {
          weekStart,
          workingDays,
          leaveDays,
          load: round1(load),
          available: round1(available),
          overloaded: load > available + OVERLOAD_TOLERANCE,
          items,
        };
      }),
    };
  });
}
