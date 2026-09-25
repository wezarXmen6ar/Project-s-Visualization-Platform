import { DEFAULT_CALENDAR, type DateRange, type ISODate, type WorkCalendar } from '../../shared/calendar';
import { formatBarDates } from './barDates';
import { createTimeScale, workWeekEnds } from './scale';

export interface GanttBar {
  id: string;
  start: ISODate;
  end: ISODate;
  color: string;
  label?: string;
  title?: string;
}

export interface GanttRow {
  id: string;
  label: string;
  bars: GanttBar[];
  /** 'group': a heading row with a summary bar that is never clickable. 'child': a row under a group (indented label). */
  kind?: 'group' | 'child';
}

export interface GanttProps {
  rows: GanttRow[];
  range: DateRange;
  width: number;
  today?: ISODate;
  onRowClick?: (rowId: string) => void;
  /** The working calendar, used to place work-week lines when `detail="weeks"`. Falls back to `DEFAULT_CALENDAR`. */
  calendar?: WorkCalendar;
  /** 'weeks' adds a third header row with work-week day numbers and faint week lines. Default 'months'. */
  detail?: 'months' | 'weeks';
  /** Shows a small muted dates label beside each bar. Default false. */
  showDates?: boolean;
}

const LABEL_W = 200;
const HEADER_ROW_H = 16;
const ROW_H = 36;
const BAR_H = 20;
const SUMMARY_H = 8;
const APPROX_CHAR_W = 6.5;
const DATE_LABEL_GAP = 6;

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

interface BarPlacement {
  bar: GanttBar;
  isGroup: boolean;
  x: number;
  w: number;
  y: number;
  barH: number;
}

/** Where a bar's dates label fits without covering another bar in the row, or null when it fits nowhere. */
function placeDateLabel(
  placement: BarPlacement,
  others: BarPlacement[],
  chartRightEdge: number,
): { x: number; anchor: 'start' | 'end' } | null {
  const label = formatBarDates(placement.bar.start, placement.bar.end);
  const approxWidth = label.length * APPROX_CHAR_W;

  const overlapsOther = (labelStart: number, labelEnd: number) =>
    others.some((o) => o !== placement && labelStart < o.x + o.w && labelEnd > o.x);

  const afterX = placement.x + placement.w + DATE_LABEL_GAP;
  if (afterX + approxWidth <= chartRightEdge && !overlapsOther(afterX, afterX + approxWidth)) {
    return { x: afterX, anchor: 'start' };
  }

  const beforeEnd = placement.x - DATE_LABEL_GAP;
  const beforeStart = beforeEnd - approxWidth;
  if (beforeStart >= LABEL_W && !overlapsOther(beforeStart, beforeEnd)) {
    return { x: beforeEnd, anchor: 'end' };
  }

  return null;
}

export function Gantt({ rows, range, width, today, onRowClick, calendar, detail = 'months', showDates = false }: GanttProps) {
  const cal = calendar ?? DEFAULT_CALENDAR;
  const chartW = Math.max(width - LABEL_W, 100);
  const scale = createTimeScale(range.start, range.end, chartW);
  const headerRows = detail === 'weeks' ? 3 : 2;
  const HEADER_H = headerRows * HEADER_ROW_H;
  const height = HEADER_H + rows.length * ROW_H;
  const totalW = LABEL_W + chartW;
  const weekEnds = detail === 'weeks' ? workWeekEnds(range, cal) : [];

  return (
    <svg width={totalW} height={height} role="img" aria-label="Gantt chart" className="gantt">
      <g transform={`translate(${LABEL_W},0)`}>
        {scale.years.map((y) => (
          <text key={y.year} x={y.x + 4} y={12} className="gantt-year">{y.year}</text>
        ))}
        {scale.ticks.map((t) => (
          <g key={t.date}>
            <line x1={t.x} x2={t.x} y1={0} y2={height} className="gantt-grid" />
            <text x={t.x + 4} y={28} className="gantt-tick">{t.label}</text>
          </g>
        ))}
        {weekEnds.map((d) => {
          const endOfDayX = scale.x(d) + scale.dayWidth;
          const dayNum = Number(d.slice(8, 10));
          return (
            <g key={d}>
              <line x1={endOfDayX} x2={endOfDayX} y1={HEADER_H} y2={height} className="gantt-grid-week" />
              <text x={scale.x(d) + scale.dayWidth / 2} y={44} textAnchor="middle" className="gantt-week-tick">{dayNum}</text>
            </g>
          );
        })}
      </g>

      {rows.map((row, i) => {
        const y = HEADER_H + i * ROW_H;
        const isGroup = row.kind === 'group';
        const clickable = onRowClick !== undefined && !isGroup;
        const barH = isGroup ? SUMMARY_H : BAR_H;

        const placements: BarPlacement[] = row.bars
          .filter((bar) => bar.end >= range.start && bar.start <= range.end)
          .map((bar) => {
            const s = bar.start < range.start ? range.start : bar.start;
            const e = bar.end > range.end ? range.end : bar.end;
            const x = LABEL_W + scale.x(s);
            const w = Math.max(scale.x(e) + scale.dayWidth - scale.x(s), 2);
            return { bar, isGroup, x, w, y, barH };
          });

        return (
          <g
            key={row.id}
            data-testid={`gantt-row-${row.id}`}
            className={['gantt-row', isGroup ? 'group' : '', clickable ? 'clickable' : ''].filter(Boolean).join(' ')}
            onClick={clickable ? () => onRowClick?.(row.id) : undefined}
          >
            <rect x={0} y={y} width={totalW} height={ROW_H} className="gantt-row-bg" />
            <text x={row.kind === 'child' ? 22 : 8} y={y + ROW_H / 2 + 4} className="gantt-label">
              <title>{row.label}</title>
              {truncate(row.label, row.kind === 'child' ? 26 : 28)}
            </text>
            {placements.map((placement) => {
              const { bar, x, w } = placement;
              const showLabel = !isGroup && bar.label !== undefined && bar.label.length * APPROX_CHAR_W + 12 < w;
              const dateLabel = !isGroup && showDates ? placeDateLabel(placement, placements, totalW) : null;
              return (
                <g key={bar.id} data-testid={`gantt-bar-${bar.id}`}>
                  <rect
                    x={x}
                    y={y + (ROW_H - barH) / 2}
                    width={w}
                    height={barH}
                    rx={isGroup ? 2 : 4}
                    fill={bar.color}
                    className={isGroup ? 'gantt-bar gantt-summary' : 'gantt-bar'}
                  >
                    <title>{bar.title ?? bar.label ?? ''}</title>
                  </rect>
                  {showLabel ? (
                    <text x={x + 6} y={y + ROW_H / 2 + 4} className="gantt-bar-label">{bar.label}</text>
                  ) : null}
                  {dateLabel ? (
                    <text x={dateLabel.x} y={y + ROW_H / 2 + 4} textAnchor={dateLabel.anchor} className="gantt-bar-dates">
                      {formatBarDates(bar.start, bar.end)}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </g>
        );
      })}

      {today && today >= range.start && today <= range.end ? (
        <line
          data-testid="gantt-today"
          x1={LABEL_W + scale.x(today)}
          x2={LABEL_W + scale.x(today)}
          y1={HEADER_H - 4}
          y2={height}
          className="gantt-today"
        />
      ) : null}
    </svg>
  );
}
