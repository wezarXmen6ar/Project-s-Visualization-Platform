import { DatabaseSync } from 'node:sqlite';

/** Each entry is one schema version. Never edit a shipped migration — append a new one. */
export const MIGRATIONS: string[] = [
  `
  CREATE TABLE projects (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    jira_key TEXT,
    color TEXT NOT NULL,
    start_date TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE phases (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    duration_days INTEGER NOT NULL,
    planned_start TEXT NOT NULL,
    planned_end TEXT NOT NULL
  );
  CREATE INDEX phases_project ON phases(project_id);
  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
  `
  CREATE TABLE list_values (
    id INTEGER PRIMARY KEY,
    list TEXT NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL
  );
  CREATE UNIQUE INDEX list_values_name ON list_values(list, name COLLATE NOCASE);
  INSERT INTO list_values (list, name, sort_order) VALUES
    ('projectType', 'Criminal', 0),
    ('projectType', 'Customer', 1),
    ('projectType', 'Management', 2),
    ('goal', 'Digitalisation of internal operations', 0);

  ALTER TABLE projects ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium';
  ALTER TABLE projects ADD COLUMN project_manager TEXT;
  ALTER TABLE projects ADD COLUMN business_owner TEXT;
  ALTER TABLE projects ADD COLUMN main_project_id INTEGER REFERENCES list_values(id);
  ALTER TABLE projects ADD COLUMN category TEXT;
  ALTER TABLE projects ADD COLUMN project_type_id INTEGER REFERENCES list_values(id);
  ALTER TABLE projects ADD COLUMN goal_id INTEGER REFERENCES list_values(id);
  ALTER TABLE projects ADD COLUMN department_id INTEGER REFERENCES list_values(id);
  ALTER TABLE projects ADD COLUMN requester_internal INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE projects ADD COLUMN requester_external INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE projects ADD COLUMN beneficiary_employees INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE projects ADD COLUMN beneficiary_customers INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE projects ADD COLUMN background TEXT NOT NULL DEFAULT '';
  ALTER TABLE projects ADD COLUMN summary TEXT NOT NULL DEFAULT '';

  CREATE TABLE scope_items (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    text TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    date_added TEXT NOT NULL
  );
  CREATE INDEX scope_items_project ON scope_items(project_id);
  `,
  `
  ALTER TABLE projects ADD COLUMN business_pm_name TEXT;
  ALTER TABLE projects ADD COLUMN business_pm_phone TEXT;
  ALTER TABLE projects ADD COLUMN business_pm_email TEXT;
  ALTER TABLE projects DROP COLUMN business_owner;
  `,
  `
  INSERT INTO list_values (list, name, sort_order) VALUES
    ('phase', 'Requirements gathering', 0),
    ('phase', 'Business analysis', 1),
    ('phase', 'Development plan', 2),
    ('phase', 'Development', 3),
    ('phase', 'QA', 4),
    ('phase', 'UAT', 5),
    ('phase', 'Security testing', 6),
    ('phase', 'Deployment', 7),
    ('phase', 'Launch', 8),
    ('phase', 'Design', 9);
  `,
];

/** Runs fn in a transaction. Inside an already-open transaction it just runs fn, so repo functions can be combined. */
export function transaction<T>(db: DatabaseSync, fn: () => T): T {
  if (db.isTransaction) return fn();
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function migrate(db: DatabaseSync): void {
  const row = db.prepare('PRAGMA user_version').get() as unknown as { user_version: number };
  for (let version = row.user_version; version < MIGRATIONS.length; version++) {
    transaction(db, () => {
      db.exec(MIGRATIONS[version]);
      db.exec(`PRAGMA user_version = ${version + 1}`);
    });
  }
}

export function openDb(file: string): DatabaseSync {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON');
  migrate(db);
  return db;
}
