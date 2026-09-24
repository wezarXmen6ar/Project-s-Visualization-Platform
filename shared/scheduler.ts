import { addDays, addWorkingDays, nextWorkingDay, type DateRange, type ISODate, type WorkCalendar } from './calendar';

export interface PhaseInput {
  name: string;
  durationDays: number;
}

export interface ScheduledPhase extends PhaseInput {
  order: number;
  start: ISODate;
  end: ISODate;
}

export function schedulePhases(projectStart: ISODate, phases: PhaseInput[], cal: WorkCalendar): ScheduledPhase[] {
  const result: ScheduledPhase[] = [];
  let cursor = projectStart;
  phases.forEach((phase, index) => {
    const start = nextWorkingDay(cursor, cal);
    const end = addWorkingDays(start, phase.durationDays, cal);
    result.push({ ...phase, order: index, start, end });
    cursor = addDays(end, 1);
  });
  return result;
}

export function projectSpan(phases: { start: ISODate; end: ISODate }[]): DateRange | null {
  if (phases.length === 0) return null;
  let start = phases[0].start;
  let end = phases[0].end;
  for (const p of phases) {
    if (p.start < start) start = p.start;
    if (p.end > end) end = p.end;
  }
  return { start, end };
}
