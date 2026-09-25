import { addDays, dayOfWeek, type DateRange, type ISODate, type WorkCalendar } from '../shared/calendar';
import { computeWorkload, type CapacityAssignment, type WeekLoad } from '../shared/capacity';
import type { AssignmentRole, WorkloadData } from '../shared/types';

/** An assignment as a form holds it: the person may not be chosen yet. */
export interface DraftAssignment {
  resourceId: number | null;
  allocation: number;
  role: AssignmentRole;
}

/** Work that is about to be booked, with its dates. */
export interface PlannedAssignment {
  resourceId: number;
  start: ISODate;
  end: ISODate;
  allocation: number;
  projectName: string;
  phaseName: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** A leave range as the workload carries it, with its optional note. */
export interface LeaveRange extends DateRange {
  note?: string | null;
}

/** The days of the Monday-to-Sunday week starting `weekStart` that are not weekend days (holidays included). */
function weekdaysOf(weekStart: ISODate, cal: WorkCalendar): ISODate[] {
  const days: ISODate[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i);
    if (!cal.weekendDays.includes(dayOfWeek(d))) days.push(d);
  }
  return days;
}

/** "Mon 12 Oct". */
export function dayDate(d: ISODate): string {
  return `${DAYS[dayOfWeek(d)]} ${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;
}

/**
 * The first and last day of the Monday-to-Sunday week starting `weekStart` that are not weekend days, e.g.
 * "Mon 12 Oct – Fri 16 Oct". Holidays are ignored, so a holiday Monday does not shift the label. Falls back to
 * `dayDate(weekStart)` when every day of the week is a weekend day.
 */
export function weekLabel(weekStart: ISODate, cal: WorkCalendar): string {
  const workingDays = weekdaysOf(weekStart, cal);
  if (workingDays.length === 0) return dayDate(weekStart);
  return `${dayDate(workingDays[0])} – ${dayDate(workingDays[workingDays.length - 1])}`;
}

/** "12–16 Oct" within a month, "28 Sep – 2 Oct" across months, or "12 Oct" for a single day. */
export function dayRangeLabel(first: ISODate, last: ISODate): string {
  const day = (d: ISODate) => Number(d.slice(8, 10));
  const month = (d: ISODate) => MONTHS[Number(d.slice(5, 7)) - 1];
  if (first === last) return `${day(first)} ${month(first)}`;
  if (first.slice(0, 7) === last.slice(0, 7)) return `${day(first)}–${day(last)} ${month(last)}`;
  return `${day(first)} ${month(first)} – ${day(last)} ${month(last)}`;
}

/** The short form of `weekLabel`, e.g. "12–16 Oct": the first and last day of the week that are not weekend days. */
export function shortWeekLabel(weekStart: ISODate, cal: WorkCalendar): string {
  const days = weekdaysOf(weekStart, cal);
  return days.length === 0 ? dayRangeLabel(weekStart, weekStart) : dayRangeLabel(days[0], days[days.length - 1]);
}

/** The person's leave ranges that overlap the Monday-to-Sunday week starting `weekStart`, each clipped to the week. */
export function leaveInWeek(leave: LeaveRange[], weekStart: ISODate): LeaveRange[] {
  const weekEnd = addDays(weekStart, 6);
  const out: LeaveRange[] = [];
  for (const l of leave) {
    const start = l.start > weekStart ? l.start : weekStart;
    const end = l.end < weekEnd ? l.end : weekEnd;
    if (start <= end) out.push({ start, end, note: l.note });
  }
  return out;
}

/** Each working weekday of the Monday-to-Sunday week starting `weekStart`, with whether the person is on leave that day. */
export function leaveDaysInWeek(leave: LeaveRange[], weekStart: ISODate, cal: WorkCalendar): { date: ISODate; onLeave: boolean }[] {
  return weekdaysOf(weekStart, cal).map((d) => ({ date: d, onLeave: leave.some((l) => d >= l.start && d <= l.end) }));
}

/**
 * The weeks each person would be overbooked in if `planned` were added to the saved workload, with the saved
 * assignments whose ids are in `replacing` taken out (they are being edited). Only people in `planned` are checked.
 */
export function overloadsWith(data: WorkloadData, planned: PlannedAssignment[], replacing: number[] = []): Map<number, WeekLoad[]> {
  const result = new Map<number, WeekLoad[]>();
  if (planned.length === 0) return result;
  const range: DateRange = {
    start: planned.reduce((min, p) => (p.start < min ? p.start : min), planned[0].start),
    end: planned.reduce((max, p) => (p.end > max ? p.end : max), planned[0].end),
  };
  const extra: CapacityAssignment[] = planned.map((p, i) => ({
    id: -(i + 1),
    resourceId: p.resourceId,
    phaseId: -1,
    projectId: -1,
    projectName: p.projectName,
    phaseName: p.phaseName,
    start: p.start,
    end: p.end,
    allocation: p.allocation,
  }));
  const kept = data.assignments.filter((a) => !replacing.includes(a.id));
  const people = data.resources.filter((r) => planned.some((p) => p.resourceId === r.id));
  for (const load of computeWorkload(people, [...kept, ...extra], range, data.calendar)) {
    const weeks = load.weeks.filter((w) => w.overloaded);
    if (weeks.length > 0) result.set(load.resourceId, weeks);
  }
  return result;
}

/** One line per overbooked week that touches the phase, e.g. "Mon 5 Oct – Fri 9 Oct: 150% booked, 100% available". */
export function phaseWarnings(overloads: Map<number, WeekLoad[]>, phase: DateRange, cal: WorkCalendar): Map<number, string[]> {
  const out = new Map<number, string[]>();
  for (const [resourceId, weeks] of overloads) {
    const lines = weeks
      .filter((w) => w.weekStart <= phase.end && addDays(w.weekStart, 6) >= phase.start)
      .map((w) => {
        const leave = w.leaveDays > 0 ? ` (${w.leaveDays} day${w.leaveDays === 1 ? '' : 's'} of leave)` : '';
        return `${weekLabel(w.weekStart, cal)}: ${Math.round(w.load)}% booked, ${Math.round(w.available)}% available${leave}`;
      });
    if (lines.length > 0) out.set(resourceId, lines);
  }
  return out;
}

/** Draft rows that have a person and a number, as planned work over the given dates. */
export function plannedFrom(drafts: DraftAssignment[], dates: DateRange, projectName: string, phaseName: string): PlannedAssignment[] {
  return drafts.flatMap((a) =>
    a.resourceId === null || !Number.isFinite(a.allocation)
      ? []
      : [{ resourceId: a.resourceId, start: dates.start, end: dates.end, allocation: a.allocation, projectName, phaseName }],
  );
}
