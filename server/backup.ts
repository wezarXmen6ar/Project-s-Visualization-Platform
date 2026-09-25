import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { isISODate, type ISODate } from '../shared/calendar';

export const KEEP_BACKUPS = 14;

export interface BackupStatus { latest: ISODate | null; count: number }

const BACKUP_RE = /^pm-\d{4}-\d{2}-\d{2}\.db$/;

/** "pm-YYYY-MM-DD.db" for a date already checked with isISODate. */
function fileFor(dir: string, date: ISODate): string {
  return join(dir, `pm-${date}.db`);
}

/** Doubles any ' in a path so it is safe inside a single-quoted SQL string literal. */
function sqlQuote(path: string): string {
  return path.replaceAll("'", "''");
}

function backupFiles(dir: string): string[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names.filter((n) => BACKUP_RE.test(n)).sort();
}

/** Takes today's backup if there isn't one yet, then keeps only the newest KEEP_BACKUPS. Returns the file written, or null. */
export function backupIfDue(db: DatabaseSync, dir: string, today: ISODate): string | null {
  if (!isISODate(today)) throw new Error(`Not an ISO date: ${today}`);
  mkdirSync(dir, { recursive: true });
  const target = fileFor(dir, today);
  const already = backupFiles(dir).includes(`pm-${today}.db`);
  let written: string | null = null;
  if (!already) {
    db.exec(`VACUUM INTO '${sqlQuote(target)}'`);
    written = target;
  }
  const names = backupFiles(dir);
  const toRemove = names.slice(0, Math.max(0, names.length - KEEP_BACKUPS));
  for (const name of toRemove) rmSync(join(dir, name), { force: true });
  return written;
}

/** Reports the newest backup's date and how many are kept. { latest: null, count: 0 } if the folder is missing. */
export function backupStatus(dir: string): BackupStatus {
  const names = backupFiles(dir);
  if (names.length === 0) return { latest: null, count: 0 };
  const newest = names[names.length - 1];
  const latest = newest.slice(3, 13);
  return { latest, count: names.length };
}
