import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_CALENDAR } from '../shared/calendar';
import { newProjectSchema } from '../shared/schemas';
import { backupIfDue, backupStatus } from './backup';
import { openDb } from './db';
import { createProject, listProjects } from './projects/repo';

describe('backup', () => {
  let dir: string;
  let db: DatabaseSync;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'pvp-backup-'));
    db = openDb(':memory:');
    createProject(
      db,
      DEFAULT_CALENDAR,
      newProjectSchema.parse({ name: 'Portal', color: '#3b82f6', startDate: '2026-10-05', phases: [{ name: 'A', durationDays: 5 }] }),
    );
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('writes one backup a day, as a real database', () => {
    const file = backupIfDue(db, dir, '2026-09-25');
    expect(file).toBe(join(dir, 'pm-2026-09-25.db'));
    expect(backupIfDue(db, dir, '2026-09-25')).toBeNull();
    const copy = openDb(file!);
    expect(listProjects(copy)).toHaveLength(1);
    copy.close();
  });

  it('keeps only the newest 14 and leaves other files alone', () => {
    for (let d = 1; d <= 16; d++) writeFileSync(join(dir, `pm-2026-09-${String(d).padStart(2, '0')}.db`), '');
    writeFileSync(join(dir, 'notes.txt'), 'keep me');
    backupIfDue(db, dir, '2026-09-17');
    const names = readdirSync(dir).sort();
    expect(names.filter((n) => n.startsWith('pm-'))).toHaveLength(14);
    expect(names).toContain('pm-2026-09-17.db');
    expect(names).not.toContain('pm-2026-09-03.db');
    expect(names).toContain('notes.txt');
  });

  it('reports the latest backup and the count', () => {
    expect(backupStatus(join(dir, 'missing'))).toEqual({ latest: null, count: 0 });
    backupIfDue(db, dir, '2026-09-25');
    expect(backupStatus(dir)).toEqual({ latest: '2026-09-25', count: 1 });
  });
});
