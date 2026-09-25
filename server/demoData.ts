import type { DatabaseSync } from 'node:sqlite';
import { todayLocal, type ISODate, type WorkCalendar } from '../shared/calendar';
import {
  leaveInputSchema, newProjectSchema, resourceInputSchema, starterToDoInputSchema, toDoInputSchema,
  type NewProjectInput,
} from '../shared/schemas';
import type { AssignmentRole, ListName, Side, Specialisation } from '../shared/types';
import { transaction } from './db';
import { addListValue } from './lists/repo';
import { createProject, getProject, listProjects } from './projects/repo';
import { addLeave, createResource } from './resources/repo';
import { setMe } from './settings';
import { addStarter } from './starters/repo';
import { checkToDo, createToDo } from './todos/repo';

/** A person the demo projects name; seedDemo adds them to Resources first. */
export interface DemoPerson {
  name: string;
  side: Side;
  role?: string;
  specialisation?: Specialisation;
  capacity?: number;
  email?: string;
  phone?: string;
}

export const DEMO_PEOPLE: DemoPerson[] = [
  { name: 'Sara Ahmed', side: 'tech', role: 'Project manager', email: 'sara.ahmed@example.com' },
  { name: 'Omar Haddad', side: 'tech', role: 'Project manager' },
  { name: 'Lina Karim', side: 'tech', role: 'Project manager' },
  { name: 'Yusuf Nasser', side: 'tech', role: 'Project manager' },
  { name: 'Khalid Al Mansoori', side: 'business' },
  { name: 'Mariam Al Suwaidi', side: 'business', phone: '+971 50 123 4567', email: 'mariam.alsuwaidi@example.com' },
  { name: 'Noura Al Hammadi', side: 'business', phone: '055 234 5678' },
  { name: 'Ahmed Al Zaabi', side: 'business', email: 'ahmed.alzaabi@example.com' },
  { name: 'Hassan Ali', side: 'tech', role: 'Tech lead', specialisation: 'full-stack', email: 'hassan.ali@example.com' },
  { name: 'Fatima Noor', side: 'tech', role: 'Developer', specialisation: 'front-end' },
  { name: 'Rami Saleh', side: 'tech', role: 'Developer', specialisation: 'back-end', capacity: 80 },
  { name: 'Aisha Khan', side: 'tech', role: 'Business analyst' },
  { name: 'Mei Chen', side: 'tech', role: 'Designer' },
  { name: 'Priya Das', side: 'tech', role: 'QA' },
  { name: 'Jonas Weber', side: 'tech', role: 'InfoSec' },
];

/** Leave booked for the demo team. */
export const DEMO_LEAVE: { person: string; start: string; end: string; note: string }[] = [
  { person: 'Fatima Noor', start: '2026-10-12', end: '2026-10-16', note: 'Annual leave' },
  { person: 'Jonas Weber', start: '2026-10-19', end: '2026-10-21', note: 'Training' },
];

/** A person on a demo phase or sub-phase, and how much of their week they give it. */
export interface TeamEntry {
  person: string;
  allocation: number;
  role: AssignmentRole;
}

/** Who works on each standard phase in the demo, and how much of their week. */
export const TEAM_BY_PHASE: Record<string, TeamEntry[]> = {
  'Requirements gathering': [{ person: 'Aisha Khan', allocation: 100, role: 'responsible' }],
  'Business analysis': [{ person: 'Aisha Khan', allocation: 100, role: 'responsible' }],
  'Development plan': [{ person: 'Hassan Ali', allocation: 50, role: 'responsible' }],
  Design: [{ person: 'Mei Chen', allocation: 100, role: 'responsible' }],
  Development: [
    { person: 'Hassan Ali', allocation: 30, role: 'responsible' },
    { person: 'Fatima Noor', allocation: 60, role: 'contributor' },
    { person: 'Rami Saleh', allocation: 60, role: 'contributor' },
  ],
  QA: [{ person: 'Priya Das', allocation: 100, role: 'responsible' }],
  UAT: [
    { person: 'Aisha Khan', allocation: 50, role: 'responsible' },
    { person: 'Priya Das', allocation: 30, role: 'contributor' },
  ],
  'Security testing': [{ person: 'Jonas Weber', allocation: 100, role: 'responsible' }],
  Deployment: [{ person: 'Hassan Ali', allocation: 50, role: 'responsible' }],
  Launch: [{ person: 'Hassan Ali', allocation: 30, role: 'responsible' }],
};

