import type { DateRange, ISODate } from './calendar';
import { projectSpan } from './scheduler';

export type ProjectTimeStatus = 'planned' | 'active' | 'done';

export interface PortfolioStats {
  active: number;
  finishedThisYear: number;
  startingThisYear: number;
}

export function projectStatus(span: DateRange, today: ISODate): ProjectTimeStatus {
  if (today < span.start) return 'planned';
  if (today > span.end) return 'done';
  return 'active';
}

export function overlapsYear(span: DateRange, year: number): boolean {
  return span.end >= `${year}-01-01` && span.start <= `${year}-12-31`;
}

function inYear(date: ISODate, year: number): boolean {
  return date.startsWith(`${year}-`);
}

export function portfolioStats(
  projects: { phases: { start: ISODate; end: ISODate }[] }[],
  year: number,
  today: ISODate,
): PortfolioStats {
  const stats: PortfolioStats = { active: 0, finishedThisYear: 0, startingThisYear: 0 };
  for (const project of projects) {
    const span = projectSpan(project.phases);
    if (!span) continue;
    const status = projectStatus(span, today);
    if (status === 'active') stats.active++;
    if (status === 'done' && inYear(span.end, year)) stats.finishedThisYear++;
    if (status === 'planned' && inYear(span.start, year)) stats.startingThisYear++;
  }
  return stats;
}
