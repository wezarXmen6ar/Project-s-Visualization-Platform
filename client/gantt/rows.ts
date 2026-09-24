import type { DateRange, ISODate } from '../../shared/calendar';
import type { ProjectRecord } from '../../shared/types';
import type { GanttRow } from './Gantt';
import { monthPaddedRange } from './scale';

interface PhaseLike {
  id?: number;
  order: number;
  name: string;
  start: ISODate;
  end: ISODate;
}

export function phaseRows(project: { color: string; phases: PhaseLike[] }): GanttRow[] {
  return project.phases.map((p) => {
    const id = String(p.id ?? p.order);
    return {
      id,
      label: p.name,
      bars: [{ id, start: p.start, end: p.end, color: project.color, title: `${p.name}: ${p.start} → ${p.end}` }],
    };
  });
}

export function portfolioRows(projects: ProjectRecord[]): GanttRow[] {
  return projects.map((p) => ({
    id: String(p.id),
    label: p.name,
    bars: p.phases.map((ph) => ({
      id: `${p.id}-${ph.id}`,
      start: ph.start,
      end: ph.end,
      color: p.color,
      label: ph.name,
      title: `${p.name} · ${ph.name}: ${ph.start} → ${ph.end}`,
    })),
  }));
}

export function rangeFor(rows: GanttRow[], fallback: ISODate): DateRange {
  const bars = rows.flatMap((r) => r.bars);
  if (bars.length === 0) return monthPaddedRange(fallback, fallback);
  let start = bars[0].start;
  let end = bars[0].end;
  for (const b of bars) {
    if (b.start < start) start = b.start;
    if (b.end > end) end = b.end;
  }
  return monthPaddedRange(start, end);
}
