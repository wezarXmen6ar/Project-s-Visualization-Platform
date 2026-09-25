import { DEFAULT_CALENDAR, countWorkingDays, type DateRange, type ISODate, type WorkCalendar } from '../../shared/calendar';
import { projectSpan } from '../../shared/scheduler';
import type { AssignmentRecord, ProjectRecord } from '../../shared/types';
import { ASSIGNMENT_ROLE_LABEL, formatDate } from '../pages/manage/labels';
import { subPhaseLabel } from '../todos';
import type { GanttBar, GanttDetail, GanttRow, GanttSegment } from './Gantt';
import { monthPaddedRange } from './scale';

interface PhaseLike {
  id?: number;
  order: number;
  name: string;
  start: ISODate;
  end: ISODate;
  subPhases?: { id?: number; order: number; name: string; start: ISODate; end: ISODate }[];
}

/**
 * A fixed, project-independent colour palette for phase bars, assigned by phase *name* (via phaseColorFor), so e.g.
 * "Development" is the same colour on every project's Gantt chart. 10 OKLCH colours sharing the app's lightness and
 * chroma (L 0.62 C 0.12), hues spread evenly across 95–330° — clear of the red/amber hues used for --danger and
 * --warning (see styles.css).
 */
export const PHASE_PALETTE: string[] = [95, 121, 147, 173, 199, 225, 252, 278, 304, 330].map((h) => `oklch(0.62 0.12 ${h})`);

/**
 * The standard phases in lifecycle order, each with the normalised (trimmed, lower-cased) names it goes by.
 * Consecutive phases take palette slots three apart (0, 3, 6, 9, 2, 5, …), so neighbouring bars get clearly
 * different hues.
 */
const STANDARD_PHASES: string[][] = [
  ['requirements', 'requirements gathering', 'gathering requirements'],
  ['analysis', 'business analysis'],
  ['design'],
  ['development plan'],
  ['development', 'dev'],
  ['qa', 'testing'],
  ['uat', 'user acceptance testing'],
  ['security testing', 'security'],
  ['deployment', 'deploy'],
  ['launch', 'go-live', 'golive'],
];

const KNOWN_PHASE_COLORS: Record<string, string> = Object.fromEntries(
  STANDARD_PHASES.flatMap((names, i) => names.map((name) => [name, PHASE_PALETTE[(i * 3) % PHASE_PALETTE.length]])),
);

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

/**
 * Lanes for sub-phases drawn inside their phase's bar. Each sub-phase, in order, takes the lowest lane (from 0) in
 * which it doesn't overlap a sub-phase already placed there. Two sub-phases overlap when they share at least one day.
 */
export function assignLanes<T extends { start: ISODate; end: ISODate }>(subs: T[]): number[] {
  const lanes: T[][] = [];
  return subs.map((sub) => {
    let lane = lanes.findIndex((placed) => placed.every((o) => sub.end < o.start || sub.start > o.end));
    if (lane === -1) {
      lane = lanes.length;
      lanes.push([]);
    }
    lanes[lane].push(sub);
    return lane;
  });
}

export interface PhaseRowOptions {
  /** The project's assignments. When given, each detail lists the people on exactly that phase or sub-phase. */
  people?: AssignmentRecord[];
  /** The working calendar for the working-day counts. Falls back to `DEFAULT_CALENDAR`. */
  calendar?: WorkCalendar;
}

function pieceDetail(
  title: string,
  piece: { id?: number; start: ISODate; end: ISODate },
  options: PhaseRowOptions,
): GanttDetail {
  const days = countWorkingDays(piece.start, piece.end, options.calendar ?? DEFAULT_CALENDAR);
  const lines = [`${formatDate(piece.start)} – ${formatDate(piece.end)} · ${days} working ${days === 1 ? 'day' : 'days'}`];
  if (options.people && piece.id !== undefined) {
    for (const a of options.people.filter((x) => x.phaseId === piece.id)) {
      lines.push(`${a.resource.name} · ${a.allocation}% · ${ASSIGNMENT_ROLE_LABEL[a.role]}`);
    }
  }
  return { title, lines };
}

/**
 * One row per phase, its bar spanning the phase. Sub-phases in lane 0 (see assignLanes) divide that bar into
 * segments; each further lane in use adds a `lane` row directly under the phase holding that lane's sub-phases.
 */
export function phaseRows(project: { phases: PhaseLike[] }, options: PhaseRowOptions = {}): GanttRow[] {
  return project.phases.flatMap((p) => {
    const id = String(p.id ?? p.order);
    const color = phaseColorFor(p.name);
    const bar: GanttBar = {
      id,
      start: p.start,
      end: p.end,
      color,
      label: p.name,
      title: `${p.name}: ${p.start} → ${p.end}`,
      detail: pieceDetail(p.name, p, options),
    };
    const own: GanttRow = { id, label: p.name, bars: [bar] };
    const subs = p.subPhases ?? [];
    if (subs.length === 0) return [own];

    const lanes = assignLanes(subs);
    const pieces = subs.map((s, i) => {
      const subId = s.id !== undefined ? String(s.id) : `${p.order}-${s.order}`;
      const fullName = subPhaseLabel(p.name, s.name);
      return {
        lane: lanes[i],
        subId,
        s,
        detail: pieceDetail(fullName, s, options),
        title: `${fullName}: ${s.start} → ${s.end}`,
      };
    });

    bar.segments = pieces
      .filter((x) => x.lane === 0)
      .map((x): GanttSegment => ({ id: x.subId, start: x.s.start, end: x.s.end, label: x.s.name, detail: x.detail }));

    const laneCount = Math.max(...lanes) + 1;
    const laneRows: GanttRow[] = [];
    for (let n = 1; n < laneCount; n++) {
      laneRows.push({
        id: `${id}-lane-${n}`,
        label: '',
        kind: 'lane',
        bars: pieces
          .filter((x) => x.lane === n)
          .map((x) => ({ id: x.subId, start: x.s.start, end: x.s.end, color, label: x.s.name, title: x.title, detail: x.detail })),
      });
    }
    return [own, ...laneRows];
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

/**
 * Portfolio rows grouped by main project: each main project gets a group row with a summary bar from its projects'
 * earliest start to latest end, followed by its projects. Groups appear in the order of their first project (the
 * input is sorted by start date). Standalone projects come last.
 */
export function groupedPortfolioRows(projects: ProjectRecord[]): GanttRow[] {
  const groups = new Map<number, { name: string; members: ProjectRecord[] }>();
  const standalone: ProjectRecord[] = [];
  for (const p of projects) {
    if (!p.mainProject) {
      standalone.push(p);
      continue;
    }
    const group = groups.get(p.mainProject.id) ?? { name: p.mainProject.name, members: [] };
    group.members.push(p);
    groups.set(p.mainProject.id, group);
  }

  const rows: GanttRow[] = [];
  for (const [id, { name, members }] of groups) {
    const rowId = `group-${id}`;
    const span = projectSpan(members.flatMap((m) => m.phases));
    rows.push({
      id: rowId,
      label: name,
      kind: 'group',
      // The summary bar's colour comes from the .gantt-summary CSS rule.
      bars: span ? [{ id: rowId, start: span.start, end: span.end, color: 'currentColor', title: `${name}: ${span.start} → ${span.end}` }] : [],
    });
    rows.push(...portfolioRows(members).map((row) => ({ ...row, kind: 'child' as const })));
  }
  return [...rows, ...portfolioRows(standalone)];
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