/** A demo sub-phase names its team by person; seedDemo turns the names into resource ids. */
export interface DemoSubPhase {
  name: string;
  durationDays: number;
  withPrevious?: boolean;
  team: TeamEntry[];
}

/**
 * A demo phase names its team by person. When `team` is omitted, `toProjectInput` falls back to
 * `TEAM_BY_PHASE[name]`. `subPhases`, when given, replace the phase's single span with increments.
 */
export interface DemoPhase {
  name: string;
  durationDays: number;
  team?: TeamEntry[];
  subPhases?: DemoSubPhase[];
}

/** A demo project names its list values and people; seedDemo turns the names into ids. */
export type DemoProject = Omit<
  NewProjectInput,
  'mainProjectId' | 'projectTypeId' | 'goalId' | 'departmentId' | 'projectManagerId' | 'businessPmId' | 'phases'
> & {
  mainProject?: string;
  projectType?: string;
  goal?: string;
  department?: string;
  projectManager?: string;
  businessPm?: string;
  phases: DemoPhase[];
};

const DIGITALISATION = 'Digitalisation of internal operations';
const CUSTOMER_EXPERIENCE = 'Improve customer experience';

export const DEMO_PROJECTS: DemoProject[] = [
  {
    name: 'Legacy Archive Migration', jiraKey: 'PRJ-099', color: '#64748b', startDate: '2025-09-07',
    priority: 'low', projectManager: 'Omar Haddad', businessPm: 'Khalid Al Mansoori',
    mainProject: 'Records Modernisation', category: 'operational', projectType: 'Management',
    goal: DIGITALISATION, department: 'Records Office',
    requester: { internal: true, external: false }, beneficiary: { employees: true, customers: false },
    background: 'Paper and microfilm archives are stored off-site and take days to retrieve.',
    summary: 'Scan and index the archive and move it into the document management system.',
    scopeItems: [
      { kind: 'scope', text: 'Scan and index the 2010–2020 archive' },
      { kind: 'out-of-scope', text: 'Records older than 2010' },
      { kind: 'objective', text: 'Retrieve any archived record within one working day' },
    ],
    phases: [
      { name: 'Requirements gathering', durationDays: 10 },
      { name: 'Development', durationDays: 45 },
      { name: 'QA', durationDays: 10 },
      { name: 'Security testing', durationDays: 5 },
      { name: 'Launch', durationDays: 2 },
    ],
  },
  {
    name: 'Customer Portal Revamp', jiraKey: 'PRJ-101', color: '#2563eb', startDate: '2026-01-11',
    priority: 'high', projectManager: 'Sara Ahmed',
    businessPm: 'Mariam Al Suwaidi',
    mainProject: 'Digital Services', category: 'strategic', projectType: 'Customer',
    goal: CUSTOMER_EXPERIENCE, department: 'Customer Service',
    requester: { internal: true, external: true }, beneficiary: { employees: false, customers: true },
    background: 'The current portal is slow, not mobile friendly, and most requests still end in a phone call.',
    summary: 'Rebuild the customer portal with online payments and self-service tracking.',
    scopeItems: [
      { kind: 'scope', text: 'Online payments' },
      { kind: 'scope', text: 'Request tracking' },
      { kind: 'scope', text: 'Account profile page' },
      { kind: 'out-of-scope', text: 'Native mobile app (see E-Services Mobile App)' },
      { kind: 'problem', text: 'Customers cannot see the status of a request without calling' },
      { kind: 'problem', text: 'Payments are only accepted at the counter' },
      { kind: 'objective', text: 'Cut call-centre volume by 20%' },
      { kind: 'objective', text: 'Take 60% of payments online within a year' },
    ],
    phases: [
      { name: 'Requirements gathering', durationDays: 10 },
      { name: 'Business analysis', durationDays: 10 },
      { name: 'Development plan', durationDays: 5 },
      { name: 'Design', durationDays: 10 },
      { name: 'Development', durationDays: 45 },
      { name: 'QA', durationDays: 15 },
      { name: 'UAT', durationDays: 10 },
      { name: 'Security testing', durationDays: 5 },
      { name: 'Deployment', durationDays: 2 },
      { name: 'Launch', durationDays: 1 },
    ],
  },
  {
    name: 'HR Self-Service', jiraKey: 'PRJ-102', color: '#16a34a', startDate: '2026-02-01',
    priority: 'medium', projectManager: 'Lina Karim',
    businessPm: 'Noura Al Hammadi',
    category: 'operational', projectType: 'Management', goal: DIGITALISATION, department: 'Human Resources',
    requester: { internal: true, external: false }, beneficiary: { employees: true, customers: false },
    background: 'Leave requests and certificates are handled by email and paper forms.',
    summary: 'Let employees request leave and certificates online.',
    scopeItems: [
      { kind: 'scope', text: 'Leave requests and approvals' },
      { kind: 'scope', text: 'Salary certificate requests' },
      { kind: 'objective', text: 'No paper leave forms' },
    ],
    phases: [
      { name: 'Requirements gathering', durationDays: 8 },
      { name: 'Business analysis', durationDays: 8 },
      { name: 'Development plan', durationDays: 3 },
      { name: 'Development', durationDays: 37 },
      { name: 'QA', durationDays: 10 },
      { name: 'UAT', durationDays: 5 },
      { name: 'Launch', durationDays: 1 },
    ],
  },
  {
    name: 'Case Management System', jiraKey: 'PRJ-103', color: '#9333ea', startDate: '2026-03-15',
    priority: 'high', projectManager: 'Yusuf Nasser',
    businessPm: 'Ahmed Al Zaabi',
    mainProject: 'Records Modernisation', category: 'strategic', projectType: 'Criminal',
    goal: DIGITALISATION, department: 'Legal Affairs',
    requester: { internal: true, external: false }, beneficiary: { employees: true, customers: false },
    background: 'Case files are tracked in spreadsheets across three teams.',
    summary: 'One system for case intake, assignment, documents and deadlines.',
    scopeItems: [
      { kind: 'scope', text: 'Case intake and assignment' },
      { kind: 'scope', text: 'Document storage per case' },
      { kind: 'problem', text: 'Deadlines are missed because nobody sees the whole caseload' },
      { kind: 'objective', text: 'Every open case has an owner and a next deadline' },
    ],
    phases: [
      { name: 'Requirements gathering', durationDays: 15 },
      { name: 'Business analysis', durationDays: 15 },
      { name: 'Development plan', durationDays: 5 },
      { name: 'Design', durationDays: 10 },
      { name: 'Development', durationDays: 75 },
      { name: 'QA', durationDays: 20 },
      { name: 'UAT', durationDays: 10 },
      { name: 'Security testing', durationDays: 10 },
      { name: 'Deployment', durationDays: 3 },
      { name: 'Launch', durationDays: 1 },
    ],
  },
  {
    name: 'Internal Reporting Dashboard', jiraKey: 'PRJ-104', color: '#ea580c', startDate: '2026-06-01',
    priority: 'low', projectManager: 'Lina Karim',
    category: 'operational', projectType: 'Management', goal: DIGITALISATION, department: 'Finance',
    requester: { internal: true, external: false }, beneficiary: { employees: true, customers: false },
    background: 'Monthly reports are assembled by hand from four systems.',
    summary: 'A dashboard with the monthly figures, refreshed daily.',
    scopeItems: [
      { kind: 'scope', text: 'Budget versus actual by department' },
      { kind: 'objective', text: 'Monthly report ready on the first working day' },
    ],
    phases: [
      { name: 'Requirements gathering', durationDays: 5 },
      { name: 'Development', durationDays: 25 },
      { name: 'QA', durationDays: 8 },
      { name: 'UAT', durationDays: 5 },
      { name: 'Deployment', durationDays: 1 },
    ],
  },
  {
    name: 'E-Services Mobile App', jiraKey: 'PRJ-105', color: '#0891b2', startDate: '2026-10-04',
    priority: 'high', projectManager: 'Sara Ahmed',
    businessPm: 'Mariam Al Suwaidi',
    mainProject: 'Digital Services', category: 'strategic', projectType: 'Customer',
    goal: CUSTOMER_EXPERIENCE, department: 'Customer Service',
    requester: { internal: false, external: true }, beneficiary: { employees: false, customers: true },
    background: 'Customers have asked for the portal services on their phones.',
    summary: 'A mobile app for the most used e-services.',
    scopeItems: [
      { kind: 'scope', text: 'Request submission and tracking' },
      { kind: 'scope', text: 'Push notifications for status changes' },
      { kind: 'out-of-scope', text: 'Payments (phase two)' },
      { kind: 'objective', text: 'Half of new requests come from the app within a year' },
    ],
    phases: [
      { name: 'Requirements gathering', durationDays: 10 },
      { name: 'Business analysis', durationDays: 10 },
      { name: 'Development plan', durationDays: 5 },
      { name: 'Design', durationDays: 15 },
      {
        name: 'Development', durationDays: 60,
        team: [{ person: 'Hassan Ali', allocation: 30, role: 'responsible' }],
        subPhases: [
          {
            name: 'Increment 1 – Sign-in and profile', durationDays: 15,
            team: [{ person: 'Fatima Noor', allocation: 60, role: 'responsible' }],
          },
          {
            name: 'Increment 2 – Service catalogue', durationDays: 15, withPrevious: true,
            team: [{ person: 'Rami Saleh', allocation: 60, role: 'responsible' }],
          },
          {
            name: 'Increment 3 – Payments', durationDays: 25,
            team: [
              { person: 'Rami Saleh', allocation: 60, role: 'responsible' },
              { person: 'Fatima Noor', allocation: 60, role: 'contributor' },
            ],
          },
          {
            name: 'Increment 4 – Notifications', durationDays: 20,
            team: [{ person: 'Fatima Noor', allocation: 60, role: 'responsible' }],
          },
        ],
      },
      { name: 'QA', durationDays: 15 },
      { name: 'UAT', durationDays: 10 },
      { name: 'Security testing', durationDays: 5 },
    ],
  },
];

