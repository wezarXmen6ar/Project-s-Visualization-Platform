import type { DatabaseSync } from 'node:sqlite';
import { engagementStatus, todayLocal, type ISODate } from '../../shared/calendar';
import type { MessageKey } from '../../shared/i18n/en';
import { translate } from '../../shared/i18n/translate';
import type { Params, ReasonParam } from '../../shared/i18n/types';
import type { LeaveData, ResourceData, ValidationIssue } from '../../shared/schemas';
import type { Employment, LeaveRecord, PersonProject, ResourceRecord, Residence, Side, Specialisation } from '../../shared/types';
import { transaction } from '../db';
import { getListValue } from '../lists/repo';
import { getMe, setMe } from '../settings';

interface ResourceRow {
  id: number;
  name: string;
  side: Side;
  employment: Employment;
  role_id: number | null;
  specialisation: Specialisation | null;
  email: string | null;
  phone: string | null;
  capacity: number;
  active: number;
  company_id: number | null;
  engagement_project_id: number | null;
  engagement_start: string | null;
  engagement_end: string | null;
  residence: Residence | null;
}

interface LeaveRow {
  id: number;
  resource_id: number;
  start_date: string;
  end_date: string;
  note: string | null;
}

/** Columns written from ResourceData, in the same order as resourceValues(). */
const COLUMNS = [
  'name', 'side', 'employment', 'role_id', 'specialisation', 'email', 'phone', 'capacity', 'active', 'company_id',
  'engagement_project_id', 'engagement_start', 'engagement_end', 'residence',
];

function resourceValues(r: ResourceData) {
  return [
    r.name, r.side, r.employment, r.roleId, r.specialisation, r.email, r.phone, r.capacity, r.active ? 1 : 0,
    r.companyId, r.engagementProjectId, r.engagementStart, r.engagementEnd, r.residence,
  ];
}

/**
 * What still points at a person, each with the reason shown when deleting is refused. A person in use can be made
 * inactive but not deleted, so history keeps their name. Later features add their own entries here.
 * `sideChange` marks the entries that also block switching sides; to-dos are allowed on either side, so they don't.
 */
const USAGE: { sql: string; key: MessageKey; sideChange: boolean }[] = [
  {
    sql: 'SELECT COUNT(*) AS n FROM projects WHERE ? IN (project_manager_id, business_pm_id)',
    key: 'error.reasonPmOnProjects',
    sideChange: true,
  },
  {
    sql: 'SELECT COUNT(*) AS n FROM assignments WHERE resource_id = ?',
    key: 'error.reasonAssignedPhases',
    sideChange: true,
  },
  {
    sql: 'SELECT COUNT(*) AS n FROM todos WHERE assignee_id = ?',
    key: 'error.reasonHasTodos',
    sideChange: false,
  },
  {
    sql: 'SELECT COUNT(*) AS n FROM person_documents WHERE resource_id = ?',
    key: 'error.reasonHasDocuments',
    sideChange: false,
  },
  {
    sql: 'SELECT COUNT(*) AS n FROM person_accounts WHERE resource_id = ?',
    key: 'error.reasonHasAccounts',
    sideChange: true,
  },
  {
    sql: 'SELECT COUNT(*) AS n FROM entry_attendees WHERE resource_id = ?',
    key: 'error.reasonAttendedMeetings',
    sideChange: false,
  },
];

function toLeave(row: LeaveRow): LeaveRecord {
  return { id: row.id, start: row.start_date, end: row.end_date, note: row.note };
}

function roleNames(db: DatabaseSync): Map<number, string> {
  const rows = db.prepare("SELECT id, name FROM list_values WHERE list = 'role'").all() as unknown as { id: number; name: string }[];
  return new Map(rows.map((r) => [r.id, r.name]));
}

function companyNames(db: DatabaseSync): Map<number, string> {
  const rows = db.prepare("SELECT id, name FROM list_values WHERE list = 'company'").all() as unknown as { id: number; name: string }[];
  return new Map(rows.map((r) => [r.id, r.name]));
}

