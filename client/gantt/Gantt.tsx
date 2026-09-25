import { useEffect, useId, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import { addDays, DEFAULT_CALENDAR, isWorkingDay, type DateRange, type ISODate, type WorkCalendar } from '../../shared/calendar';
import { formatBarDates } from './barDates';
import { createTimeScale, thinLabels, workWeekEnds } from './scale';

/** The details card for a piece of the chart: a bold title with lines under it. */
export interface GanttDetail {
  title: string;
  lines: string[];
}

/** A piece of a bar, e.g. a sub-phase inside its phase's bar. Drawn in the bar's colour with dividers between. */
export interface GanttSegment {
  id: string;
  start: ISODate;
  end: ISODate;
  label: string;
  detail?: GanttDetail;
}

export interface GanttBar {
  id: string;
  start: ISODate;
  end: ISODate;
  color: string;
  label?: string;
  title?: string;
  /** Pieces the bar is divided into. The bar's own label is then left out; each segment shows its label if it fits. */
  segments?: GanttSegment[];
  /** Shown in a card on hover, focus or tap. A bar or segment with a detail is focusable. */
  detail?: GanttDetail;
}

export interface GanttRow {
  id: string;
  label: string;
  bars: GanttBar[];
  /**
   * 'group': a heading row with a summary bar that is never clickable. 'child': a row under a group (indented label).
   * 'lane': an extra, shorter row without label text, directly under a phase, for its parallel sub-phases.
   */
  kind?: 'group' | 'child' | 'lane';
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
  /**
   * Shows a small muted dates label beside each bar. Default false. The label avoids other bars in the same
   * row but not other date labels, so this is meant for a chart with one bar per row.
   */
  showDates?: boolean;
}

const LABEL_W = 200;
const HEADER_ROW_H = 16;
const ROW_H = 36;
const LANE_H = 24;
const DIVIDER_W = 2;
const CARD_GAP = 6;
const CARD_MARGIN = 4;
const BAR_H = 20;
const SUMMARY_H = 8;
const APPROX_CHAR_W = 6.5;
const DATE_LABEL_GAP = 6;
const MIN_TRUNCATED_LABEL_CHARS = 6;
const MIN_WEEK_LABEL_GAP = 22;
const MIN_MONTH_LABEL_GAP = 30;

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
  takenLabels: [number, number][] = [],
): { x: number; anchor: 'start' | 'end' } | null {
  const label = formatBarDates(placement.bar.start, placement.bar.end);
  const approxWidth = label.length * APPROX_CHAR_W;

  const overlapsOther = (labelStart: number, labelEnd: number) =>
    others.some((o) => o !== placement && labelStart < o.x + o.w && labelEnd > o.x) ||
    takenLabels.some(([a, b]) => labelStart < b && labelEnd > a);

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

/** The details card currently shown: for which piece, and where (in the chart wrapper's coordinates). */
interface ActiveDetail {
  key: string;
  detail: GanttDetail;
  /** Horizontal anchor: the pointer, or the piece's centre when focused. */
  x: number;
  /** The piece's top and bottom, so the card can sit below it (or above it near the bottom of the chart). */
  top: number;
  bottom: number;
  /** Opened by a click or tap: stays open on mouse leave, until clicked again, blurred or Escape. */
  pinned: boolean;
}

interface PieceBox {
  x: number;
  w: number;
  top: number;
  bottom: number;
}

function dateBox(start: ISODate, end: ISODate, range: DateRange, scale: ReturnType<typeof createTimeScale>) {
  if (end < range.start || start > range.end) return null;
  const s = start < range.start ? range.start : start;
  const e = end > range.end ? range.end : end;
  const x = LABEL_W + scale.x(s);
  return { x, w: Math.max(scale.x(e) + scale.dayWidth - scale.x(s), 2) };
}

function segmentBox(seg: GanttSegment, range: DateRange, scale: ReturnType<typeof createTimeScale>) {
  return dateBox(seg.start, seg.end, range, scale);
}

function hasWorkingDay(start: ISODate, end: ISODate, cal: WorkCalendar): boolean {
  for (let d = start; d <= end; d = addDays(d, 1)) {
    if (isWorkingDay(d, cal)) return true;
  }
  return false;
}

/**
 * The parts of a segmented bar's span that no lane-0 segment covers, restricted to the ones containing at least
 * one working day — a gap made up entirely of non-working days (usually just a weekend) isn't drawn lighter.
 */
function workingDayGaps(bar: GanttBar, segments: GanttSegment[], cal: WorkCalendar): { start: ISODate; end: ISODate }[] {
  const sorted = [...segments].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  const spans: { start: ISODate; end: ISODate }[] = [];
  let cursor = bar.start;
  for (const seg of sorted) {
    const gapEnd = addDays(seg.start, -1);
    if (cursor <= gapEnd) spans.push({ start: cursor, end: gapEnd });
    cursor = addDays(seg.end, 1);
  }
  if (cursor <= bar.end) spans.push({ start: cursor, end: bar.end });
  return spans.filter((g) => hasWorkingDay(g.start, g.end, cal));
}

export function Gantt({ rows, range, width, today, onRowClick, calendar, detail = 'months', showDates = false }: GanttProps) {
  const cal = calendar ?? DEFAULT_CALENDAR;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const wrapRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<ActiveDetail | null>(null);
  // Checked once: on a device that can hover, hover alone shows/hides the card, so a click does nothing extra.
  // Only on a no-hover (touch) device does a click/tap pin the card open. Guarded because jsdom has no matchMedia.
  const [noHoverDevice] = useState(() => {
    try {
      return window.matchMedia?.('(hover: none)').matches ?? false;
    } catch {
      return false;
    }
  });

  const chartW = Math.max(width - LABEL_W, 100);
  const scale = createTimeScale(range.start, range.end, chartW);
  const headerRows = detail === 'weeks' ? 3 : 2;
  const HEADER_H = headerRows * HEADER_ROW_H;
  const rowHeights = rows.map((row) => (row.kind === 'lane' ? LANE_H : ROW_H));
  const rowTops: number[] = [];
  let bodyH = 0;
  for (const h of rowHeights) {
    rowTops.push(HEADER_H + bodyH);
    bodyH += h;
  }
  const height = HEADER_H + bodyH;
  const totalW = LABEL_W + chartW;
  const weekEnds = detail === 'weeks' ? workWeekEnds(range, cal) : [];

  const showYear = thinLabels(scale.years.map((y) => y.x), MIN_MONTH_LABEL_GAP);
  const showMonth = thinLabels(scale.ticks.map((t) => t.x), MIN_MONTH_LABEL_GAP);

  const weekSpacing = scale.dayWidth * 7;
  const weekLabelStep = Math.max(1, Math.ceil(MIN_WEEK_LABEL_GAP / weekSpacing));
  const weekLineStep = weekSpacing < 6 ? weekLabelStep : 1;

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActive(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active]);

  // Keep the card inside the visible part of the chart: within the scroll container's width, and below the piece
  // unless it would run past the bottom of the chart, when it goes above.
  useLayoutEffect(() => {
    const card = cardRef.current;
    const wrap = wrapRef.current;
    if (!active || !card || !wrap) return;
    const cardW = card.offsetWidth;
    const cardH = card.offsetHeight;
    const wrapRect = wrap.getBoundingClientRect();
    const scroller = wrap.closest('.chart-scroll') ?? wrap.parentElement;
    const viewRect = scroller ? scroller.getBoundingClientRect() : wrapRect;
    const minX = Math.max(0, viewRect.left - wrapRect.left) + CARD_MARGIN;
    const maxX = Math.min(totalW, viewRect.right - wrapRect.left) - CARD_MARGIN - cardW;
    const left = Math.max(minX, Math.min(active.x - cardW / 2, maxX));
    const below = active.bottom + CARD_GAP;
    const above = active.top - CARD_GAP - cardH;
    const rawTop = below + cardH <= height || above < 0 ? below : above;
    const top = Math.max(0, Math.min(rawTop, height - cardH));
    card.style.left = `${Math.round(left)}px`;
    card.style.top = `${Math.round(top)}px`;
  }, [active, height, totalW]);

  function pieceProps(key: string, pieceDetail: GanttDetail | undefined, box: PieceBox) {
    if (!pieceDetail) return {};
    const make = (x: number, pinned: boolean): ActiveDetail => ({
      key, detail: pieceDetail, x, top: box.top, bottom: box.bottom, pinned,
    });
    const pointerX = (e: MouseEvent) => {
      const rect = wrapRef.current?.getBoundingClientRect();
      return rect && e.clientX ? e.clientX - rect.left : box.x + box.w / 2;
    };
    const props: Record<string, unknown> = {
      tabIndex: 0,
      'aria-label': [pieceDetail.title, pieceDetail.lines[0]].filter(Boolean).join(', '),
      onMouseEnter: (e: MouseEvent) => {
        const x = pointerX(e);
        setActive((a) => (a?.key === key ? a : make(x, false)));
      },
      onMouseLeave: () => setActive((a) => (a?.key === key && !a.pinned ? null : a)),
      onFocus: () => setActive((a) => (a?.key === key ? a : make(box.x + box.w / 2, false))),
      onBlur: () => setActive((a) => (a?.key === key ? null : a)),
    };
    // On a device that can hover, hover already shows the card, so a click would only "pin" it with no visible
    // change on the first click and close it unexpectedly on the second. Toggling by click/tap is for touch devices.
    if (noHoverDevice) {
      props.onClick = (e: MouseEvent) => {
        const x = pointerX(e);
        setActive((a) => (a?.key === key && a.pinned ? null : make(a?.key === key ? a.x : x, true)));
      };
    }
    return props;
  }

  return (
    <div className="gantt-wrap" ref={wrapRef} style={{ width: totalW }}>
      <svg width={totalW} height={height} role="img" aria-label="Gantt chart" className="gantt">
        <g transform={`translate(${LABEL_W},0)`}>
          {scale.years.map((y, i) => (showYear[i] ? (
            <text key={y.year} x={y.x + 4} y={12} className="gantt-year">{y.year}</text>
          ) : null))}
          {scale.ticks.map((t, i) => (
            <g key={t.date}>
              <line x1={t.x} x2={t.x} y1={0} y2={height} className="gantt-grid" />
              {showMonth[i] ? <text x={t.x + 4} y={28} className="gantt-tick">{t.label}</text> : null}
            </g>
          ))}
          {weekEnds.map((d, i) => {
            const endOfDayX = scale.x(d) + scale.dayWidth;
            const dayNum = Number(d.slice(8, 10));
            const showLine = i % weekLineStep === 0;
            const showLabel = i % weekLabelStep === 0;
            return (
              <g key={d}>
                {showLine ? (
                  <line x1={endOfDayX} x2={endOfDayX} y1={HEADER_H} y2={height} className="gantt-grid-week" />
                ) : null}
                {showLabel ? (
                  <text x={scale.x(d) + scale.dayWidth / 2} y={44} textAnchor="middle" className="gantt-week-tick">{dayNum}</text>
                ) : null}
              </g>
            );
          })}
        </g>

        {rows.map((row, i) => {
          const y = rowTops[i];
          const rowH = rowHeights[i];
          const isGroup = row.kind === 'group';
          const clickable = onRowClick !== undefined && !isGroup;
          const barH = isGroup ? SUMMARY_H : BAR_H;
          const barY = y + (rowH - barH) / 2;
          const textY = y + rowH / 2 + 4;

          const placements: BarPlacement[] = row.bars
            .filter((bar) => bar.end >= range.start && bar.start <= range.end)
            .map((bar) => {
              const s = bar.start < range.start ? range.start : bar.start;
              const e = bar.end > range.end ? range.end : bar.end;
              const x = LABEL_W + scale.x(s);
              const w = Math.max(scale.x(e) + scale.dayWidth - scale.x(s), 2);
              return { bar, isGroup, x, w, y, barH };
            });
          // Dates labels already placed in this row, so a lane row's labels don't run into each other.
          const takenLabels: [number, number][] = [];

          return (
            <g
              key={row.id}
              data-testid={`gantt-row-${row.id}`}
              className={['gantt-row', isGroup ? 'group' : '', row.kind === 'lane' ? 'lane' : '', clickable ? 'clickable' : '']
                .filter(Boolean)
                .join(' ')}
              onClick={clickable ? () => onRowClick?.(row.id) : undefined}
            >
              <rect x={0} y={y} width={totalW} height={rowH} className="gantt-row-bg" />
              {row.label ? (() => {
                // Lane-0 segments can cover the whole phase bar, leaving only the 2px dividers reachable for the
                // phase's own card. The row's name label gets the same piece interaction so it's always reachable.
                const labelBar = !isGroup && row.bars.length === 1 ? row.bars[0] : undefined;
                const labelDetail = labelBar?.detail;
                return (
                  <text
                    x={row.kind === 'child' ? 22 : 8}
                    y={textY}
                    className={['gantt-label', labelDetail ? 'gantt-piece' : ''].filter(Boolean).join(' ')}
                    {...pieceProps(`label-${row.id}`, labelDetail, { x: 0, w: LABEL_W, top: y, bottom: y + rowH })}
                  >
                    <title>{row.label}</title>
                    {truncate(row.label, row.kind === 'child' ? 26 : 28)}
                  </text>
                );
              })() : null}
              {placements.map((placement) => {
                const { bar, x, w } = placement;
                const segments = !isGroup && bar.segments && bar.segments.length > 0 ? bar.segments : null;
                const showLabel = !isGroup && !segments && bar.label !== undefined && bar.label.length * APPROX_CHAR_W + 12 < w;
                const dateText = formatBarDates(bar.start, bar.end);
                const dateLabel = !isGroup && showDates ? placeDateLabel(placement, placements, totalW, takenLabels) : null;
                if (dateLabel) {
                  const labelW = dateText.length * APPROX_CHAR_W;
                  takenLabels.push(dateLabel.anchor === 'start' ? [dateLabel.x, dateLabel.x + labelW] : [dateLabel.x - labelW, dateLabel.x]);
                }
                const segmentBoxes = segments
                  ? segments.flatMap((seg) => {
                      const b = segmentBox(seg, range, scale);
                      return b ? [{ seg, ...b }] : [];
                    })
                  : [];
                // The parts of the bar no lane-0 segment covers, shown in a lighter shade — but only where the gap
                // has a working day, so a gap made up entirely of weekend (e.g. Fri to Mon) stays a plain bar.
                const gapBoxes = segments
                  ? workingDayGaps(bar, segments, cal).flatMap((g) => {
                      const b = dateBox(g.start, g.end, range, scale);
                      return b ? [b] : [];
                    })
                  : [];
                const dividers = new Set<number>();
                for (const { x: sx, w: sw } of segmentBoxes) {
                  if (sx > x + 1) dividers.add(sx);
                  if (sx + sw < x + w - 1) dividers.add(sx + sw);
                }
                const clipId = `${uid}-clip-${bar.id}`;
                const barDetail = isGroup ? undefined : bar.detail;
                return (
                  <g key={bar.id} data-testid={`gantt-bar-${bar.id}`}>
                    {segments ? (
                      <clipPath id={clipId}>
                        <rect x={x} y={barY} width={w} height={barH} rx={4} />
                      </clipPath>
                    ) : null}
                    <rect
                      x={x}
                      y={barY}
                      width={w}
                      height={barH}
                      rx={isGroup ? 2 : 4}
                      fill={bar.color}
                      className={[
                        'gantt-bar',
                        isGroup ? 'gantt-summary' : '',
                        barDetail ? 'gantt-piece' : '',
                      ].filter(Boolean).join(' ')}
                      {...pieceProps(`bar-${row.id}-${bar.id}`, barDetail, { x, w, top: barY, bottom: barY + barH })}
                    >
                      <title>{bar.title ?? bar.label ?? ''}</title>
                    </rect>
                    {gapBoxes.map((g, gi) => (
                      <rect
                        key={`gap-${gi}`}
                        data-testid={`gantt-gap-${bar.id}-${gi}`}
                        x={g.x}
                        y={barY}
                        width={g.w}
                        height={barH}
                        fill={bar.color}
                        clipPath={`url(#${clipId})`}
                        className="gantt-gap"
                      />
                    ))}
                    {segmentBoxes.map(({ seg, x: sx, w: sw }) => (
                      <rect
                        key={seg.id}
                        data-testid={`gantt-segment-${seg.id}`}
                        x={sx}
                        y={barY}
                        width={sw}
                        height={barH}
                        fill={bar.color}
                        clipPath={`url(#${clipId})`}
                        className={seg.detail ? 'gantt-segment gantt-piece' : 'gantt-segment'}
                        {...pieceProps(`segment-${seg.id}`, seg.detail, { x: sx, w: sw, top: barY, bottom: barY + barH })}
                      >
                        <title>{seg.detail ? `${seg.detail.title}: ${seg.start} → ${seg.end}` : seg.label}</title>
                      </rect>
                    ))}
                    {[...dividers].map((dx) => (
                      <line key={dx} x1={dx} x2={dx} y1={barY} y2={barY + barH} strokeWidth={DIVIDER_W} className="gantt-divider" />
                    ))}
                    {segmentBoxes.map(({ seg, x: sx, w: sw }) => {
                      const maxChars = Math.floor((sw - 12) / APPROX_CHAR_W);
                      if (maxChars < MIN_TRUNCATED_LABEL_CHARS) return null;
                      return (
                        <text key={seg.id} x={sx + 6} y={textY} className="gantt-bar-label">{truncate(seg.label, maxChars)}</text>
                      );
                    })}
                    {showLabel ? (
                      <text x={x + 6} y={textY} className="gantt-bar-label">{bar.label}</text>
                    ) : null}
                    {dateLabel ? (
                      <text x={dateLabel.x} y={textY} textAnchor={dateLabel.anchor} className="gantt-bar-dates">
                        {dateText}
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
      {active ? (
        <div
          ref={cardRef}
          role="tooltip"
          className="gantt-detail"
          style={{ left: Math.max(0, active.x), top: active.bottom + CARD_GAP }}
        >
          <strong>{active.detail.title}</strong>
          {active.detail.lines.map((line, i) => (
            <span key={i}>{line}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
