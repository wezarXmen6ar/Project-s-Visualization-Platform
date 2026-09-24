import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { MIGRATIONS, migrate } from './db';

describe('migrate', () => {
  it('upgrades a version-1 database and keeps its projects', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(MIGRATIONS[0]);
    db.exec('PRAGMA user_version = 1');
    db.prepare(
      "INSERT INTO projects (name, jira_key, color, start_date, created_at) VALUES ('Old', NULL, '#000000', '2026-01-05', 'x')",
    ).run();

    migrate(db);

    const version = db.prepare('PRAGMA user_version').get() as unknown as { user_version: number };
    expect(version.user_version).toBe(MIGRATIONS.length);
    const row = db
      .prepare('SELECT name, priority, background, summary, requester_internal, main_project_id FROM projects')
      .get();
    expect({ ...row }).toEqual({
      name: 'Old', priority: 'medium', background: '', summary: '', requester_internal: 0, main_project_id: null,
    });
  });
});
