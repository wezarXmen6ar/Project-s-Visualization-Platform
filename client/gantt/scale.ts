import { addDays, daysBetween, dayOfWeek, type DateRange, type ISODate, type WorkCalendar } from '../../shared/calendar';

export interface TimeScale {
  start: ISODate;
  end: ISODate;
  width: number;
  dayWidth: number;
  x(date: ISODate): number;
  ticks: { date: ISODate; x: number; label: string }[];
  /** One entry at the left edge (x = 0, the first visible year) and one at each 1 January inside the range. */
  years: { year: string; x: number }[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function firstOfMonth(d: ISODate): ISODate {
  return `${d.slice(0, 7)}-01`;
}

function nextMonth(firstOfMonthDate: ISODate): ISODate {
  const year = Number(firstOfMonthDate.slice(0, 4));
  const month = Number(firstOfMonthDate.slice(5, 7));
  return month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
}

/** Linear day scale; `end` is inclusive, so the last day gets a full day of width. */
export function createTimeScale(start: ISODate, end: ISODate, width: number): TimeScale {
  const totalDays = daysBetween(start, end) + 1;
  const dayWidth = width / totalDays;
  const x = (date: ISODate) => daysBetween(start, date) * dayWidth;

  const ticks: TimeScale['ticks'] = [];
  let m = firstOfMonth(start);
  if (m < start) m = nextMonth(m);
  while (m <= end) {
    const month = Number(m.slice(5, 7));
    ticks.push({ date: m, x: x(m), label: MONTHS[month - 1] });
    m = nextMonth(m);
  }

  const years: TimeScale['years'] = [{ year: start.slice(0, 4), x: 0 }];
  const startYear = Number(start.slice(0, 4));
  const endYear = Number(end.slice(0, 4));
  for (let y = startYear + 1; y <= endYear; y++) {
    const jan1 = `${y}-01-01`;
    if (jan1 <= end) years.push({ year: String(y), x: x(jan1) });
  }

  return { start, end, width, dayWidth, x, ticks, years };
}

export function monthPaddedRange(start: ISODate, end: ISODate): DateRange {
  return { start: firstOfMonth(start), end: addDays(nextMonth(firstOfMonth(end)), -1) };
}

/**
 * For each Monday-to-Sunday week that overlaps `range`, the last day of that week that isn't a weekend day in
 * `cal.weekendDays` — the last day of the run of working days starting on the Monday. With the default calendar
 * that is the Friday; with a Friday/Saturday weekend it is the Thursday (Sunday, though not itself a weekend day
 * in that calendar, falls after the weekend has already started, so it belongs to the next week's run). Holidays
 * don't change it. Only dates inside `range` are returned.
 */
export function workWeekEnds(range: DateRange, cal: WorkCalendar): ISODate[] {
  const out: ISODate[] = [];
  const startDow = dayOfWeek(range.start);
  const mondayOffset = startDow === 0 ? 6 : startDow - 1;
  let weekStart = addDays(range.start, -mondayOffset);

  while (weekStart <= range.end) {
    let last: ISODate | null = null;
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i);
      if (cal.weekendDays.includes(dayOfWeek(d))) break;
      last = d;
    }
    if (last !== null && last >= range.start && last <= range.end) out.push(last);
    weekStart = addDays(weekStart, 7);
  }
  return out;
}