/** The demo's "I am": Sara Ahmed, an active tech-team person. */
export const DEMO_ME = 'Sara Ahmed';

/** To-dos seeded across the demo, added after the projects. A `doneOn` date creates it already done. */
export const DEMO_TODOS: { project: string; title: string; assignee: string | null; due: string | null; phase: string | null; doneOn?: string }[] = [
  { project: 'E-Services Mobile App', title: 'Send the app store account request to IT', assignee: 'Sara Ahmed', due: '2026-09-23', phase: null },
  { project: 'E-Services Mobile App', title: 'Confirm the requirements workshop dates with Mariam', assignee: 'Sara Ahmed', due: '2026-09-30', phase: 'Requirements gathering' },
  { project: 'E-Services Mobile App', title: 'Collect the list of services for the catalogue', assignee: 'Mariam Al Suwaidi', due: '2026-10-14', phase: 'Requirements gathering' },
  { project: 'E-Services Mobile App', title: 'Draft the sign-in and profile screens', assignee: 'Mei Chen', due: '2026-11-20', phase: 'Design' },
  { project: 'E-Services Mobile App', title: "Review the payment provider's API documentation", assignee: 'Rami Saleh', due: '2026-12-18', phase: 'Development › Increment 3 – Payments' },
  { project: 'E-Services Mobile App', title: 'Share the release plan with the business', assignee: 'Sara Ahmed', due: null, phase: null },
  { project: 'Case Management System', title: 'Book UAT sessions with the business', assignee: 'Aisha Khan', due: '2026-09-28', phase: 'UAT' },
  { project: 'Case Management System', title: 'Confirm the security testing slot', assignee: 'Jonas Weber', due: '2026-10-05', phase: 'Security testing', doneOn: '2026-09-24' },
  { project: 'Case Management System', title: 'Check the go-live checklist with operations', assignee: 'Sara Ahmed', due: '2026-10-20', phase: 'Deployment' },
  { project: 'Customer Portal Revamp', title: 'Hand over the runbook to operations', assignee: 'Hassan Ali', due: '2026-06-17', phase: 'Launch', doneOn: '2026-06-18' },
];

