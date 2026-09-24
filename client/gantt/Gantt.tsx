import type { DateRange, ISODate } from '../../shared/calendar';
import { createTimeScale } from './scale';

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
}

const LABEL_W = 200;
const HEADER_H = 28;
const ROW_H = 36;
const BAR_H = 20;
const SUMMARY_H = 8;
const APPROX_CHAR_W = 6.5;

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function Gantt({ rows, range, width, today, onRowClick }: GanttProps) {
  const chartW = Math.max(width - LABEL_W, 100);
  const scale = createTimeScale(range.start, range.end, chartW);
  const height = HEADER_H + rows.length * ROW_H;
  const totalW = LABEL_W + chartW;

  return (
    <svg width={totalW} height={height} role="img" aria-label="Gantt chart" className="gantt">
      <g transform={`translate(${LABEL_W},0)`}>
        {scale.ticks.map((t) => (
          <g key={t.date}>
            <line x1={t.x} x2={t.x} y1={0} y2={height} className="gantt-grid" />
            <text x={t.x + 4} y={18} className="gantt-tick">{t.label}</text>
          </g>
        ))}
      </g>

      {rows.map((row, i) => {
        const y = HEADER_H + i * ROW_H;
        const isGroup = row.kind === 'group';
        const clickable = onRowClick !== undefined && !isGroup;
        const barH = isGroup ? SUMMARY_H : BAR_H;
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
            {row.bars
              .filter((bar) => bar.end >= range.start && bar.start <= range.end)
              .map((bar) => {
                const s = bar.start < range.start ? range.start : bar.start;
                const e = bar.end > range.end ? range.end : bar.end;
                const x = LABEL_W + scale.x(s);
                const w = Math.max(scale.x(e) + scale.dayWidth - scale.x(s), 2);
                const showLabel = !isGroup && bar.label !== undefined && bar.label.length * APPROX_CHAR_W + 12 < w;
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
