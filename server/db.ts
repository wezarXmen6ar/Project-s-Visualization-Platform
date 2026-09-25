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
  `
  INSERT INTO list_values (list, name, sort_order) VALUES
    ('role', 'Project manager', 0),
    ('role', 'Tech lead', 1),
    ('role', 'Business analyst', 2),
    ('role', 'Developer', 3),
    ('role', 'Designer', 4),
    ('role', 'QA', 5),
    ('role', 'DB engineer', 6),
    ('role', 'InfoSec', 7);

  CREATE TABLE resources (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    side TEXT NOT NULL,
    role_id INTEGER REFERENCES list_values(id),
    specialisation TEXT,
    email TEXT,
    phone TEXT,
    capacity INTEGER NOT NULL DEFAULT 100,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE leave (
    id INTEGER PRIMARY KEY,
    resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    note TEXT
  );
  CREATE INDEX leave_resource ON leave(resource_id);
  `,
  `
  ALTER TABLE projects ADD COLUMN project_manager_id INTEGER REFERENCES resources(id);
  ALTER TABLE projects ADD COLUMN business_pm_id INTEGER REFERENCES resources(id);

  INSERT INTO resources (name, side, role_id, capacity, active)
    SELECT DISTINCT trim(project_manager), 'tech',
      (SELECT id FROM list_values WHERE list = 'role' AND name = 'Project manager'), 100, 1
    FROM projects
    WHERE trim(COALESCE(project_manager, '')) <> ''
      AND trim(project_manager) NOT IN (SELECT name FROM resources WHERE side = 'tech');
  UPDATE projects
    SET project_manager_id = (SELECT id FROM resources r WHERE r.side = 'tech' AND r.name = trim(projects.project_manager) ORDER BY id LIMIT 1)
    WHERE trim(COALESCE(project_manager, '')) <> '';

  INSERT INTO resources (name, side, phone, email, capacity, active)
    SELECT trim(business_pm_name), 'business', MAX(business_pm_phone), MAX(business_pm_email), 100, 1
    FROM projects
    WHERE trim(COALESCE(business_pm_name, '')) <> ''
      AND trim(business_pm_name) NOT IN (SELECT name FROM resources WHERE side = 'business')
    GROUP BY trim(business_pm_name);
  UPDATE projects
    SET business_pm_id = (SELECT id FROM resources r WHERE r.side = 'business' AND r.name = trim(projects.business_pm_name) ORDER BY id LIMIT 1)
    WHERE trim(COALESCE(business_pm_name, '')) <> '';

  ALTER TABLE projects DROP COLUMN project_manager;
  ALTER TABLE projects DROP COLUMN business_pm_name;
  ALTER TABLE projects DROP COLUMN business_pm_phone;
  ALTER TABLE projects DROP COLUMN business_pm_email;
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