/** Starter to-dos seeded per Phases-list value, so the feature can be seen in the demo. */
export const DEMO_STARTERS: Record<string, string[]> = {
  UAT: ['Book UAT sessions with the business', 'Prepare UAT test data', 'Get UAT sign-off'],
  'Security testing': ['Book the security testing slot'],
  Deployment: ['Confirm the release window with operations', 'Prepare the rollback plan'],
};

export function toProjectInput(
  demo: DemoProject,
  idFor: (list: ListName, name: string) => number,
  personId: (name: string) => number,
): NewProjectInput {
  const { mainProject, projectType, goal, department, projectManager, businessPm, ...rest } = demo;
  const id = (list: ListName, name?: string) => (name ? idFor(list, name) : null);
  const assignmentsFor = (team: TeamEntry[]) =>
    team.map((t) => ({ resourceId: personId(t.person), allocation: t.allocation, role: t.role }));
  return {
    ...rest,
    phases: rest.phases.map((ph) => ({
      name: ph.name,
      durationDays: ph.durationDays,
      assignments: assignmentsFor(ph.team ?? TEAM_BY_PHASE[ph.name] ?? []),
      subPhases: (ph.subPhases ?? []).map((s) => ({
        name: s.name,
        durationDays: s.durationDays,
        withPrevious: s.withPrevious ?? false,
        assignments: assignmentsFor(s.team),
      })),
    })),
    mainProjectId: id('mainProject', mainProject),
    projectTypeId: id('projectType', projectType),
    goalId: id('goal', goal),
    departmentId: id('department', department),
    projectManagerId: projectManager ? personId(projectManager) : null,
    businessPmId: businessPm ? personId(businessPm) : null,
  };
}

