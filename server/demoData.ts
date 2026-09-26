import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { todayLocal, type ISODate, type WorkCalendar } from '../shared/calendar';
import {
  entryInputSchema, keyDateInputSchema, keyDateItemSchema, leaveInputSchema, newProjectSchema,
  personAccountInputSchema, resourceInputSchema, starterToDoInputSchema, toDoInputSchema,
  type EntryData, type NewProjectInput,
} from '../shared/schemas';
import type { AssignmentRole, Employment, ListName, Residence, Side, Specialisation } from '../shared/types';
import { checkAttachmentRefs, createAttachment } from './attachments/repo';
import { makeStoredName, writeAttachmentFile } from './attachments/files';
import { transaction } from './db';
import { checkEntry, createEntry } from './entries/repo';
import { createKeyDate, replaceAttachmentKeyDates } from './keyDates/repo';
import { addListValue } from './lists/repo';
import { createPersonAccount } from './people/accounts';
import { createPersonDocument } from './people/documents';
import { createProject, getProject, listProjects } from './projects/repo';
import { addLeave, createResource, updateResource } from './resources/repo';
import { setMe } from './settings';
import { addStarter } from './starters/repo';
import { checkToDo, createToDo } from './todos/repo';

/**
 * Builds a tiny, valid one-page PDF whose page shows `title` as text (Latin-safe; parentheses and backslashes are
 * escaped since PDF strings use them as delimiters). Used for every demo file, so `npm run seed` and the demo
 * tests write real PDFs through the same attachments code paths as an upload.
 */
