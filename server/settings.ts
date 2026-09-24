import type { DatabaseSync } from 'node:sqlite';
import { DEFAULT_CALENDAR, type WorkCalendar } from '../shared/calendar';

export function getCalendar(db: DatabaseSync): WorkCalendar {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'calendar'").get() as unknown as { value: string } | undefined;
  return row ? (JSON.parse(row.value) as WorkCalendar) : DEFAULT_CALENDAR;
}

export function setCalendar(db: DatabaseSync, cal: WorkCalendar): void {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES ('calendar', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(JSON.stringify(cal));
}
