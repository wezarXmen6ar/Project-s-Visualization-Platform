export type ISODate = string; // 'YYYY-MM-DD'

export interface DateRange {
  start: ISODate;
  end: ISODate;
}

export interface WorkCalendar {
  /** Days of the week that are not worked: 0 = Sunday … 6 = Saturday. */
  weekendDays: number[];
  holidays: DateRange[];
}

export const DEFAULT_CALENDAR: WorkCalendar = { weekendDays: [0, 6], holidays: [] };

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;
const MAX_SCAN_DAYS = 3660;

function toDate(d: ISODate): Date {
  return new Date(`${d}T00:00:00Z`);
}

function fromDate(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

export function isISODate(value: string): boolean {
  if (!ISO_RE.test(value)) return false;
  const d = toDate(value);
  return !Number.isNaN(d.getTime()) && fromDate(d) === value;
}

export function todayLocal(): ISODate {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** The local calendar date of a full ISO timestamp (e.g. a `createdAt`/`uploadedAt`), not its UTC date — UAE is
 * UTC+4, so a timestamp stored past 20:00 UTC already falls on the next day locally. */
export function toLocalDate(iso: string): ISODate {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function addDays(d: ISODate, n: number): ISODate {
  const date = toDate(d);
  date.setUTCDate(date.getUTCDate() + n);
  return fromDate(date);
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / MS_PER_DAY);
}

/** Where an outsourced engagement stands, relative to `today`. Upcoming and engaged are both current — the team
 * can plan ahead for someone not yet started; only past (their end date has gone by) is history. */
export type EngagementStatus = 'upcoming' | 'engaged' | 'past';

/**
 * The single shared rule for an outsourced engagement's status: *past* once the end date (if any) is before
 * today; *upcoming* when the start date (if any) is after today and it isn't already past; *engaged* otherwise
 * (an open-ended start or end counts as already-started / never-ending).
 */
export function engagementStatus(start: ISODate | null, end: ISODate | null, today: ISODate): EngagementStatus {
  if (end !== null && end < today) return 'past';
  if (start !== null && start > today) return 'upcoming';
  return 'engaged';
}

export function dayOfWeek(d: ISODate): number {
  return toDate(d).getUTCDay();
}

export function isWorkingDay(d: ISODate, cal: WorkCalendar): boolean {
  if (cal.weekendDays.includes(dayOfWeek(d))) return false;
  return !cal.holidays.some((h) => d >= h.start && d <= h.end);
}

export function nextWorkingDay(d: ISODate, cal: WorkCalendar): ISODate {
  let current = d;
  for (let i = 0; i < MAX_SCAN_DAYS; i++) {
    if (isWorkingDay(current, cal)) return current;
    current = addDays(current, 1);
  }
  throw new Error('No working day found within 10 years — check the weekend and holiday settings');
}

/** Returns the date of the n-th working day, counting the start (rolled forward to a working day) as day 1. */
export function addWorkingDays(start: ISODate, n: number, cal: WorkCalendar): ISODate {
  if (!Number.isInteger(n) || n < 1) throw new Error(`Working-day count must be a positive whole number, got ${n}`);
  let current = nextWorkingDay(start, cal);
  let counted = 1;
  while (counted < n) {
    current = nextWorkingDay(addDays(current, 1), cal);
    counted++;
  }
  return current;
}

/** Working days from start to end, both inclusive. 0 if end is before start. */
export function countWorkingDays(start: ISODate, end: ISODate, cal: WorkCalendar): number {
  let count = 0;
  for (let d = start; d <= end; d = addDays(d, 1)) {
    if (isWorkingDay(d, cal)) count++;
  }
  return count;
}
