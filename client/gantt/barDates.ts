import type { ISODate } from '../../shared/calendar';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * A bar's dates for the Gantt chart, e.g. "8 Sep – 19 Sep". The year is added to both dates, but only when they
 * fall in different years, e.g. "30 Nov 2026 – 19 Feb 2027".
 */
export function formatBarDates(start: ISODate, end: ISODate): string {
  const day = (d: ISODate) => Number(d.slice(8, 10));
  const month = (d: ISODate) => MONTHS[Number(d.slice(5, 7)) - 1];
  const year = (d: ISODate) => d.slice(0, 4);
  const sameYear = year(start) === year(end);
  const fmt = (d: ISODate) => `${day(d)} ${month(d)}${sameYear ? '' : ` ${year(d)}`}`;
  return `${fmt(start)} – ${fmt(end)}`;
}
