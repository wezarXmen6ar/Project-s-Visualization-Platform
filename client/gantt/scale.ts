import { addDays, daysBetween, type DateRange, type ISODate } from '../../shared/calendar';

export interface TimeScale {
  start: ISODate;
  end: ISODate;
  width: number;
  dayWidth: number;
  x(date: ISODate): number;
  ticks: { date: ISODate; x: number; label: string }[];
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
    const withYear = month === 1 || ticks.length === 0;
    ticks.push({ date: m, x: x(m), label: MONTHS[month - 1] + (withYear ? ` ${m.slice(0, 4)}` : '') });
    m = nextMonth(m);
  }
  return { start, end, width, dayWidth, x, ticks };
}

export function monthPaddedRange(start: ISODate, end: ISODate): DateRange {
  return { start: firstOfMonth(start), end: addDays(nextMonth(firstOfMonth(end)), -1) };
}
