import { addDays, addWorkingDays, countWorkingDays, nextWorkingDay, type DateRange, type ISODate, type WorkCalendar } from './calendar';

export interface SubPhaseInput {
  name: string;
  durationDays: number;
  /** Start on the same day as the sub-phase directly above. Ignored on the first sub-phase. */
  withPrevious?: boolean;
}

export interface PhaseInput {
  name: string;
  durationDays: number;
  /** When present and not empty, the phase's dates come from these. */
  subPhases?: SubPhaseInput[];
}

export interface ScheduledSubPhase extends SubPhaseInput {
  order: number;
  start: ISODate;
  end: ISODate;
  withPrevious: boolean;
}

export interface ScheduledPhase extends PhaseInput {
  order: number;
  start: ISODate;
  end: ISODate;
  subPhases: ScheduledSubPhase[];
}

/**
 * Sub-phases inside a phase that starts on `phaseStart`. The first starts with the phase. A sub-phase marked
 * withPrevious starts with the one directly above; any other starts after every earlier sub-phase has ended.
 */
export function scheduleSubPhases<S extends SubPhaseInput>(phaseStart: ISODate, subs: S[], cal: WorkCalendar): (S & ScheduledSubPhase)[] {
  const result: (S & ScheduledSubPhase)[] = [];
  let latestEnd: ISODate | null = null;
  subs.forEach((sub, index) => {
    const withPrevious = index > 0 && sub.withPrevious === true;
    const start = withPrevious
      ? result[index - 1].start
      : latestEnd === null
        ? nextWorkingDay(phaseStart, cal)
        : nextWorkingDay(addDays(latestEnd, 1), cal);
    const end = addWorkingDays(start, sub.durationDays, cal);
    result.push({ ...sub, order: index, start, end, withPrevious });
    if (latestEnd === null || end > latestEnd) latestEnd = end;
  });
  return result;
}

export function schedulePhases<P extends PhaseInput>(projectStart: ISODate, phases: P[], cal: WorkCalendar): (P & ScheduledPhase)[] {
  const result: (P & ScheduledPhase)[] = [];
  let cursor = projectStart;
  phases.forEach((phase, index) => {
    const start = nextWorkingDay(cursor, cal);
    const subPhases = scheduleSubPhases(start, phase.subPhases ?? [], cal);
    let end: ISODate;
    let durationDays = phase.durationDays;
    if (subPhases.length === 0) {
      end = addWorkingDays(start, phase.durationDays, cal);
    } else {
      end = subPhases.reduce((latest, s) => (s.end > latest ? s.end : latest), subPhases[0].end);
      durationDays = countWorkingDays(start, end, cal);
    }
    result.push({ ...phase, order: index, start, end, durationDays, subPhases } as P & ScheduledPhase);
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
