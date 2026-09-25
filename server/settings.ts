import type { DatabaseSync } from 'node:sqlite';
import { DEFAULT_CALENDAR, type WorkCalendar } from '../shared/calendar';
import type { Me } from '../shared/types';

export function getCalendar(db: DatabaseSync): WorkCalendar {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'calendar'").get() as unknown as { value: string } | undefined;
  return row ? (JSON.parse(row.value) as WorkCalendar) : DEFAULT_CALENDAR;
}

export function setCalendar(db: DatabaseSync, cal: WorkCalendar): void {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES ('calendar', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(JSON.stringify(cal));
}

/**
 * Who "I am" is. Returns { resourceId: null, name: null } when it isn't set, when the stored person no longer
 * exists, or when they are no longer on the tech side (a stale setting from a person who was deleted and whose id
 * was then reused by a business contact must not silently become "I am").
 */
export function getMe(db: DatabaseSync): Me {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'me'").get() as unknown as { value: string } | undefined;
  if (!row) return { resourceId: null, name: null };
  const { resourceId } = JSON.parse(row.value) as { resourceId: number | null };
  if (resourceId === null) return { resourceId: null, name: null };
  const person = db.prepare("SELECT name FROM resources WHERE id = ? AND side = 'tech'").get(resourceId) as unknown as
    | { name: string }
    | undefined;
  return person ? { resourceId, name: person.name } : { resourceId: null, name: null };
}

export function setMe(db: DatabaseSync, resourceId: number | null): void {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES ('me', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(JSON.stringify({ resourceId }));
}
