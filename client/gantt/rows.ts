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

/**
 * A fixed, project-independent colour palette for phase bars. Colours are
 * assigned by phase *name* (via phaseColorFor), not by project or slot
 * position, so e.g. "Development" renders the same colour on every
 * project's Gantt chart. 8 OKLCH colours sharing the app's lightness/chroma
 * token (L 0.62 C 0.12), hues spread across 95-330deg - clear of the
 * red/amber hues already used for --danger/--warning (see styles.css).
 */
export const PHASE_PALETTE: string[] = [
  'oklch(0.62 0.12 95)',
  'oklch(0.62 0.12 129)',
  'oklch(0.62 0.12 162)',
  'oklch(0.62 0.12 196)',
  'oklch(0.62 0.12 229)',
  'oklch(0.62 0.12 263)',
  'oklch(0.62 0.12 296)',
  'oklch(0.62 0.12 330)',
];

// Normalised (trimmed, lower-cased) common phase names mapped one-to-one
// onto PHASE_PALETTE, in typical lifecycle order, plus a short alias list
// for obvious variants (e.g. the wording CreateProjectPage's default phases
// use).
const KNOWN_PHASE_COLORS: Record<string, string> = {
  requirements: PHASE_PALETTE[0],
  'gathering requirements': PHASE_PALETTE[0],
  'requirements gathering': PHASE_PALETTE[0],
  analysis: PHASE_PALETTE[1],
  'business analysis': PHASE_PALETTE[1],
  design: PHASE_PALETTE[2],
  development: PHASE_PALETTE[3],
  dev: PHASE_PALETTE[3],
  testing: PHASE_PALETTE[4],
  qa: PHASE_PALETTE[4],
  uat: PHASE_PALETTE[5],
  'user acceptance testing': PHASE_PALETTE[5],
  'security testing': PHASE_PALETTE[6],
  security: PHASE_PALETTE[6],
  deployment: PHASE_PALETTE[7],
  'go-live': PHASE_PALETTE[7],
  golive: PHASE_PALETTE[7],
  deploy: PHASE_PALETTE[7],
};

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

/**
 * The shared palette colour for a phase name. A known lifecycle name (or
 * alias) maps onto its fixed palette slot; any other name deterministically
 * hashes to a slot, so a custom phase name still always gets the same
 * colour on every project without a persisted registry.
 */
export function phaseColorFor(name: string): string {
  const normalized = name.trim().toLowerCase();
  const known = KNOWN_PHASE_COLORS[normalized];
  if (known) return known;
  return PHASE_PALETTE[hashString(normalized) % PHASE_PALETTE.length];
}

export function phaseRows(project: { phases: PhaseLike[] }): GanttRow[] {
  return project.phases.map((p) => {
    const id = String(p.id ?? p.order);
    return {
      id,
      label: p.name,
      bars: [{ id, start: p.start, end: p.end, color: phaseColorFor(p.name), label: p.name, title: `${p.name}: ${p.start} → ${p.end}` }],
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
      color: phaseColorFor(ph.name),
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
