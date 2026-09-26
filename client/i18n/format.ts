import { useMemo } from 'react';
import { dayOfWeek, type ISODate } from '../../shared/calendar';
import type { Lang } from '../../shared/i18n/types';
import { useLang } from './LanguageProvider';

/**
 * Every displayed date and percentage comes from here. English keeps the app's original short forms ("Mon 12 Oct");
 * Arabic uses Intl's Gregorian names with Western digits ("الاثنين 12 أكتوبر"). Nothing else keeps its own month or
 * day names.
 */

const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const EN_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Western digits in Arabic come from the `nu-latn` extension. Dates are built at UTC midnight and formatted in UTC,
// so no time zone can shift them by a day.
const AR_LOCALE = 'ar-AE-u-nu-latn';
const arWeekday = new Intl.DateTimeFormat(AR_LOCALE, { weekday: 'long', timeZone: 'UTC' });
const arWeekdayNarrow = new Intl.DateTimeFormat(AR_LOCALE, { weekday: 'narrow', timeZone: 'UTC' });
const arMonth = new Intl.DateTimeFormat(AR_LOCALE, { month: 'long', timeZone: 'UTC' });

function utc(d: ISODate): Date {
  return new Date(`${d.slice(0, 10)}T00:00:00Z`);
}

const day = (d: ISODate) => Number(d.slice(8, 10));
const year = (d: ISODate) => d.slice(0, 4);

/** "Mon" / "الاثنين". */
function weekdayName(lang: Lang, d: ISODate): string {
  return lang === 'ar' ? arWeekday.format(utc(d)) : EN_DAYS[dayOfWeek(d)];
}

/** "Oct" / "أكتوبر" (Arabic has no short month names). */
export function monthLabel(lang: Lang, d: ISODate): string {
  return lang === 'ar' ? arMonth.format(utc(d)) : EN_MONTHS[Number(d.slice(5, 7)) - 1];
}

/** "Mon 12 Oct" / "الاثنين 12 أكتوبر". Built from parts, so Intl's comma after the weekday never appears. */
export function dayDate(lang: Lang, d: ISODate): string {
  return `${weekdayName(lang, d)} ${day(d)} ${monthLabel(lang, d)}`;
}

/** "Mon 12 Oct 2026" / "الاثنين 12 أكتوبر 2026". */
export function formatDate(lang: Lang, d: ISODate): string {
  return `${dayDate(lang, d)} ${year(d)}`;
}

/** "12 Oct" / "12 أكتوبر". */
export function shortDate(lang: Lang, d: ISODate): string {
  return `${day(d)} ${monthLabel(lang, d)}`;
}

/** "M" / "ن": the one-letter weekday of the day-by-day heatmap. */
export function weekdayLetter(lang: Lang, d: ISODate): string {
  return lang === 'ar' ? arWeekdayNarrow.format(utc(d)) : EN_DAYS[dayOfWeek(d)][0];
}

/**
 * A bar's dates for the Gantt chart, e.g. "8 Sep – 19 Sep". The year is added to both dates, but only when they
 * fall in different years, e.g. "30 Nov 2026 – 19 Feb 2027".
 */
export function barDates(lang: Lang, start: ISODate, end: ISODate): string {
  const sameYear = year(start) === year(end);
  const fmt = (d: ISODate) => `${shortDate(lang, d)}${sameYear ? '' : ` ${year(d)}`}`;
  return `${fmt(start)} – ${fmt(end)}`;
}

// LEFT-TO-RIGHT ISOLATE … POP DIRECTIONAL ISOLATE. A bare "14–18" inside right-to-left text would otherwise be
// reordered by the bidi algorithm (the en dash is a neutral), showing "18–14".
const LRI = '⁦';
const PDI = '⁩';

/** Two numbers joined by an en dash, kept in left-to-right order in Arabic: "⁦14–18⁩". English is left as is. */
function numberRange(lang: Lang, a: number, b: number): string {
  const range = `${a}–${b}`;
  return lang === 'ar' ? `${LRI}${range}${PDI}` : range;
}

/**
 * "12–16 Oct" within a month, "28 Sep – 2 Oct" across months, or "12 Oct" for a single day. In Arabic the numbers of
 * the first form are wrapped in a left-to-right isolate ("⁦12–16⁩ أكتوبر"); the other forms keep their order because
 * month names separate the numbers.
 */
export function dayRange(lang: Lang, first: ISODate, last: ISODate): string {
  if (first === last) return shortDate(lang, first);
  if (first.slice(0, 7) === last.slice(0, 7)) return `${numberRange(lang, day(first), day(last))} ${monthLabel(lang, last)}`;
  return `${shortDate(lang, first)} – ${shortDate(lang, last)}`;
}

/** "60%" in both languages. */
export function percent(_lang: Lang, n: number): string {
  return `${n}%`;
}

/** "2.4 MB" / "2.4 ميغابايت", or "850.0 KB" / "850.0 كيلوبايت" under 1 MB. One decimal place, Western digits. */
export function fileSize(lang: Lang, bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} ${lang === 'ar' ? 'ميغابايت' : 'MB'}`;
  const kb = bytes / 1024;
  return `${kb.toFixed(1)} ${lang === 'ar' ? 'كيلوبايت' : 'KB'}`;
}

/** The formatters bound to the current language. */
export function useFormat() {
  const { lang } = useLang();
  return useMemo(
    () => ({
      dayDate: (d: ISODate) => dayDate(lang, d),
      formatDate: (d: ISODate) => formatDate(lang, d),
      shortDate: (d: ISODate) => shortDate(lang, d),
      monthLabel: (d: ISODate) => monthLabel(lang, d),
      weekdayLetter: (d: ISODate) => weekdayLetter(lang, d),
      barDates: (start: ISODate, end: ISODate) => barDates(lang, start, end),
      dayRange: (first: ISODate, last: ISODate) => dayRange(lang, first, last),
      percent: (n: number) => percent(lang, n),
      fileSize: (bytes: number) => fileSize(lang, bytes),
    }),
    [lang],
  );
}
