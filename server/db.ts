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
  `
  CREATE TABLE assignments (
    id INTEGER PRIMARY KEY,
    phase_id INTEGER NOT NULL REFERENCES phases(id) ON DELETE CASCADE,
    resource_id INTEGER NOT NULL REFERENCES resources(id),
    allocation INTEGER NOT NULL,
    role TEXT NOT NULL
  );
  CREATE INDEX assignments_phase ON assignments(phase_id);
  CREATE INDEX assignments_resource ON assignments(resource_id);

  CREATE TABLE events (
    id INTEGER PRIMARY KEY,
    type TEXT NOT NULL,
    effective_date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    resource_id INTEGER REFERENCES resources(id) ON DELETE CASCADE,
    week_start TEXT,
    decision TEXT,
    note TEXT
  );
  CREATE INDEX events_type ON events(type);
  `,
  `
  ALTER TABLE phases ADD COLUMN parent_id INTEGER REFERENCES phases(id) ON DELETE CASCADE;
  ALTER TABLE phases ADD COLUMN with_previous INTEGER NOT NULL DEFAULT 0;
  CREATE INDEX phases_parent ON phases(parent_id);
  `,
  `
  CREATE TABLE todos (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    note TEXT,
    assignee_id INTEGER REFERENCES resources(id),
    due_date TEXT,
    phase_id INTEGER REFERENCES phases(id) ON DELETE SET NULL,
    done_date TEXT,
    former_phase TEXT,
    former_phase_removed_on TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX todos_project ON todos(project_id);
  CREATE INDEX todos_assignee ON todos(assignee_id);
  `,
  `
  CREATE TABLE starter_todos (
    id INTEGER PRIMARY KEY,
    phase_list_id INTEGER NOT NULL REFERENCES list_values(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    sort_order INTEGER NOT NULL
  );
  CREATE INDEX starter_todos_phase ON starter_todos(phase_list_id);
  `,
  `
  ALTER TABLE list_values ADD COLUMN name_ar TEXT;
  UPDATE list_values SET name_ar = CASE list || '|' || name COLLATE NOCASE
    WHEN 'phase|Requirements gathering' THEN 'جمع المتطلبات'
    WHEN 'phase|Business analysis' THEN 'التحليل'
    WHEN 'phase|Development plan' THEN 'خطة التطوير'
    WHEN 'phase|Design' THEN 'التصميم'
    WHEN 'phase|Development' THEN 'التطوير'
    WHEN 'phase|QA' THEN 'ضمان الجودة (QA)'
    WHEN 'phase|UAT' THEN 'اختبار قبول المستخدم (UAT)'
    WHEN 'phase|Security testing' THEN 'اختبار أمن المعلومات'
    WHEN 'phase|Deployment' THEN 'النشر'
    WHEN 'phase|Launch' THEN 'الإطلاق'
    WHEN 'phase|Go-live' THEN 'الإطلاق'
    WHEN 'role|Project manager' THEN 'مدير المشروع'
    WHEN 'role|Tech lead' THEN 'قائد الفريق التقني'
    WHEN 'role|Business analyst' THEN 'محلل الأعمال'
    WHEN 'role|Developer' THEN 'مطوّر'
    WHEN 'role|Designer' THEN 'مصمم'
    WHEN 'role|QA' THEN 'مختبِر جودة (QA)'
    WHEN 'role|DB engineer' THEN 'مهندس قواعد البيانات'
    WHEN 'role|InfoSec' THEN 'أمن المعلومات'
    WHEN 'projectType|Criminal' THEN 'جنائي'
    WHEN 'projectType|Customer' THEN 'الجمهور'
    WHEN 'projectType|Management' THEN 'إداري'
    WHEN 'goal|Digitalisation of internal operations' THEN 'رقمنة العمليات الداخلية'
  END WHERE name_ar IS NULL;
  `,
  `
  ALTER TABLE todos ADD COLUMN former_phase_top TEXT;
  ALTER TABLE todos ADD COLUMN former_phase_sub TEXT;
  UPDATE todos SET
    former_phase_top = CASE WHEN instr(former_phase, ' › ') = 0 THEN former_phase
      ELSE substr(former_phase, 1, instr(former_phase, ' › ') - 1) END,
    former_phase_sub = CASE WHEN instr(former_phase, ' › ') = 0 THEN NULL
      ELSE substr(former_phase, instr(former_phase, ' › ') + 3) END
  WHERE former_phase IS NOT NULL;
  `,
  `
  CREATE TABLE entries (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    phase_id INTEGER REFERENCES phases(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('meeting', 'update')),
    effective_date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    highlight INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX entries_project ON entries(project_id, effective_date);
  CREATE TABLE entry_attendees (
    entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    resource_id INTEGER NOT NULL REFERENCES resources(id),
    PRIMARY KEY (entry_id, resource_id)
  );
  ALTER TABLE todos ADD COLUMN source_entry_id INTEGER REFERENCES entries(id) ON DELETE SET NULL;
  `,
  `
  CREATE TABLE attachments (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    phase_id INTEGER REFERENCES phases(id) ON DELETE SET NULL,
    entry_id INTEGER REFERENCES entries(id) ON DELETE SET NULL,
    type_id INTEGER REFERENCES list_values(id),
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL UNIQUE,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    document_date TEXT,
    uploaded_at TEXT NOT NULL
  );
  CREATE INDEX attachments_project ON attachments(project_id);
  INSERT INTO list_values (list, name, name_ar, sort_order) VALUES
    ('attachmentType', 'Meeting Minutes', 'محضر اجتماع', 0),
    ('attachmentType', 'Approval', 'اعتماد', 1),
    ('attachmentType', 'Change Request', 'Change Request', 2),
    ('attachmentType', 'Business Analysis Document', 'الدراسة التحليلية', 3),
    ('attachmentType', 'BRD', 'وثيقة متطلبات الأعمال (BRD)', 4),
    ('attachmentType', 'Documentation', 'وثائق المشروع', 5),
    ('attachmentType', 'Design', 'التصميم', 6),
    ('attachmentType', 'Test Report', 'تقرير الاختبار', 7),
    ('attachmentType', 'Contract', 'العقد', 8),
    ('attachmentType', 'Other', 'أخرى', 9);
  `,
  `
  ALTER TABLE resources ADD COLUMN employment TEXT NOT NULL DEFAULT 'staff' CHECK (employment IN ('staff', 'outsourced'));
  ALTER TABLE resources ADD COLUMN company_id INTEGER REFERENCES list_values(id);
  ALTER TABLE resources ADD COLUMN engagement_project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL;
  ALTER TABLE resources ADD COLUMN engagement_start TEXT;
  ALTER TABLE resources ADD COLUMN engagement_end TEXT;
  `,
  `
  CREATE TABLE entry_guests (
    id INTEGER PRIMARY KEY,
    entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX entry_guests_entry ON entry_guests(entry_id);
  `,
  `
  CREATE TABLE person_documents (
    id INTEGER PRIMARY KEY,
    resource_id INTEGER NOT NULL REFERENCES resources(id),
    type_id INTEGER REFERENCES list_values(id),
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL UNIQUE,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    expiry_date TEXT,
    note TEXT,
    uploaded_at TEXT NOT NULL
  );
  CREATE INDEX person_documents_resource ON person_documents(resource_id);
  INSERT INTO list_values (list, name, name_ar, sort_order) VALUES
    ('personDocumentType', 'NDA', 'وثيقة عدم الإفصاح', 0),
    ('personDocumentType', 'Police clearance', 'شهادة بحث الحالة الجنائية', 1),
    ('personDocumentType', 'UAE ID', 'الهوية الإماراتية', 2),
    ('personDocumentType', 'Passport', 'جواز السفر', 3),
    ('personDocumentType', 'Company contract', 'عقد الشركة', 4),
    ('personDocumentType', 'Information Security Approval', 'موافقة أمن المعلومات', 5),
    ('personDocumentType', 'Other', 'أخرى', 6);

  ALTER TABLE resources ADD COLUMN residence TEXT CHECK (residence IN ('uae', 'abroad'));
  CREATE TABLE person_accounts (
    id INTEGER PRIMARY KEY,
    resource_id INTEGER NOT NULL REFERENCES resources(id),
    type_id INTEGER REFERENCES list_values(id),
    expiry_date TEXT NOT NULL,
    remind_days INTEGER NOT NULL DEFAULT 30 CHECK (remind_days BETWEEN 1 AND 365),
    note TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX person_accounts_resource ON person_accounts(resource_id);
  INSERT INTO list_values (list, name, name_ar, sort_order) VALUES
    ('accountType', 'Network account', 'أحقية الشبكة', 0),
    ('accountType', 'Email', 'البريد الإلكتروني', 1),
    ('accountType', 'VPN', 'VPN', 2),
    ('accountType', 'Jira', 'Jira', 3),
    ('accountType', 'Other', 'أخرى', 4);
  `,
  `
  CREATE TABLE key_dates (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    type_id INTEGER REFERENCES list_values(id),
    attachment_id INTEGER REFERENCES attachments(id) ON DELETE SET NULL,
    date TEXT NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX key_dates_project ON key_dates(project_id);
  INSERT INTO list_values (list, name, name_ar, sort_order) VALUES
    ('keyDateType', 'Contract end', 'انتهاء العقد', 0),
    ('keyDateType', 'License expiry', 'انتهاء الترخيص', 1),
    ('keyDateType', 'Development end', 'انتهاء التطوير', 2),
    ('keyDateType', 'Warranty end', 'انتهاء الضمان', 3),
    ('keyDateType', 'Support end', 'انتهاء الدعم الفني', 4),
    ('keyDateType', 'Other', 'أخرى', 5);
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
