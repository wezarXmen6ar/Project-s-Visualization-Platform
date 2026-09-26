import { daysBetween, type ISODate } from './calendar';

/**
 * The one shared "how urgent is this expiry" rule, used by person documents (M7 Task 8), accounts (M7 Task 8) and
 * project key dates (M7 Task 9): *expired* once the date is before today, *soon* while it is within `windowDays`
 * (inclusive), otherwise *fine*. `windowDays` is the document/key-date fixed 30 days, or an account's own
 * `remindDays`.
 */
export type ExpiryState = 'expired' | 'soon' | 'fine';

/** Null when there is no expiry date to judge (e.g. a document with none set). */
export function expiryState(expiryDate: ISODate | null, today: ISODate, windowDays: number): ExpiryState | null {
  if (expiryDate === null) return null;
  if (expiryDate < today) return 'expired';
  return daysBetween(today, expiryDate) <= windowDays ? 'soon' : 'fine';
}

/** Days from today to the expiry date; negative once it has passed. */
export function daysUntilExpiry(expiryDate: ISODate, today: ISODate): number {
  return daysBetween(today, expiryDate);
}