function projectNames(db: DatabaseSync): Map<number, string> {
  const rows = db.prepare('SELECT id, name FROM projects').all() as unknown as { id: number; name: string }[];
  return new Map(rows.map((r) => [r.id, r.name]));
}

interface ProjectLinkRow {
  resource_id: number;
  project_id: number;
  project_name: string;
  /** null when a PM's project has no phases yet — always current then. */
  end_date: string | null;
}

/** Every (resource, project) an assignment ties them to, ended at the latest phase they're assigned to in it. */
const ASSIGNMENT_LINKS_SQL = `
  SELECT a.resource_id AS resource_id, ph.project_id AS project_id, p.name AS project_name, MAX(ph.planned_end) AS end_date
  FROM assignments a
  JOIN phases ph ON ph.id = a.phase_id
  JOIN projects p ON p.id = ph.project_id
  GROUP BY a.resource_id, ph.project_id, p.name
`;

/** Every (resource, project) a tech or business PM link ties them to, ended at the project's last phase. */
const PM_LINKS_SQL = `
  SELECT r.id AS resource_id, p.id AS project_id, p.name AS project_name, MAX(ph.planned_end) AS end_date
  FROM projects p
  JOIN resources r ON r.id = p.project_manager_id OR r.id = p.business_pm_id
  LEFT JOIN phases ph ON ph.project_id = p.id
  GROUP BY r.id, p.id, p.name
`;

/** A project with no phases (null end date) has no end, so it always outranks any dated link. */
function laterEnd(a: string | null, b: string | null): boolean {
  if (a === null) return true;
  if (b === null) return false;
  return a > b;
}

/** Folds one person's links into the projects they are "on", per the rule in shared/types.ts. */
function foldProjects(links: ProjectLinkRow[], today: ISODate): PersonProject[] {
  const current = links
    .filter((l) => l.end_date === null || l.end_date >= today)
    .map((l) => ({ id: l.project_id, name: l.project_name, finished: false }))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (current.length > 0) return current;
  if (links.length === 0) return [];
  // None are current, so every link here has a real end date (a null end is always current, above).
  const finished = links as (ProjectLinkRow & { end_date: string })[];
  const mostRecent = [...finished].sort((a, b) => b.end_date.localeCompare(a.end_date) || a.project_name.localeCompare(b.project_name))[0];
  return [{ id: mostRecent.project_id, name: mostRecent.project_name, finished: true }];
}

/** Every project each person is on, per resource id. See PersonProject for the rule. */
function projectsByResource(db: DatabaseSync, today: ISODate): Map<number, PersonProject[]> {
  const rows = [
    ...(db.prepare(ASSIGNMENT_LINKS_SQL).all() as unknown as ProjectLinkRow[]),
    ...(db.prepare(PM_LINKS_SQL).all() as unknown as ProjectLinkRow[]),
  ];
  // A project a person is both assigned to and a PM of appears once, keeping whichever link ends later — so it
  // is current if either link is.
  const byResource = new Map<number, Map<number, ProjectLinkRow>>();
  for (const row of rows) {
    const projects = byResource.get(row.resource_id) ?? new Map<number, ProjectLinkRow>();
    const existing = projects.get(row.project_id);
    if (!existing || laterEnd(row.end_date, existing.end_date)) projects.set(row.project_id, row);
    byResource.set(row.resource_id, projects);
  }
  const result = new Map<number, PersonProject[]>();
  for (const [resourceId, projects] of byResource) {
    result.set(resourceId, foldProjects([...projects.values()], today));
  }
  return result;
}

