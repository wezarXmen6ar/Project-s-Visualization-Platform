import type { WorkCalendar } from '../shared/calendar';
import type { NewProjectInput, ValidationIssue } from '../shared/schemas';
import type { PortfolioResponse, ProjectRecord } from '../shared/types';

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
  const res = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? `Request failed (${res.status})`, res.status, body.issues ?? []);
  return body as T;
}

export const api = {
  getCalendar: () => request<WorkCalendar>('/api/settings/calendar'),
  listProjects: () => request<ProjectRecord[]>('/api/projects'),
  getProject: (id: number) => request<ProjectRecord>(`/api/projects/${id}`),
  createProject: (input: NewProjectInput) =>
    request<ProjectRecord>('/api/projects', { method: 'POST', body: JSON.stringify(input) }),
  getPortfolio: (year: number) => request<PortfolioResponse>(`/api/portfolio?year=${year}`),
};
