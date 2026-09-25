import type { WorkCalendar } from '../shared/calendar';
import type { NewProjectInput, ProjectDetailsInput, ResourceInput, ValidationIssue } from '../shared/schemas';
import type { ListName, ListValue, Lists, PortfolioResponse, ProjectRecord, ResourceRecord } from '../shared/types';

export class ApiError extends Error {
  status: number;
  issues: ValidationIssue[];
  constructor(message: string, status: number, issues: ValidationIssue[] = []) {
    super(message);
    this.status = status;
    this.issues = issues;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Only declare JSON when there is a body: Fastify rejects an empty body sent as application/json.
  const headers = init?.body === undefined ? init?.headers : { 'Content-Type': 'application/json', ...init?.headers };
  const res = await fetch(path, { ...init, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? `Request failed (${res.status})`, res.status, body.issues ?? []);
  return body as T;
}

const withBody = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export const api = {
  getCalendar: () => request<WorkCalendar>('/api/settings/calendar'),
  listProjects: () => request<ProjectRecord[]>('/api/projects'),
  getProject: (id: number) => request<ProjectRecord>(`/api/projects/${id}`),
  createProject: (input: NewProjectInput) => request<ProjectRecord>('/api/projects', withBody('POST', input)),
  updateProjectDetails: (id: number, input: ProjectDetailsInput) =>
    request<ProjectRecord>(`/api/projects/${id}/details`, withBody('PUT', input)),
  getPortfolio: (year: number) => request<PortfolioResponse>(`/api/portfolio?year=${year}`),
  getLists: () => request<Lists>('/api/lists'),
  addListValue: (list: ListName, name: string) => request<ListValue>(`/api/lists/${list}`, withBody('POST', { name })),
  renameListValue: (list: ListName, id: number, name: string) =>
    request<ListValue>(`/api/lists/${list}/${id}`, withBody('PUT', { name })),
  deleteListValue: (list: ListName, id: number) => request<void>(`/api/lists/${list}/${id}`, { method: 'DELETE' }),
  listResources: () => request<ResourceRecord[]>('/api/resources'),
  createResource: (input: ResourceInput) => request<ResourceRecord>('/api/resources', withBody('POST', input)),
};