function toResource(
  row: ResourceRow, roles: Map<number, string>, companies: Map<number, string>, projects2: Map<number, string>,
  leave: LeaveRecord[], projects: PersonProject[], today: ISODate,
): ResourceRecord {
  const roleName = row.role_id === null ? undefined : roles.get(row.role_id);
  const companyName = row.company_id === null ? undefined : companies.get(row.company_id);
  const engagementProjectName = row.engagement_project_id === null ? undefined : projects2.get(row.engagement_project_id);
  return {
    id: row.id,
    name: row.name,
    side: row.side,
    employment: row.employment,
    role: row.role_id !== null && roleName !== undefined ? { id: row.role_id, name: roleName } : null,
    specialisation: row.specialisation,
    email: row.email,
    phone: row.phone,
    capacity: row.capacity,
    active: row.active === 1,
    company: row.company_id !== null && companyName !== undefined ? { id: row.company_id, name: companyName } : null,
    engagementProject:
      row.engagement_project_id !== null && engagementProjectName !== undefined
        ? { id: row.engagement_project_id, name: engagementProjectName }
        : null,
    engagementStart: row.engagement_start,
    engagementEnd: row.engagement_end,
    engagement: row.employment === 'outsourced' ? engagementStatus(row.engagement_start, row.engagement_end, today) : null,
    residence: row.side === 'tech' ? row.residence : null,
    leave,
    projects,
  };
}

/** The tech team first, then business contacts, each by name (ignoring case). `today` fixes what "current" means. */
export function listResources(db: DatabaseSync, today: ISODate = todayLocal()): ResourceRecord[] {
  const rows = db
    .prepare("SELECT * FROM resources ORDER BY CASE side WHEN 'tech' THEN 0 ELSE 1 END, name COLLATE NOCASE, id")
    .all() as unknown as ResourceRow[];
  const leave = new Map<number, LeaveRecord[]>();
  for (const l of db.prepare('SELECT * FROM leave ORDER BY start_date, id').all() as unknown as LeaveRow[]) {
    leave.set(l.resource_id, [...(leave.get(l.resource_id) ?? []), toLeave(l)]);
  }
  const roles = roleNames(db);
  const companies = companyNames(db);
  const projectNamesById = projectNames(db);
  const projects = projectsByResource(db, today);
  return rows.map((r) =>
    toResource(r, roles, companies, projectNamesById, leave.get(r.id) ?? [], projects.get(r.id) ?? [], today));
}

export function getResource(db: DatabaseSync, id: number, today: ISODate = todayLocal()): ResourceRecord | undefined {
  const row = db.prepare('SELECT * FROM resources WHERE id = ?').get(id) as unknown as ResourceRow | undefined;
  if (!row) return undefined;
  const leave = (db.prepare('SELECT * FROM leave WHERE resource_id = ? ORDER BY start_date, id').all(id) as unknown as LeaveRow[])
    .map(toLeave);
  const projects = projectsByResource(db, today).get(id) ?? [];
  return toResource(row, roleNames(db), companyNames(db), projectNames(db), leave, projects, today);
}

/** A chosen role must exist in the role list; a chosen company must exist in the Companies list; a chosen
 * engagement project must exist. */
export function checkResourceRefs(db: DatabaseSync, r: ResourceData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (r.roleId !== null && getListValue(db, r.roleId)?.list !== 'role') {
    issues.push({ path: 'roleId', message: translate('en', 'error.unknownRole'), code: 'error.unknownRole' });
  }
  if (r.companyId !== null && getListValue(db, r.companyId)?.list !== 'company') {
    issues.push({ path: 'companyId', message: translate('en', 'error.unknownCompany'), code: 'error.unknownCompany' });
  }
  if (r.engagementProjectId !== null && !db.prepare('SELECT id FROM projects WHERE id = ?').get(r.engagementProjectId)) {
    issues.push({
      path: 'engagementProjectId', message: translate('en', 'error.unknownEngagementProject'), code: 'error.unknownEngagementProject',
    });
  }
  return issues;
}

export function createResource(db: DatabaseSync, r: ResourceData, today: ISODate = todayLocal()): ResourceRecord {
  const res = db
    .prepare(`INSERT INTO resources (${COLUMNS.join(', ')}) VALUES (${COLUMNS.map(() => '?').join(', ')})`)
    .run(...resourceValues(r));
  return getResource(db, Number(res.lastInsertRowid), today)!;
}

