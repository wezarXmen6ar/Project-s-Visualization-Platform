import type { ISODate } from '../../shared/calendar';
import type { Lang } from '../../shared/i18n/types';
import { barDates } from '../i18n/format';

/**
 * A bar's dates for the Gantt chart, e.g. "8 Sep – 19 Sep". The year is added to both dates, but only when they
 * fall in different years, e.g. "30 Nov 2026 – 19 Feb 2027". English unless `lang` says otherwise ("8 سبتمبر – 19 سبتمبر").
 */
export function formatBarDates(start: ISODate, end: ISODate, lang: Lang = 'en'): string {
  return barDates(lang, start, end);
}
