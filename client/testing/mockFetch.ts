import { vi } from 'vitest';
import type { ProjectRecord } from '../../shared/types';

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
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
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
    phases: [
      { id: 11, name: 'Requirements', order: 0, durationDays: 2, start: '2026-09-24', end: '2026-09-25' },
      { id: 12, name: 'Development', order: 1, durationDays: 3, start: '2026-09-28', end: '2026-09-30' },
    ],
    ...overrides,
  };
}