/** Returns undefined when the person does not exist. */
export function updateResource(db: DatabaseSync, id: number, r: ResourceData, today: ISODate = todayLocal()): ResourceRecord | undefined {
  const res = db
    .prepare(`UPDATE resources SET ${COLUMNS.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`)
    .run(...resourceValues(r), id);
  return Number(res.changes) === 0 ? undefined : getResource(db, id, today);
}

/** All USAGE entries by default; pass a filter to consider only some, e.g. side-change entries. */
function usageReasons(db: DatabaseSync, id: number, filter: (u: (typeof USAGE)[number]) => boolean = () => true): ReasonParam[] {
  return USAGE.filter(filter).flatMap(({ sql, key }) => {
    const { n } = db.prepare(sql).get(id) as unknown as { n: number };
    return n > 0 ? [{ code: key, count: n }] : [];
  });
}

export type ResourceDelete = { ok: true } | { ok: false; status: 404 | 409; error: string; code?: MessageKey; params?: Params };

export function deleteResource(db: DatabaseSync, id: number): ResourceDelete {
  const person = getResource(db, id);
  if (!person) return { ok: false, status: 404, error: translate('en', 'error.personNotFound'), code: 'error.personNotFound' };
  const reasons = usageReasons(db, id);
  if (reasons.length > 0) {
    const params: Params = { name: person.name, reasons };
    return {
      ok: false,
      status: 409,
      error: translate('en', 'error.personInUseDelete', params),
      code: 'error.personInUseDelete',
      params,
    };
  }
  // Read whether they were "I am" before the delete: resources.id isn't AUTOINCREMENT, so once they're gone, a
  // reused id could otherwise leave a stale "I am" pointing at whoever gets that id next.
  transaction(db, () => {
    const wasMe = getMe(db).resourceId === id;
    db.prepare('DELETE FROM resources WHERE id = ?').run(id);
    if (wasMe) setMe(db, null);
  });
  return { ok: true };
}

export type ResourceUpdate =
  | { ok: true; resource: ResourceRecord }
  | { ok: false; status: 404 | 409; error: string; code?: MessageKey; params?: Params };

/**
 * Switching side while in use (a PM on a project, or assigned to a phase) would leave that project or phase pointing
 * at someone on the wrong side, so it is refused the same way a delete of someone in use is refused. To-dos are
 * allowed on either side, so they don't block a side change.
 */
export function updateResourceChecked(db: DatabaseSync, id: number, r: ResourceData, today: ISODate = todayLocal()): ResourceUpdate {
  const person = getResource(db, id);
  if (!person) return { ok: false, status: 404, error: translate('en', 'error.personNotFound'), code: 'error.personNotFound' };
  if (r.side !== person.side) {
    const reasons = usageReasons(db, id, (u) => u.sideChange);
    if (reasons.length > 0) {
      const params: Params = { name: person.name, reasons };
      return {
        ok: false,
        status: 409,
        error: translate('en', 'error.personInUseSideChange', params),
        code: 'error.personInUseSideChange',
        params,
      };
    }
  }
  return { ok: true, resource: updateResource(db, id, r, today)! };
}

/** Returns undefined when the person does not exist. */
export function addLeave(db: DatabaseSync, resourceId: number, l: LeaveData): LeaveRecord | undefined {
  if (!db.prepare('SELECT id FROM resources WHERE id = ?').get(resourceId)) return undefined;
  const res = db
    .prepare('INSERT INTO leave (resource_id, start_date, end_date, note) VALUES (?, ?, ?, ?)')
    .run(resourceId, l.start, l.end, l.note);
  return toLeave(db.prepare('SELECT * FROM leave WHERE id = ?').get(Number(res.lastInsertRowid)) as unknown as LeaveRow);
}

/** Returns false when there was no such leave. */
export function deleteLeave(db: DatabaseSync, id: number): boolean {
  return Number(db.prepare('DELETE FROM leave WHERE id = ?').run(id).changes) > 0;
}
