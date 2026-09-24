import type { DatabaseSync } from 'node:sqlite';
import type { WorkCalendar } from '../shared/calendar';
import { newProjectSchema, type NewProjectInput } from '../shared/schemas';
import type { ListName } from '../shared/types';
import { transaction } from './db';
import { addListValue } from './lists/repo';
import { createProject } from './projects/repo';

/** A demo project names its list values; seedDemo turns the names into ids, creating values when needed. */
export type DemoProject = Omit<NewProjectInput, 'mainProjectId' | 'projectTypeId' | 'goalId' | 'departmentId'> & {
  mainProject?: string;
  projectType?: string;
  goal?: string;
  department?: string;
};

const DIGITALISATION = 'Digitalisation of internal operations';
const CUSTOMER_EXPERIENCE = 'Improve customer experience';

export const DEMO_PROJECTS: DemoProject[] = [
  {
    name: 'Legacy Archive Migration', jiraKey: 'PRJ-099', color: '#64748b', startDate: '2025-09-07',
    priority: 'low', projectManager: 'Omar Haddad', businessOwner: 'Records Office Manager',
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
      { name: 'Development', durationDays: 50 },
      { name: 'QA', durationDays: 10 },
      { name: 'Go-live', durationDays: 2 },
    ],
  },
  {
    name: 'Customer Portal Revamp', jiraKey: 'PRJ-101', color: '#2563eb', startDate: '2026-01-11',
    priority: 'high', projectManager: 'Sara Ahmed', businessOwner: 'Head of Customer Service',
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
      { name: 'Design', durationDays: 10 },
      { name: 'Development', durationDays: 50 },
      { name: 'QA', durationDays: 15 },
      { name: 'UAT', durationDays: 10 },
      { name: 'Go-live', durationDays: 2 },
    ],
  },
  {
    name: 'HR Self-Service', jiraKey: 'PRJ-102', color: '#16a34a', startDate: '2026-02-01',
    priority: 'medium', projectManager: 'Lina Karim', businessOwner: 'HR Director',
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
      { name: 'Development', durationDays: 40 },
      { name: 'QA', durationDays: 10 },
      { name: 'UAT', durationDays: 5 },
    ],
  },
  {
    name: 'Case Management System', jiraKey: 'PRJ-103', color: '#9333ea', startDate: '2026-03-15',
    priority: 'high', projectManager: 'Yusuf Nasser', businessOwner: 'Legal Affairs Director',
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
      { name: 'Design', durationDays: 10 },
      { name: 'Development', durationDays: 80 },
      { name: 'QA', durationDays: 20 },
      { name: 'UAT', durationDays: 10 },
      { name: 'Go-live', durationDays: 3 },
    ],
  },
  {
    name: 'Internal Reporting Dashboard', jiraKey: 'PRJ-104', color: '#ea580c', startDate: '2026-06-01',
    priority: 'low', projectManager: 'Lina Karim', businessOwner: 'Finance Director',
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
    ],
  },
  {
    name: 'E-Services Mobile App', jiraKey: 'PRJ-105', color: '#0891b2', startDate: '2026-10-04',
    priority: 'high', projectManager: 'Sara Ahmed', businessOwner: 'Head of Customer Service',
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
      { name: 'Design', durationDays: 15 },
      { name: 'Development', durationDays: 60 },
      { name: 'QA', durationDays: 15 },
      { name: 'UAT', durationDays: 10 },
    ],
  },
];

export function toProjectInput(demo: DemoProject, idFor: (list: ListName, name: string) => number): NewProjectInput {
  const { mainProject, projectType, goal, department, ...rest } = demo;
  const id = (list: ListName, name?: string) => (name ? idFor(list, name) : null);
  return {
    ...rest,
    mainProjectId: id('mainProject', mainProject),
    projectTypeId: id('projectType', projectType),
    goalId: id('goal', goal),
    departmentId: id('department', department),
  };
}

/** Adds every demo project (and any list values they name) in one transaction. Returns how many were added. */
export function seedDemo(db: DatabaseSync, cal: WorkCalendar): number {
  transaction(db, () => {
    const idFor = (list: ListName, name: string) => addListValue(db, list, name).value.id;
    for (const demo of DEMO_PROJECTS) createProject(db, cal, newProjectSchema.parse(toProjectInput(demo, idFor)));
  });
  return DEMO_PROJECTS.length;
}
