import { addDays, type DateRange, type ISODate } from '../shared/calendar';
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

/** "5 Oct". */
export function shortDate(d: ISODate): string {
  return `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;
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

/** One line per overbooked week that touches the phase, e.g. "Week of 5 Oct: 150% booked, 100% available". */
export function phaseWarnings(overloads: Map<number, WeekLoad[]>, phase: DateRange): Map<number, string[]> {
  const out = new Map<number, string[]>();
  for (const [resourceId, weeks] of overloads) {
    const lines = weeks
      .filter((w) => w.weekStart <= phase.end && addDays(w.weekStart, 6) >= phase.start)
      .map((w) => {
        const leave = w.leaveDays > 0 ? ` (${w.leaveDays} day${w.leaveDays === 1 ? '' : 's'} of leave)` : '';
        return `Week of ${shortDate(w.weekStart)}: ${Math.round(w.load)}% booked, ${Math.round(w.available)}% available${leave}`;
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
