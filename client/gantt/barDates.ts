import type { ISODate } from '../../shared/calendar';
import { barDates } from '../i18n/format';

/**
 * A bar's dates for the Gantt chart, e.g. "8 Sep – 19 Sep". The year is added to both dates, but only when they
 * fall in different years, e.g. "30 Nov 2026 – 19 Feb 2027". English; the language-aware form is `barDates` in
 * `i18n/format`.
 */
export function formatBarDates(start: ISODate, end: ISODate): string {
  return barDates('en', start, end);
}
