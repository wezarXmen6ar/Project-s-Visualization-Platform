import { vi } from 'vitest';
import type { AttachmentRecord, EntryRecord, Lists, ProjectRecord, ResourceRecord, ToDoRecord, WorkloadData } from '../../shared/types';

export type MockHandler = (init?: RequestInit) => { status?: number; body: unknown };

/** Stubs global fetch. Keys look like "GET /api/projects". Unmatched calls return 500. */
export function mockFetch(routes: Record<string, MockHandler>) {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method ?? 'GET';
    const handler = routes[`${method} ${url}`];
    if (!handler) {
      return new Response(JSON.stringify({ error: `No mock for ${method} ${url}` }), { status: 500 });
    }
    const { status = 200, body } = handler(init);
    // A 204 response must not have a body.
    return new Response(status === 204 ? null : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

export function sampleProject(overrides: Partial<ProjectRecord> = {}): ProjectRecord {
  return {
    id: 1,
    name: 'Portal',
    jiraKey: 'PRJ-1',
    color: '#3b82f6',
    startDate: '2026-09-24',
    priority: 'medium',
    projectManager: null, businessPm: null,
    mainProject: null,
    category: null,
    projectType: null,
    goal: null,
    department: null,
    requester: { internal: false, external: false },
    beneficiary: { employees: false, customers: false },
    background: '',
    summary: '',
    scopeItems: [],
    assignments: [],
    phases: [
      { id: 11, name: 'Requirements', order: 0, durationDays: 2, start: '2026-09-24', end: '2026-09-25', subPhases: [] },
      {
        id: 12, name: 'Development', order: 1, durationDays: 3, start: '2026-09-28', end: '2026-09-30',
        subPhases: [
          { id: 120, name: 'Increment 1', order: 0, durationDays: 3, start: '2026-09-28', end: '2026-09-30', withPrevious: false },
        ],
      },
    ],
    ...overrides,
  };
}

/** English → Arabic for the glossary's default list values, used by sampleLists() so tests can exercise both names. */
const DEFAULT_NAMES_AR: Record<string, string> = {
  'Requirements gathering': 'جمع المتطلبات',
  'Business analysis': 'التحليل',
  'Development plan': 'خطة التطوير',
  Development: 'التطوير',
  QA: 'ضمان الجودة (QA)',
  UAT: 'اختبار قبول المستخدم (UAT)',
  'Security testing': 'اختبار أمن المعلومات',
  Deployment: 'النشر',
  Launch: 'الإطلاق',
  Design: 'التصميم',
  'Project manager': 'مدير المشروع',
  'Tech lead': 'قائد الفريق التقني',
  'Business analyst': 'محلل الأعمال',
  Developer: 'مطوّر',
  Designer: 'مصمم',
  'DB engineer': 'مهندس قواعد البيانات',
  InfoSec: 'أمن المعلومات',
  Criminal: 'جنائي',
  Customer: 'الجمهور',
  Management: 'إداري',
  'Digitalisation of internal operations': 'رقمنة العمليات الداخلية',
  'Meeting Minutes': 'محضر اجتماع',
  Approval: 'اعتماد',
  'Change Request': 'Change Request',
  'Business Analysis Document': 'الدراسة التحليلية',
  BRD: 'وثيقة متطلبات الأعمال (BRD)',
  Documentation: 'وثائق المشروع',
  'Test Report': 'تقرير الاختبار',
  Contract: 'العقد',
  Other: 'أخرى',
  NDA: 'وثيقة عدم الإفصاح',
  'Police clearance': 'شهادة بحث الحالة الجنائية',
  'UAE ID': 'الهوية الإماراتية',
  Passport: 'جواز السفر',
  'Company contract': 'عقد الشركة',
  'Information Security Approval': 'موافقة أمن المعلومات',
  'Network account': 'أحقية الشبكة',
  Email: 'البريد الإلكتروني',
  'Contract end': 'انتهاء العقد',
  'License expiry': 'انتهاء الترخيص',
  'Development end': 'انتهاء التطوير',
  'Warranty end': 'انتهاء الضمان',
  'Support end': 'انتهاء الدعم الفني',
};

export function sampleLists(): Lists {
  return {
    mainProject: [{ id: 20, list: 'mainProject', name: 'Digital Services', order: 0, nameAr: null }],
    projectType: [
      { id: 1, list: 'projectType', name: 'Criminal', order: 0, nameAr: DEFAULT_NAMES_AR.Criminal },
      { id: 2, list: 'projectType', name: 'Customer', order: 1, nameAr: DEFAULT_NAMES_AR.Customer },
      { id: 3, list: 'projectType', name: 'Management', order: 2, nameAr: DEFAULT_NAMES_AR.Management },
    ],
    goal: [
      {
        id: 4, list: 'goal', name: 'Digitalisation of internal operations', order: 0,
        nameAr: DEFAULT_NAMES_AR['Digitalisation of internal operations'],
      },
    ],
    department: [{ id: 30, list: 'department', name: 'Finance', order: 0, nameAr: null }],
    phase: [
      'Requirements gathering', 'Business analysis', 'Development plan', 'Development', 'QA', 'UAT',
      'Security testing', 'Deployment', 'Launch', 'Design',
    ].map((name, i) => ({ id: 50 + i, list: 'phase' as const, name, order: i, nameAr: DEFAULT_NAMES_AR[name] ?? null })),
    role: [
      'Project manager', 'Tech lead', 'Business analyst', 'Developer', 'Designer', 'QA', 'DB engineer', 'InfoSec',
    ].map((name, i) => ({ id: 60 + i, list: 'role' as const, name, order: i, nameAr: DEFAULT_NAMES_AR[name] ?? null })),
    attachmentType: [
      'Meeting Minutes', 'Approval', 'Change Request', 'Business Analysis Document', 'BRD', 'Documentation', 'Design',
      'Test Report', 'Contract', 'Other',
    ].map((name, i) => ({ id: 100 + i, list: 'attachmentType' as const, name, order: i, nameAr: DEFAULT_NAMES_AR[name] ?? null })),
    company: [{ id: 200, list: 'company', name: 'TechNova', order: 0, nameAr: null }],
    personDocumentType: [
      'NDA', 'Police clearance', 'UAE ID', 'Passport', 'Company contract', 'Information Security Approval', 'Other',
    ].map((name, i) => ({ id: 300 + i, list: 'personDocumentType' as const, name, order: i, nameAr: DEFAULT_NAMES_AR[name] ?? null })),
    accountType: ['Network account', 'Email', 'VPN', 'Jira', 'Other']
      .map((name, i) => ({ id: 310 + i, list: 'accountType' as const, name, order: i, nameAr: DEFAULT_NAMES_AR[name] ?? null })),
    keyDateType: ['Contract end', 'License expiry', 'Development end', 'Warranty end', 'Support end', 'Other']
      .map((name, i) => ({ id: 320 + i, list: 'keyDateType' as const, name, order: i, nameAr: DEFAULT_NAMES_AR[name] ?? null })),
  };
}

export function samplePeople(): ResourceRecord[] {
  const person = (p: Partial<ResourceRecord> & Pick<ResourceRecord, 'id' | 'name' | 'side'>): ResourceRecord => ({
    role: null, specialisation: null, email: null, phone: null, capacity: 100, active: true, leave: [], projects: [],
    employment: 'staff', company: null, engagementProject: null, engagementStart: null, engagementEnd: null, engagement: null,
    residence: null,
    ...p,
  });
  return [
    person({ id: 70, name: 'Sara Ahmed', side: 'tech', role: { id: 60, name: 'Project manager' } }),
    person({
      id: 71, name: 'Fatima Noor', side: 'tech', role: { id: 63, name: 'Developer' }, specialisation: 'front-end',
      projects: [{ id: 91, name: 'Case Management', finished: false }],
    }),
    person({
      id: 72, name: 'Rami Saleh', side: 'tech', role: { id: 63, name: 'Developer' }, specialisation: 'back-end', capacity: 80,
      projects: [{ id: 91, name: 'Case Management', finished: false }],
    }),
    person({ id: 80, name: 'Mariam Al Suwaidi', side: 'business', phone: '+971 50 123 4567', email: 'mariam@example.com' }),
  ];
}

/** An engaged outsourced person, a past one and an upcoming one, all hired by TechNova. */
export function sampleOutsourced(): ResourceRecord[] {
  const person = (p: Partial<ResourceRecord> & Pick<ResourceRecord, 'id' | 'name' | 'engagement'>): ResourceRecord => ({
    side: 'tech', role: null, specialisation: null, email: null, phone: null, capacity: 100, active: true, leave: [], projects: [],
    employment: 'outsourced', company: { id: 200, name: 'TechNova' }, engagementProject: null, engagementStart: null,
    engagementEnd: null, residence: null, ...p,
  });
  return [
    person({
      id: 90, name: 'Omar Farid', engagement: 'engaged', engagementProject: { id: 91, name: 'Case Management' },
      engagementStart: '2026-09-01', engagementEnd: '2026-12-31',
    }),
    person({
      id: 91, name: 'Layla Zaid', engagement: 'past', engagementProject: { id: 91, name: 'Case Management' },
      engagementStart: '2026-01-01', engagementEnd: '2026-06-30',
    }),
    person({
      id: 92, name: 'Nadia Haddad', engagement: 'upcoming', engagementProject: { id: 91, name: 'Case Management' },
      engagementStart: '2026-10-15', engagementEnd: null,
    }),
  ];
}

export function sampleWorkload(): WorkloadData {
  return {
    calendar: { weekendDays: [0, 6], holidays: [] },
    resources: [
      { id: 71, name: 'Fatima Noor', capacity: 100, leave: [] },
      { id: 72, name: 'Rami Saleh', capacity: 80, leave: [{ start: '2026-10-19', end: '2026-10-20' }] },
    ],
    assignments: [
      {
        id: 500, resourceId: 71, phaseId: 900, projectId: 90, projectName: 'HR Self-Service', phaseName: 'QA', topPhaseName: 'QA', subPhaseName: null,
        start: '2026-09-28', end: '2026-10-09', allocation: 100, role: 'responsible',
      },
      {
        id: 501, resourceId: 72, phaseId: 901, projectId: 91, projectName: 'Case Management', phaseName: 'Development', topPhaseName: 'Development', subPhaseName: null,
        start: '2026-10-05', end: '2026-10-16', allocation: 60, role: 'contributor',
      },
    ],
    decisions: [],
  };
}

/**
 * One overdue, one due later, one with no due date, one done, one on a sub-phase, and one assigned to a business
 * contact. Uses the sample people and project ids.
 */
export function sampleToDos(): ToDoRecord[] {
  const base = (overrides: Partial<ToDoRecord> & Pick<ToDoRecord, 'id' | 'title'>): ToDoRecord => ({
    projectId: 1,
    projectName: 'Portal',
    note: null,
    assignee: null,
    dueDate: null,
    done: false,
    doneDate: null,
    phase: null,
    formerPhase: null,
    sourceEntry: null,
    createdAt: '2026-09-20T09:00:00.000Z',
    ...overrides,
  });
  return [
    base({ id: 200, title: 'Chase the missing contract', dueDate: '2026-10-01' }),
    base({ id: 201, title: 'Book the UAT room', dueDate: '2026-10-20' }),
    base({ id: 202, title: 'Draft the go-live checklist' }),
    base({ id: 203, title: 'Confirm the sandbox is ready', done: true, doneDate: '2026-09-22' }),
    base({ id: 204, title: 'Review Increment 1 scope', phase: { id: 120, name: 'Development › Increment 1', phaseName: 'Development', subPhaseName: 'Increment 1' } }),
    base({ id: 205, title: 'Get sign-off from the business', assignee: { id: 80, name: 'Mariam Al Suwaidi' } }),
  ];
}

/** One meeting with attendees and a follow-up, and one update, on the sample project. Newest first. */
export function sampleEntries(): EntryRecord[] {
  const base = (overrides: Partial<EntryRecord> & Pick<EntryRecord, 'id' | 'type' | 'title' | 'effectiveDate'>): EntryRecord => ({
    projectId: 1,
    body: '',
    highlight: false,
    phase: null,
    attendees: [],
    guests: [],
    attachmentIds: [],
    followUpToDoIds: [],
    createdAt: '2026-09-20T09:00:00.000Z',
    ...overrides,
  });
  return [
    base({
      id: 300, type: 'meeting', title: 'Kickoff', effectiveDate: '2026-09-24',
      attendees: [{ id: 70, name: 'Sara Ahmed' }, { id: 71, name: 'Fatima Noor' }],
      followUpToDoIds: [200],
      phase: { id: 12, name: 'Development', phaseName: 'Development', subPhaseName: null },
    }),
    base({ id: 301, type: 'update', title: 'Weekly status', effectiveDate: '2026-09-18', body: 'On track.' }),
  ];
}

/** Two project attachments: a previewable PDF with a type and phase, and a non-previewable file linked to a meeting. */
export function sampleAttachments(): AttachmentRecord[] {
  return [
    {
      id: 400, projectId: 1, phase: { id: 12, name: 'Development', phaseName: 'Development', subPhaseName: null },
      entryId: null, type: { id: 101, name: 'Approval', nameAr: 'اعتماد' }, name: 'Approval letter.pdf', mime: 'application/pdf',
      size: 245_000, documentDate: '2026-09-20', uploadedAt: '2026-09-21T09:00:00.000Z', previewable: true,
    },
    {
      id: 401, projectId: 1, phase: null, entryId: 300, type: { id: 100, name: 'Meeting Minutes', nameAr: 'محضر اجتماع' },
      name: 'notes.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 18_000, documentDate: null, uploadedAt: '2026-09-24T10:00:00.000Z', previewable: false,
    },
  ];
}

/** sampleWorkload plus 60% more for Fatima in the week of 5 Oct 2026 (160% booked). */
export function overbookedWorkload(): WorkloadData {
  const data = sampleWorkload();
  data.assignments.push({
    id: 502, resourceId: 71, phaseId: 902, projectId: 92, projectName: 'Portal', phaseName: 'Development', topPhaseName: 'Development', subPhaseName: null,
    start: '2026-10-05', end: '2026-10-09', allocation: 60, role: 'contributor',
  });
  return data;
}
