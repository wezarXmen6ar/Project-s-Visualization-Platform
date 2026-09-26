import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { MIGRATIONS, migrate, openDb, transaction } from './db';

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

  it('nests transactions: an error in the outer one also undoes the inner work', () => {
    const db = openDb(':memory:');
    expect(() =>
      transaction(db, () => {
        transaction(db, () => db.prepare("INSERT INTO settings (key, value) VALUES ('a', '1')").run());
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect({ ...db.prepare('SELECT COUNT(*) AS n FROM settings').get() }).toEqual({ n: 0 });
  });

  it('adds parent_id and with_previous to phases, from version 8 up', () => {
    const db = openDb(':memory:');
    const columns = (db.prepare('PRAGMA table_info(phases)').all() as unknown as { name: string }[]).map((c) => c.name);
    expect(columns).toEqual(expect.arrayContaining(['parent_id', 'with_previous']));
    const version = db.prepare('PRAGMA user_version').get() as unknown as { user_version: number };
    expect(version.user_version).toBeGreaterThanOrEqual(8);
  });

  it('moves project manager names into Resources when upgrading from version 5', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    for (const m of MIGRATIONS.slice(0, 5)) db.exec(m);
    db.exec('PRAGMA user_version = 5');
    const insert = db.prepare(
      "INSERT INTO projects (name, color, start_date, created_at, project_manager, business_pm_name, business_pm_phone, business_pm_email) VALUES (?, '#000000', '2026-01-05', 'x', ?, ?, ?, ?)",
    );
    insert.run('A', 'Sara Ahmed', 'Mariam', '+971 50 123 4567', null);
    insert.run('B', ' Sara Ahmed ', 'Mariam', null, 'mariam@example.com');
    insert.run('C', null, null, null, null);

    migrate(db);

    const people = db.prepare('SELECT name, side, phone, email FROM resources ORDER BY side DESC, name').all().map((r) => ({ ...r }));
    expect(people).toEqual([
      { name: 'Sara Ahmed', side: 'tech', phone: null, email: null },
      { name: 'Mariam', side: 'business', phone: '+971 50 123 4567', email: 'mariam@example.com' },
    ]);
    const pm = db.prepare("SELECT r.name AS role FROM resources p JOIN list_values r ON r.id = p.role_id WHERE p.side = 'tech'").get();
    expect({ ...pm }).toEqual({ role: 'Project manager' });
    const projects = db
      .prepare('SELECT name, project_manager_id IS NOT NULL AS pm, business_pm_id IS NOT NULL AS bpm FROM projects ORDER BY name')
      .all()
      .map((r) => ({ ...r }));
    expect(projects).toEqual([{ name: 'A', pm: 1, bpm: 1 }, { name: 'B', pm: 1, bpm: 1 }, { name: 'C', pm: 0, bpm: 0 }]);
  });

  it('fills the Arabic name for every default list value, leaves a custom one null, and stays a valid database', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    for (const m of MIGRATIONS.slice(0, 10)) db.exec(m);
    db.exec('PRAGMA user_version = 10');
    db.prepare("INSERT INTO list_values (list, name, sort_order) VALUES ('phase', 'Data migration', 10)").run();

    migrate(db);

    const nameAr = (list: string, name: string) =>
      (db.prepare('SELECT name_ar FROM list_values WHERE list = ? AND name = ? COLLATE NOCASE').get(list, name) as unknown as {
        name_ar: string | null;
      }).name_ar;

    expect(nameAr('phase', 'requirements gathering')).toBe('جمع المتطلبات');
    expect(nameAr('phase', 'Business analysis')).toBe('التحليل');
    expect(nameAr('phase', 'Development plan')).toBe('خطة التطوير');
    expect(nameAr('phase', 'Design')).toBe('التصميم');
    expect(nameAr('phase', 'Development')).toBe('التطوير');
    expect(nameAr('phase', 'QA')).toBe('ضمان الجودة (QA)');
    expect(nameAr('phase', 'UAT')).toBe('اختبار قبول المستخدم (UAT)');
    expect(nameAr('phase', 'Security testing')).toBe('اختبار أمن المعلومات');
    expect(nameAr('phase', 'Deployment')).toBe('النشر');
    expect(nameAr('phase', 'Launch')).toBe('الإطلاق');
    expect(nameAr('role', 'Project manager')).toBe('مدير المشروع');
    expect(nameAr('role', 'Tech lead')).toBe('قائد الفريق التقني');
    expect(nameAr('role', 'Business analyst')).toBe('محلل الأعمال');
    expect(nameAr('role', 'Developer')).toBe('مطوّر');
    expect(nameAr('role', 'Designer')).toBe('مصمم');
    expect(nameAr('role', 'QA')).toBe('مختبِر جودة (QA)');
    expect(nameAr('role', 'DB engineer')).toBe('مهندس قواعد البيانات');
    expect(nameAr('role', 'InfoSec')).toBe('أمن المعلومات');
    expect(nameAr('projectType', 'Criminal')).toBe('جنائي');
    expect(nameAr('projectType', 'Customer')).toBe('الجمهور');
    expect(nameAr('projectType', 'Management')).toBe('إداري');
    expect(nameAr('goal', 'Digitalisation of internal operations')).toBe('رقمنة العمليات الداخلية');
    expect(nameAr('phase', 'Data migration')).toBeNull();

    const check = db.prepare('PRAGMA integrity_check').get() as unknown as { integrity_check: string };
    expect(check.integrity_check).toBe('ok');
  });

  it('leaves a value the user already renamed before upgrading without an Arabic default (the name no longer matches)', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    for (const m of MIGRATIONS.slice(0, 10)) db.exec(m);
    db.exec('PRAGMA user_version = 10');
    db.prepare("UPDATE list_values SET name = 'Build' WHERE list = 'phase' AND name = 'Development'").run();

    migrate(db);

    const row = db.prepare("SELECT name_ar FROM list_values WHERE list = 'phase' AND name = 'Build'").get() as unknown as {
      name_ar: string | null;
    };
    expect(row.name_ar).toBeNull();
  });
  it('splits an existing former phase into its phase and sub-phase names on the first " › "', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    for (const m of MIGRATIONS.slice(0, 11)) db.exec(m);
    db.exec('PRAGMA user_version = 11');
    db.prepare("INSERT INTO projects (name, color, start_date, created_at) VALUES ('P', '#000000', '2026-01-05', 'x')").run();
    const add = db.prepare(
      "INSERT INTO todos (project_id, title, former_phase, former_phase_removed_on, created_at) VALUES (1, ?, ?, ?, 'x')",
    );
    add.run('sub', 'Development › Increment 1', '2026-09-25');
    add.run('top', 'QA', '2026-09-25');
    add.run('two', 'Design › Screens › Mobile', '2026-09-25');
    add.run('none', null, null);

    migrate(db);

    const rows = db.prepare('SELECT title, former_phase_top, former_phase_sub FROM todos ORDER BY id').all();
    expect(rows.map((r) => ({ ...r }))).toEqual([
      { title: 'sub', former_phase_top: 'Development', former_phase_sub: 'Increment 1' },
      { title: 'top', former_phase_top: 'QA', former_phase_sub: null },
      { title: 'two', former_phase_top: 'Design', former_phase_sub: 'Screens › Mobile' },
      { title: 'none', former_phase_top: null, former_phase_sub: null },
    ]);
  });

  it('adds entries, entry_attendees and source_entry_id, upgrading from version 12', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    for (const m of MIGRATIONS.slice(0, 12)) db.exec(m);
    db.exec('PRAGMA user_version = 12');
    db.prepare("INSERT INTO projects (name, color, start_date, created_at) VALUES ('P', '#000000', '2026-01-05', 'x')").run();
    db.prepare("INSERT INTO todos (project_id, title, created_at) VALUES (1, 'Task', 'x')").run();

    migrate(db);

    const version = db.prepare('PRAGMA user_version').get() as unknown as { user_version: number };
    expect(version.user_version).toBe(MIGRATIONS.length);
    const todoColumns = (db.prepare('PRAGMA table_info(todos)').all() as unknown as { name: string }[]).map((c) => c.name);
    expect(todoColumns).toContain('source_entry_id');
    const entriesColumns = (db.prepare('PRAGMA table_info(entries)').all() as unknown as { name: string }[]).map((c) => c.name);
    expect(entriesColumns).toEqual(
      expect.arrayContaining(['id', 'project_id', 'phase_id', 'type', 'effective_date', 'created_at', 'title', 'body', 'highlight']),
    );
    const check = db.prepare('PRAGMA integrity_check').get() as unknown as { integrity_check: string };
    expect(check.integrity_check).toBe('ok');
  });

  it('adds employment and engagement columns to resources, upgrading from version 14, and existing people become staff', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    for (const m of MIGRATIONS.slice(0, 14)) db.exec(m);
    db.exec('PRAGMA user_version = 14');
    db.prepare("INSERT INTO resources (name, side, capacity, active) VALUES ('Fatima Noor', 'tech', 100, 1)").run();

    migrate(db);

    const version = db.prepare('PRAGMA user_version').get() as unknown as { user_version: number };
    expect(version.user_version).toBe(MIGRATIONS.length);
    const columns = (db.prepare('PRAGMA table_info(resources)').all() as unknown as { name: string }[]).map((c) => c.name);
    expect(columns).toEqual(
      expect.arrayContaining(['employment', 'company_id', 'engagement_project_id', 'engagement_start', 'engagement_end']),
    );
    const row = db.prepare("SELECT employment, company_id, engagement_start, engagement_end FROM resources WHERE name = 'Fatima Noor'").get();
    expect({ ...row }).toEqual({ employment: 'staff', company_id: null, engagement_start: null, engagement_end: null });
    const check = db.prepare('PRAGMA integrity_check').get() as unknown as { integrity_check: string };
    expect(check.integrity_check).toBe('ok');
  });

  it('adds entry_guests, upgrading from version 15, and cascades on entry delete', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    for (const m of MIGRATIONS.slice(0, 15)) db.exec(m);
    db.exec('PRAGMA user_version = 15');
    db.prepare(
      "INSERT INTO projects (name, color, start_date, created_at) VALUES ('P', '#000000', '2026-01-05', 'x')",
    ).run();
    db.prepare(
      "INSERT INTO entries (project_id, type, effective_date, created_at, title) VALUES (1, 'meeting', '2026-09-26', 'x', 'Kickoff')",
    ).run();

    migrate(db);

    const version = db.prepare('PRAGMA user_version').get() as unknown as { user_version: number };
    expect(version.user_version).toBe(MIGRATIONS.length);
    const columns = (db.prepare('PRAGMA table_info(entry_guests)').all() as unknown as { name: string }[]).map((c) => c.name);
    expect(columns).toEqual(expect.arrayContaining(['id', 'entry_id', 'name', 'sort_order']));

    db.prepare("INSERT INTO entry_guests (entry_id, name, sort_order) VALUES (1, 'Visitor', 0)").run();
    db.prepare('DELETE FROM entries WHERE id = 1').run();
    expect(db.prepare('SELECT COUNT(*) AS n FROM entry_guests').get()).toEqual({ n: 0 });

    const check = db.prepare('PRAGMA integrity_check').get() as unknown as { integrity_check: string };
    expect(check.integrity_check).toBe('ok');
  });
});
