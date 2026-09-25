import { vi } from 'vitest';
import type { Lists, ProjectRecord, ResourceRecord } from '../../shared/types';

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
      { id: 11, name: 'Requirements', order: 0, durationDays: 2, start: '2026-09-24', end: '2026-09-25' },
      { id: 12, name: 'Development', order: 1, durationDays: 3, start: '2026-09-28', end: '2026-09-30' },
    ],
    ...overrides,
  };
}

export function sampleLists(): Lists {
  return {
    mainProject: [{ id: 20, list: 'mainProject', name: 'Digital Services', order: 0 }],
    projectType: [
      { id: 1, list: 'projectType', name: 'Criminal', order: 0 },
      { id: 2, list: 'projectType', name: 'Customer', order: 1 },
      { id: 3, list: 'projectType', name: 'Management', order: 2 },
    ],
    goal: [{ id: 4, list: 'goal', name: 'Digitalisation of internal operations', order: 0 }],
    department: [{ id: 30, list: 'department', name: 'Finance', order: 0 }],
    phase: [
      'Requirements gathering', 'Business analysis', 'Development plan', 'Development', 'QA', 'UAT',
      'Security testing', 'Deployment', 'Launch', 'Design',
    ].map((name, i) => ({ id: 50 + i, list: 'phase' as const, name, order: i })),
    role: [
      'Project manager', 'Tech lead', 'Business analyst', 'Developer', 'Designer', 'QA', 'DB engineer', 'InfoSec',
    ].map((name, i) => ({ id: 60 + i, list: 'role' as const, name, order: i })),
  };
}

export function samplePeople(): ResourceRecord[] {
  const person = (p: Partial<ResourceRecord> & Pick<ResourceRecord, 'id' | 'name' | 'side'>): ResourceRecord => ({
    role: null, specialisation: null, email: null, phone: null, capacity: 100, active: true, leave: [], ...p,
  });
  return [
    person({ id: 70, name: 'Sara Ahmed', side: 'tech', role: { id: 60, name: 'Project manager' } }),
    person({ id: 71, name: 'Fatima Noor', side: 'tech', role: { id: 63, name: 'Developer' }, specialisation: 'front-end' }),
    person({ id: 72, name: 'Rami Saleh', side: 'tech', role: { id: 63, name: 'Developer' }, specialisation: 'back-end', capacity: 80 }),
    person({ id: 80, name: 'Mariam Al Suwaidi', side: 'business', phone: '+971 50 123 4567', email: 'mariam@example.com' }),
  ];
}