/** Adds the demo people, then every demo project (and any list values they name), in one transaction. */
export function seedDemo(db: DatabaseSync, cal: WorkCalendar): number {
  transaction(db, () => {
    const idFor = (list: ListName, name: string) => addListValue(db, list, name).value.id;
    const people = new Map<string, number>();
    for (const p of DEMO_PEOPLE) {
      const data = resourceInputSchema.parse({
        name: p.name,
        side: p.side,
        roleId: p.role ? idFor('role', p.role) : null,
        specialisation: p.specialisation ?? null,
        capacity: p.capacity ?? 100,
        email: p.email ?? null,
        phone: p.phone ?? null,
      });
      people.set(p.name, createResource(db, data).id);
    }
    const personId = (name: string) => {
      const found = people.get(name);
      if (found === undefined) throw new Error(`Demo person missing from DEMO_PEOPLE: ${name}`);
      return found;
    };
    for (const l of DEMO_LEAVE) addLeave(db, personId(l.person), leaveInputSchema.parse({ start: l.start, end: l.end, note: l.note }));
    for (const demo of DEMO_PROJECTS) createProject(db, cal, newProjectSchema.parse(toProjectInput(demo, idFor, personId)));

    setMe(db, personId(DEMO_ME));

    const projectIds = new Map(listProjects(db).map((p) => [p.name, p.id]));
    const projectId = (name: string) => {
      const found = projectIds.get(name);
      if (found === undefined) throw new Error(`Demo to-do project missing from DEMO_PROJECTS: ${name}`);
      return found;
    };
    const resolvePhaseId = (pid: number, path: string | null): number | null => {
      if (path === null) return null;
      const [phaseName, subName] = path.split(' › ');
      const project = getProject(db, pid)!;
      const phase = project.phases.find((p) => p.name === phaseName);
      if (!phase) throw new Error(`Demo to-do phase not found: ${path}`);
      if (subName === undefined) return phase.id;
      const sub = phase.subPhases.find((s) => s.name === subName);
      if (!sub) throw new Error(`Demo to-do phase not found: ${path}`);
      return sub.id;
    };
    for (const t of DEMO_TODOS) {
      const pid = projectId(t.project);
      const data = toDoInputSchema.parse({
        title: t.title,
        note: null,
        assigneeId: t.assignee ? personId(t.assignee) : null,
        dueDate: t.due,
        phaseId: resolvePhaseId(pid, t.phase),
        done: t.doneOn !== undefined,
      });
      const issues = checkToDo(db, pid, data);
      if (issues.length > 0) throw new Error(`Demo to-do invalid (${t.title}): ${issues.map((i) => i.message).join('; ')}`);
      createToDo(db, pid, data, (t.doneOn ?? todayLocal()) as ISODate);
    }

    for (const [phaseName, titles] of Object.entries(DEMO_STARTERS)) {
      const phaseListId = idFor('phase', phaseName);
      for (const title of titles) addStarter(db, starterToDoInputSchema.parse({ phaseListId, title }));
    }
  });
  return DEMO_PROJECTS.length;
}