export function makeDemoPdf(title: string): Buffer {
  const text = title.replace(/[\\()]/g, (c) => `\\${c}`);
  const stream = `BT /F1 16 Tf 40 760 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}

/** A person the demo projects name; seedDemo adds them to Resources first. */
export interface DemoPerson {
  name: string;
  side: Side;
  role?: string;
  specialisation?: Specialisation;
  capacity?: number;
  email?: string;
  phone?: string;
  /** Defaults to 'staff'. An 'outsourced' person needs `company` and, once engaged, `engagementProject`. */
  employment?: Employment;
  /** Who they're contracted through: required for an outsourced person, optional for our own team. */
  company?: string;
  /** Resolved to an id once every demo project exists (seedDemo's second pass over DEMO_PEOPLE). */
  engagementProject?: string;
  engagementStart?: ISODate;
  engagementEnd?: ISODate;
  /** Tech side only; information only. */
  residence?: Residence;
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
  {
    name: 'Hassan Ali', side: 'tech', role: 'Tech lead', specialisation: 'full-stack', email: 'hassan.ali@example.com',
    company: 'TechNova Solutions', residence: 'abroad',
  },
  { name: 'Fatima Noor', side: 'tech', role: 'Developer', specialisation: 'front-end', residence: 'uae' },
  { name: 'Rami Saleh', side: 'tech', role: 'Developer', specialisation: 'back-end', capacity: 80 },
  { name: 'Aisha Khan', side: 'tech', role: 'Business analyst' },
  { name: 'Mei Chen', side: 'tech', role: 'Designer' },
  { name: 'Priya Das', side: 'tech', role: 'QA' },
  { name: 'Jonas Weber', side: 'tech', role: 'InfoSec' },
  {
    name: 'Omar Farid', side: 'tech', role: 'Developer', employment: 'outsourced', company: 'TechNova Solutions',
    engagementProject: 'E-Services Mobile App', engagementStart: '2026-09-01', engagementEnd: '2027-03-31', residence: 'abroad',
  },
  {
    name: 'Lena Park', side: 'tech', role: 'QA', employment: 'outsourced', company: 'TechNova Solutions',
    engagementProject: 'Customer Portal Revamp', engagementStart: '2026-03-01', engagementEnd: '2026-06-30',
  },
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

/**
 * Arabic names for the list values the demo adds, keyed "list:name". The app's own defaults (phases, roles, project
 * types, the first goal) already carry their Arabic from the migration, so they are not repeated here.
 */
export const DEMO_NAMES_AR: Record<string, string> = {
  'department:Records Office': 'مكتب السجلات',
  'department:Customer Service': 'خدمة المتعاملين',
  'department:Human Resources': 'الموارد البشرية',
  'department:Legal Affairs': 'الشؤون القانونية',
  'department:Finance': 'المالية',
  'mainProject:Records Modernisation': 'تحديث السجلات',
  'mainProject:Digital Services': 'الخدمات الرقمية',
  [`goal:${CUSTOMER_EXPERIENCE}`]: 'تحسين تجربة المتعاملين',
  'company:TechNova Solutions': 'تك نوفا للحلول',
};

/** The demo's one fully Arabic project, so right-to-left and mixed-direction text can be reviewed. */
export const DEMO_ARABIC_PROJECT = 'بوابة الخدمات الذكية';

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
            team: [
              { person: 'Fatima Noor', allocation: 60, role: 'responsible' },
              { person: 'Omar Farid', allocation: 60, role: 'contributor' },
            ],
          },
        ],
      },
      { name: 'QA', durationDays: 15 },
      { name: 'UAT', durationDays: 10 },
      { name: 'Security testing', durationDays: 5 },
    ],
  },
  {
    // Fully Arabic, in 2027 so it leaves the M4 and M5 demo weeks (all in 2026) untouched. Its phases are stored
    // under their English names, so they show in Arabic through the Phases list. Teams are light, to add no overbooking.
    name: DEMO_ARABIC_PROJECT, jiraKey: 'PRJ-106', color: '#0d9488', startDate: '2027-01-10',
    priority: 'high', projectManager: 'Sara Ahmed',
    businessPm: 'Mariam Al Suwaidi',
    mainProject: 'Digital Services', category: 'strategic', projectType: 'Customer',
    goal: CUSTOMER_EXPERIENCE, department: 'Customer Service',
    requester: { internal: true, external: true }, beneficiary: { employees: false, customers: true },
    background:
      'يتنقّل المتعاملون اليوم بين عدة مواقع وتطبيقات لإنجاز معاملاتهم، ويُطلب منهم تسجيل الدخول وإدخال بياناتهم ' +
      'نفسها في كل خدمة، مما يطيل زمن إنجاز المعاملة ويزيد الاستفسارات الواردة إلى مركز الاتصال.',
    summary:
      'بوابة موحّدة تجمع الخدمات الإلكترونية في مكان واحد، بدخول موحّد عبر الهوية الرقمية، وتتيح للمتعامل تقديم ' +
      'طلباته ومتابعتها وسداد رسومها بسهولة من أي جهاز.',
    scopeItems: [
      { kind: 'scope', text: 'الدخول الموحّد عبر الهوية الرقمية' },
      { kind: 'scope', text: 'دليل موحّد للخدمات مع خاصية البحث' },
      { kind: 'scope', text: 'لوحة شخصية للمتعامل لمتابعة طلباته وحالتها' },
      { kind: 'scope', text: 'سداد الرسوم إلكترونياً' },
      { kind: 'out-of-scope', text: 'تطبيق الهواتف الذكية (ضمن مشروع مستقل)' },
      { kind: 'out-of-scope', text: 'رقمنة الخدمات التي ما زالت تُقدَّم ورقياً' },
      { kind: 'problem', text: 'تعدّد المنصات وتكرار تسجيل الدخول وإدخال البيانات في كل خدمة' },
      { kind: 'problem', text: 'صعوبة معرفة حالة الطلب دون التواصل مع مركز الاتصال' },
      { kind: 'objective', text: 'إتاحة جميع الخدمات الإلكترونية من منصة واحدة بنهاية عام 2027' },
      { kind: 'objective', text: 'رفع نسبة رضا المتعاملين عن الخدمات الرقمية إلى 90%' },
    ],
    phases: [
      { name: 'Requirements gathering', durationDays: 10, team: [{ person: 'Aisha Khan', allocation: 50, role: 'responsible' }] },
      { name: 'Business analysis', durationDays: 10, team: [{ person: 'Aisha Khan', allocation: 50, role: 'responsible' }] },
      { name: 'Development plan', durationDays: 5, team: [{ person: 'Hassan Ali', allocation: 30, role: 'responsible' }] },
      { name: 'Design', durationDays: 10, team: [{ person: 'Mei Chen', allocation: 50, role: 'responsible' }] },
      {
        name: 'Development', durationDays: 40,
        team: [
          { person: 'Hassan Ali', allocation: 20, role: 'responsible' },
          { person: 'Fatima Noor', allocation: 40, role: 'contributor' },
        ],
      },
      { name: 'QA', durationDays: 10, team: [{ person: 'Priya Das', allocation: 50, role: 'responsible' }] },
      {
        name: 'UAT', durationDays: 5,
        team: [
          { person: 'Aisha Khan', allocation: 30, role: 'responsible' },
          { person: 'Priya Das', allocation: 20, role: 'contributor' },
        ],
      },
      { name: 'Security testing', durationDays: 5, team: [{ person: 'Jonas Weber', allocation: 50, role: 'responsible' }] },
      { name: 'Deployment', durationDays: 2, team: [{ person: 'Hassan Ali', allocation: 30, role: 'responsible' }] },
      { name: 'Launch', durationDays: 1, team: [{ person: 'Hassan Ali', allocation: 20, role: 'responsible' }] },
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
  { project: DEMO_ARABIC_PROJECT, title: 'التنسيق مع إدارة تقنية المعلومات لتفعيل الربط مع الهوية الرقمية', assignee: 'Sara Ahmed', due: '2027-01-21', phase: 'Requirements gathering' },
  { project: DEMO_ARABIC_PROJECT, title: 'اعتماد قائمة الخدمات المشمولة في الإطلاق الأول مع مالك العملية', assignee: 'Sara Ahmed', due: '2027-02-04', phase: 'Business analysis' },
];

/** Starter to-dos seeded per Phases-list value, so the feature can be seen in the demo. */
export const DEMO_STARTERS: Record<string, string[]> = {
  UAT: ['Book UAT sessions with the business', 'Prepare UAT test data', 'Get UAT sign-off'],
  'Security testing': ['Book the security testing slot'],
  Deployment: ['Confirm the release window with operations', 'Prepare the rollback plan'],
};

/** A meeting-minutes or similar file, named by its attachment type from the Attachment types list. */
export interface DemoEntryAttachment {
  fileName: string;
  typeName: string;
  documentDate?: ISODate | null;
}

export interface DemoFollowUp {
  title: string;
  assignee: string | null;
  due: ISODate | null;
}

/** A meeting or update seeded on a project's History tab. */
export interface DemoEntry {
  project: string;
  type: 'meeting' | 'update';
  title: string;
  effectiveDate: ISODate;
  phase?: string | null;
  /** Meetings only: people from Resources. */
  attendees?: string[];
  /** Meetings only: anyone typed in who isn't in Resources. */
  guestNames?: string[];
  body?: string;
  highlight?: boolean;
  /** Meetings only, created in the same save as the entry. */
  followUps?: DemoFollowUp[];
  attachment?: DemoEntryAttachment;
}

/**
 * Meetings and updates seeded across the demo (M7 Task 10). Each meeting's own file, when it has one, is
 * uploaded first and linked when the entry is created, the same order the entry form itself uses.
 */
export const DEMO_ENTRIES: DemoEntry[] = [
  {
    project: 'E-Services Mobile App',
    type: 'meeting',
    title: 'Requirements workshop',
    effectiveDate: '2026-10-07',
    phase: 'Requirements gathering',
    attendees: ['Aisha Khan', 'Sara Ahmed', 'Mariam Al Suwaidi'],
    guestNames: ['Khalid Al Mansoori (Dubai Police IT)'],
    body:
      'Walked through the current e-services and the requests customers raise most often. The business confirmed ' +
      'push notifications and request tracking are the top priorities for the first release. Dubai Police IT ' +
      "joined to discuss the identity check on the app's sign-in flow.",
    highlight: true,
    followUps: [{ title: 'Share the draft requirements list', assignee: 'Aisha Khan', due: '2026-10-14' }],
    attachment: { fileName: 'Requirements workshop minutes.pdf', typeName: 'Meeting Minutes' },
  },
  {
    project: 'E-Services Mobile App',
    type: 'update',
    title: 'Requirements gathering on track',
    effectiveDate: '2026-10-16',
    body: 'The draft requirements list from the workshop is being reviewed with the business; no open risks so far.',
    highlight: false,
  },
  {
    project: 'Case Management System',
    type: 'update',
    title: 'UAT signed off by the business',
    effectiveDate: '2026-10-09',
    phase: 'UAT',
    body: 'The business completed User Acceptance Testing and signed off; deployment planning starts next.',
    highlight: true,
  },
  {
    project: 'Customer Portal Revamp',
    type: 'meeting',
    title: 'Launch go/no-go',
    effectiveDate: '2026-06-16',
    phase: 'Launch',
    attendees: ['Sara Ahmed', 'Mariam Al Suwaidi'],
    body: 'Reviewed the go-live checklist and the outstanding defects. The team gave a go for launch this week.',
    highlight: true,
  },
  {
    project: DEMO_ARABIC_PROJECT,
    type: 'meeting',
    title: 'ورشة جمع المتطلبات',
    effectiveDate: '2027-01-13',
    phase: 'Requirements gathering',
    attendees: ['Aisha Khan', 'Mariam Al Suwaidi'],
    body:
      'استعرض الفريق مع ممثلي الجهات المستفيدة قائمة الخدمات المرشحة للإطلاق الأول، واتُّفق على أن يكون الدخول ' +
      'الموحّد عبر الهوية الرقمية أولوية قصوى قبل بدء التصميم.',
    highlight: true,
    attachment: { fileName: 'محضر ورشة المتطلبات.pdf', typeName: 'Meeting Minutes' },
  },
];

/** A standalone file (not attached to any meeting or update) seeded on a project. */
export interface DemoAttachment {
  project: string;
  phase?: string | null;
  typeName: string;
  fileName: string;
  documentDate?: ISODate | null;
}

export const DEMO_ATTACHMENTS: DemoAttachment[] = [
  { project: 'Case Management System', phase: 'UAT', typeName: 'Approval', fileName: 'UAT sign-off.pdf', documentDate: '2026-10-09' },
  { project: 'Customer Portal Revamp', phase: 'QA', typeName: 'Test Report', fileName: 'QA test report.pdf' },
];

/** A person document seeded on the demo team (M7 Task 10), with types from the Person document types list. */
export interface DemoPersonDocument {
  person: string;
  typeName: string;
  fileName: string;
  expiryDate: ISODate | null;
}

export const DEMO_PERSON_DOCUMENTS: DemoPersonDocument[] = [
  { person: 'Fatima Noor', typeName: 'Passport', fileName: 'Fatima Noor passport.pdf', expiryDate: '2026-10-20' },
  { person: 'Fatima Noor', typeName: 'NDA', fileName: 'Fatima Noor NDA.pdf', expiryDate: null },
  { person: 'Omar Farid', typeName: 'Company contract', fileName: 'Omar Farid company contract.pdf', expiryDate: '2027-03-31' },
  { person: 'Omar Farid', typeName: 'Police clearance', fileName: 'Omar Farid police clearance.pdf', expiryDate: '2026-09-01' },
  { person: 'Hassan Ali', typeName: 'UAE ID', fileName: 'Hassan Ali UAE ID.pdf', expiryDate: '2028-05-01' },
];

/** A person's work account seeded on the demo team (M7 Task 10), with types from the Account types list. */
export interface DemoPersonAccount {
  person: string;
  typeName: string;
  expiryDate: ISODate;
  remindDays: number;
}

export const DEMO_PERSON_ACCOUNTS: DemoPersonAccount[] = [
  { person: 'Fatima Noor', typeName: 'Network account', expiryDate: '2026-10-16', remindDays: 30 },
  { person: 'Hassan Ali', typeName: 'VPN', expiryDate: '2026-12-20', remindDays: 45 },
];

/**
 * Builds a demo PDF, writes it under `dir`'s attachments folder, and creates the attachment row, validating the
 * given references first (the same order the upload route follows). Returns the new attachment's id.
 */
function addDemoAttachment(
  db: DatabaseSync, attachmentsDir: string, projectId: number,
  data: { phaseId: number | null; entryId: number | null; typeId: number | null; fileName: string; documentDate: ISODate | null },
): number {
  const issues = checkAttachmentRefs(db, projectId, data);
  if (issues.length > 0) throw new Error(`Demo attachment invalid (${data.fileName}): ${issues.map((i) => i.message).join('; ')}`);
  const pdf = makeDemoPdf(data.fileName);
  const dir = join(attachmentsDir, String(projectId));
  const storedName = makeStoredName(data.fileName);
  writeAttachmentFile(dir, storedName, pdf);
  const created = createAttachment(
    db, projectId,
    {
      phaseId: data.phaseId, entryId: data.entryId, typeId: data.typeId, originalName: data.fileName, storedName,
      mime: 'application/pdf', size: pdf.length, documentDate: data.documentDate,
    },
    new Date().toISOString(),
  );
  return created.id;
}

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

/**
 * Adds the demo people, then every demo project (and any list values they name), in one transaction.
 * `attachmentsDir` is where every demo file (meeting minutes, contracts, person documents…) is written; `npm run
 * seed` uses `'attachments'` and tests pass a temporary folder.
 */
export function seedDemo(db: DatabaseSync, cal: WorkCalendar, attachmentsDir = 'attachments'): number {
  transaction(db, () => {
    const idFor = (list: ListName, name: string) =>
      addListValue(db, list, name, DEMO_NAMES_AR[`${list}:${name}`] ?? null).value.id;
    const people = new Map<string, number>();
    for (const p of DEMO_PEOPLE) {
      const data = resourceInputSchema.parse({
        name: p.name,
        side: p.side,
        employment: p.employment ?? 'staff',
        roleId: p.role ? idFor('role', p.role) : null,
        specialisation: p.specialisation ?? null,
        capacity: p.capacity ?? 100,
        email: p.email ?? null,
        phone: p.phone ?? null,
        companyId: p.company ? idFor('company', p.company) : null,
        // Outsourced people are only linked to their engagement project once every demo project exists (below).
        engagementProjectId: null,
        engagementStart: p.engagementStart ?? null,
        engagementEnd: p.engagementEnd ?? null,
        residence: p.residence ?? null,
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

    // Now that every demo project exists, link each outsourced person to their engagement project.
    for (const p of DEMO_PEOPLE) {
      if (p.employment !== 'outsourced' || !p.engagementProject) continue;
      const data = resourceInputSchema.parse({
        name: p.name,
        side: p.side,
        employment: 'outsourced',
        roleId: p.role ? idFor('role', p.role) : null,
        specialisation: p.specialisation ?? null,
        capacity: p.capacity ?? 100,
        email: p.email ?? null,
        phone: p.phone ?? null,
        companyId: idFor('company', p.company!),
        engagementProjectId: projectId(p.engagementProject),
        engagementStart: p.engagementStart ?? null,
        engagementEnd: p.engagementEnd ?? null,
        residence: p.residence ?? null,
      });
      updateResource(db, personId(p.name), data);
    }

    // Meetings, updates and their files (M7 Task 10). A meeting's own file is uploaded before the entry, then
    // linked when the entry is created — the same order the entry form itself follows.
    for (const spec of DEMO_ENTRIES) {
      const pid = projectId(spec.project);
      let attachmentId: number | null = null;
      if (spec.attachment) {
        attachmentId = addDemoAttachment(db, attachmentsDir, pid, {
          phaseId: null, entryId: null, typeId: idFor('attachmentType', spec.attachment.typeName),
          fileName: spec.attachment.fileName, documentDate: spec.attachment.documentDate ?? null,
        });
      }
      const data: EntryData = entryInputSchema.parse({
        type: spec.type,
        effectiveDate: spec.effectiveDate,
        title: spec.title,
        body: spec.body ?? '',
        phaseId: resolvePhaseId(pid, spec.phase ?? null),
        highlight: spec.highlight ?? false,
        attendeeIds: (spec.attendees ?? []).map(personId),
        guestNames: spec.guestNames ?? [],
        followUps: (spec.followUps ?? []).map((f) => ({
          title: f.title, assigneeId: f.assignee ? personId(f.assignee) : null, dueDate: f.due,
        })),
        attachmentIds: attachmentId !== null ? [attachmentId] : [],
      });
      const issues = checkEntry(db, pid, data);
      if (issues.length > 0) throw new Error(`Demo entry invalid (${spec.title}): ${issues.map((i) => i.message).join('; ')}`);
      createEntry(db, pid, data);
    }

    // Standalone files, not attached to any meeting or update.
    for (const a of DEMO_ATTACHMENTS) {
      const pid = projectId(a.project);
      addDemoAttachment(db, attachmentsDir, pid, {
        phaseId: resolvePhaseId(pid, a.phase ?? null), entryId: null, typeId: idFor('attachmentType', a.typeName),
        fileName: a.fileName, documentDate: a.documentDate ?? null,
      });
    }

    // E-Services' contract carries three key dates, linked to it in one save the way the upload flow saves them.
    const eServicesId = projectId('E-Services Mobile App');
    const contractId = addDemoAttachment(db, attachmentsDir, eServicesId, {
      phaseId: null, entryId: null, typeId: idFor('attachmentType', 'Contract'), fileName: 'E-Services contract.pdf', documentDate: null,
    });
    const contractKeyDates = [
      { typeId: idFor('keyDateType', 'Contract end'), date: '2027-06-30' },
      { typeId: idFor('keyDateType', 'License expiry'), date: '2026-10-15' },
      { typeId: idFor('keyDateType', 'Development end'), date: '2027-03-31' },
    ].map((item) => keyDateItemSchema.parse(item));
    const replaced = replaceAttachmentKeyDates(db, contractId, contractKeyDates, new Date().toISOString(), todayLocal());
    if (!replaced || 'issues' in replaced) throw new Error("Demo key dates invalid for E-Services' contract");

    // Case Management's support end key date has no file.
    const caseMgmtId = projectId('Case Management System');
    const supportEnd = keyDateInputSchema.parse({ typeId: idFor('keyDateType', 'Support end'), date: '2026-09-20', attachmentId: null });
    createKeyDate(db, caseMgmtId, supportEnd, new Date().toISOString(), todayLocal());

    // Person documents and work accounts (M7 Task 8), with files written the same way as attachments.
    for (const d of DEMO_PERSON_DOCUMENTS) {
      const resourceId = personId(d.person);
      const pdf = makeDemoPdf(d.fileName);
      const dir = join(attachmentsDir, 'people', String(resourceId));
      const storedName = makeStoredName(d.fileName);
      writeAttachmentFile(dir, storedName, pdf);
      createPersonDocument(
        db, resourceId,
        {
          typeId: idFor('personDocumentType', d.typeName), originalName: d.fileName, storedName, mime: 'application/pdf',
          size: pdf.length, expiryDate: d.expiryDate, note: null,
        },
        new Date().toISOString(), todayLocal(),
      );
    }
    for (const a of DEMO_PERSON_ACCOUNTS) {
      const data = personAccountInputSchema.parse({ typeId: idFor('accountType', a.typeName), expiryDate: a.expiryDate, remindDays: a.remindDays });
      createPersonAccount(db, personId(a.person), data, new Date().toISOString(), todayLocal());
    }

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
