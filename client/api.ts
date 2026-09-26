import type { WorkCalendar } from '../shared/calendar';
import type { MessageKey } from '../shared/i18n/en';
import type { Params } from '../shared/i18n/types';
import type {
  AssignmentInput, AttachmentUpdateInput, EntryInput, KeyDateInput, LeaveInput, NewProjectInput, OverloadDecisionInput,
  PersonAccountInput, PersonDocumentUpdateInput, ProjectDetailsInput, ResourceInput, ScheduleUpdateInput, StarterToDoInput, ToDoInput,
  ValidationIssue,
} from '../shared/schemas';
import type {
  AttachmentRecord, BackupStatus, EntryRecord, ExpiringItem, KeyDateRecord, LeaveRecord, ListName, ListValue, Lists, Me,
  OverloadDecision, PersonAccountRecord, PersonDocumentRecord, PortfolioResponse, ProjectRecord, ResourceRecord, ScheduleSaved,
  StarterSuggestion, StarterToDo, ToDoRecord, UpcomingKeyDate, WorkloadData,
} from '../shared/types';

export class ApiError extends Error {
  status: number;
  issues: ValidationIssue[];
  /** The server's own message key for this error, when it has one; absent for a generic or unrecognised failure. */
  code?: MessageKey;
  params?: Params;
  constructor(message: string, status: number, issues: ValidationIssue[] = [], code?: MessageKey, params?: Params) {
    super(message);
    this.status = status;
    this.issues = issues;
    this.code = code;
    this.params = params;
  }
}

/**
 * Uploads raw file bytes with `XMLHttpRequest`, so `onProgress` can report upload progress. `name` is sent as
 * X-File-Name (percent-encoded, so an Arabic name round-trips); a `Blob`'s own `type`, if any, becomes X-File-Type.
 * Shared by `uploadAttachment` and `uploadPersonDocument`, which each build their own URL and query string.
 */
function uploadFile<T>(url: string, file: Blob, name: string, onProgress?: (loaded: number, total: number) => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.setRequestHeader('X-File-Name', encodeURIComponent(name));
    if (file.type) xhr.setRequestHeader('X-File-Type', file.type);
    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e) => onProgress(e.loaded, e.total);
    }
    xhr.onload = () => {
      let body: { error?: string; issues?: ValidationIssue[]; code?: MessageKey; params?: Params } = {};
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : {};
      } catch {
        body = {};
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as unknown as T);
        return;
      }
      const hasServerMessage = body.error !== undefined;
      reject(new ApiError(
        body.error ?? `Request failed (${xhr.status})`,
        xhr.status,
        body.issues ?? [],
        hasServerMessage ? body.code : 'common.requestFailed',
        hasServerMessage ? body.params : { status: xhr.status },
      ));
    };
    // A genuine network failure (offline, connection reset): left uncoded, like fetch's own thrown error, so
    // messagesOf falls back to the translated "could not reach the server" message instead of a raw browser string.
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(file);
  });
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Only declare JSON when there is a body: Fastify rejects an empty body sent as application/json.
  const headers = init?.body === undefined ? init?.headers : { 'Content-Type': 'application/json', ...init?.headers };
  const res = await fetch(path, { ...init, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // No server-supplied message (e.g. a non-JSON error response): fall back to a coded, translatable message
    // instead of a hard-coded English one. The English text stays exactly what it always was.
    const hasServerMessage = body.error !== undefined;
    throw new ApiError(
      body.error ?? `Request failed (${res.status})`,
      res.status,
      body.issues ?? [],
      hasServerMessage ? body.code : 'common.requestFailed',
      hasServerMessage ? body.params : { status: res.status },
    );
  }
  return body as T;
}

const withBody = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export interface ToDoFilterInput {
  projectId?: number;
  assigneeId?: number;
  includeDone?: boolean;
  fromRemovedPhases?: boolean;
}

/** Builds "?projectId=…&assigneeId=…&done=include&removed=1", including only the keys that are set. */
function toDoQuery(filter: ToDoFilterInput): string {
  const params = new URLSearchParams();
  if (filter.projectId !== undefined) params.set('projectId', String(filter.projectId));
  if (filter.assigneeId !== undefined) params.set('assigneeId', String(filter.assigneeId));
  if (filter.includeDone) params.set('done', 'include');
  if (filter.fromRemovedPhases) params.set('removed', '1');
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const api = {
  getCalendar: () => request<WorkCalendar>('/api/settings/calendar'),
  listProjects: () => request<ProjectRecord[]>('/api/projects'),
  getProject: (id: number) => request<ProjectRecord>(`/api/projects/${id}`),
  createProject: (input: NewProjectInput) => request<ProjectRecord>('/api/projects', withBody('POST', input)),
  updateProjectDetails: (id: number, input: ProjectDetailsInput) =>
    request<ProjectRecord>(`/api/projects/${id}/details`, withBody('PUT', input)),
  updateSchedule: (id: number, input: ScheduleUpdateInput) => request<ScheduleSaved>(`/api/projects/${id}/schedule`, withBody('PUT', input)),
  getPortfolio: (year: number) => request<PortfolioResponse>(`/api/portfolio?year=${year}`),
  getLists: () => request<Lists>('/api/lists'),
  addListValue: (list: ListName, name: string, nameAr?: string | null) =>
    request<ListValue>(`/api/lists/${list}`, withBody('POST', { name, nameAr })),
  renameListValue: (list: ListName, id: number, name: string, nameAr?: string | null) =>
    request<ListValue>(`/api/lists/${list}/${id}`, withBody('PUT', { name, nameAr })),
  deleteListValue: (list: ListName, id: number) => request<void>(`/api/lists/${list}/${id}`, { method: 'DELETE' }),
  listResources: () => request<ResourceRecord[]>('/api/resources'),
  createResource: (input: ResourceInput) => request<ResourceRecord>('/api/resources', withBody('POST', input)),
  updateResource: (id: number, input: ResourceInput) => request<ResourceRecord>(`/api/resources/${id}`, withBody('PUT', input)),
  deleteResource: (id: number) => request<void>(`/api/resources/${id}`, { method: 'DELETE' }),
  addLeave: (resourceId: number, input: LeaveInput) =>
    request<LeaveRecord>(`/api/resources/${resourceId}/leave`, withBody('POST', input)),
  deleteLeave: (id: number) => request<void>(`/api/leave/${id}`, { method: 'DELETE' }),
  setPhaseAssignments: (phaseId: number, assignments: AssignmentInput[]) =>
    request<ProjectRecord>(`/api/phases/${phaseId}/assignments`, withBody('PUT', { assignments })),
  getWorkload: () => request<WorkloadData>('/api/workload'),
  recordOverloadDecision: (input: OverloadDecisionInput) =>
    request<OverloadDecision>('/api/overloads/decisions', withBody('POST', input)),
  listToDos: (filter: ToDoFilterInput = {}) => request<ToDoRecord[]>(`/api/todos${toDoQuery(filter)}`),
  createToDo: (projectId: number, input: ToDoInput) => request<ToDoRecord>(`/api/projects/${projectId}/todos`, withBody('POST', input)),
  updateToDo: (id: number, input: ToDoInput) => request<ToDoRecord>(`/api/todos/${id}`, withBody('PUT', input)),
  deleteToDo: (id: number) => request<void>(`/api/todos/${id}`, { method: 'DELETE' }),
  getMe: () => request<Me>('/api/settings/me'),
  setMe: (resourceId: number | null) => request<Me>('/api/settings/me', withBody('PUT', { resourceId })),
  listStarters: () => request<StarterToDo[]>('/api/starter-todos'),
  addStarter: (input: StarterToDoInput) => request<StarterToDo>('/api/starter-todos', withBody('POST', input)),
  renameStarter: (id: number, title: string) => request<StarterToDo>(`/api/starter-todos/${id}`, withBody('PUT', { title })),
  deleteStarter: (id: number) => request<void>(`/api/starter-todos/${id}`, { method: 'DELETE' }),
  starterSuggestions: (projectId: number, phaseIds?: number[]) =>
    request<StarterSuggestion[]>(
      `/api/projects/${projectId}/starter-suggestions${phaseIds ? `?phaseIds=${phaseIds.join(',')}` : ''}`,
    ),
  acceptStarters: (projectId: number, items: { phaseId: number; title: string }[]) =>
    request<ToDoRecord[]>(`/api/projects/${projectId}/todos/from-starters`, withBody('POST', { items })),
  getBackupStatus: () => request<BackupStatus>('/api/backups'),
  listEntries: (projectId: number, phaseId?: number) =>
    request<EntryRecord[]>(`/api/projects/${projectId}/entries${phaseId !== undefined ? `?phaseId=${phaseId}` : ''}`),
  createEntry: (projectId: number, input: EntryInput) => request<EntryRecord>(`/api/projects/${projectId}/entries`, withBody('POST', input)),
  updateEntry: (id: number, input: EntryInput) => request<EntryRecord>(`/api/entries/${id}`, withBody('PUT', input)),
  deleteEntry: (id: number) => request<void>(`/api/entries/${id}`, { method: 'DELETE' }),
  listAttachments: (projectId: number, filter: { phaseId?: number; typeId?: number } = {}) => {
    const params = new URLSearchParams();
    if (filter.phaseId !== undefined) params.set('phaseId', String(filter.phaseId));
    if (filter.typeId !== undefined) params.set('typeId', String(filter.typeId));
    const qs = params.toString();
    return request<AttachmentRecord[]>(`/api/projects/${projectId}/attachments${qs ? `?${qs}` : ''}`);
  },
  /** See `uploadFile` above: this just builds the URL and query string for a project attachment. */
  uploadAttachment: (
    projectId: number, file: Blob, name: string,
    opts: { typeId?: number; phaseId?: number; documentDate?: string; entryId?: number } = {},
    onProgress?: (loaded: number, total: number) => void,
  ) => {
    const params = new URLSearchParams();
    if (opts.typeId !== undefined) params.set('typeId', String(opts.typeId));
    if (opts.phaseId !== undefined) params.set('phaseId', String(opts.phaseId));
    if (opts.documentDate !== undefined) params.set('documentDate', opts.documentDate);
    if (opts.entryId !== undefined) params.set('entryId', String(opts.entryId));
    const qs = params.toString();
    return uploadFile<AttachmentRecord>(`/api/projects/${projectId}/attachments${qs ? `?${qs}` : ''}`, file, name, onProgress);
  },
  updateAttachment: (id: number, input: AttachmentUpdateInput) => request<AttachmentRecord>(`/api/attachments/${id}`, withBody('PUT', input)),
  deleteAttachment: (id: number) => request<void>(`/api/attachments/${id}`, { method: 'DELETE' }),
  /** Not fetched through `request`: used directly as a link/iframe `href`/`src`. */
  attachmentFileUrl: (id: number, inline = false) => `/api/attachments/${id}/file${inline ? '?inline=1' : ''}`,

  listPersonDocuments: (resourceId: number) => request<PersonDocumentRecord[]>(`/api/resources/${resourceId}/documents`),
  /** See `uploadFile` above: this just builds the URL and query string for a person document. */
  uploadPersonDocument: (
    resourceId: number, file: Blob, name: string,
    opts: { typeId?: number; expiryDate?: string; note?: string } = {},
    onProgress?: (loaded: number, total: number) => void,
  ) => {
    const params = new URLSearchParams();
    if (opts.typeId !== undefined) params.set('typeId', String(opts.typeId));
    if (opts.expiryDate !== undefined) params.set('expiryDate', opts.expiryDate);
    if (opts.note !== undefined) params.set('note', opts.note);
    const qs = params.toString();
    return uploadFile<PersonDocumentRecord>(`/api/resources/${resourceId}/documents${qs ? `?${qs}` : ''}`, file, name, onProgress);
  },
  updatePersonDocument: (id: number, input: PersonDocumentUpdateInput) =>
    request<PersonDocumentRecord>(`/api/person-documents/${id}`, withBody('PUT', input)),
  deletePersonDocument: (id: number) => request<void>(`/api/person-documents/${id}`, { method: 'DELETE' }),
  /** Not fetched through `request`: used directly as a link/iframe `href`/`src`. */
  personDocumentFileUrl: (id: number, inline = false) => `/api/person-documents/${id}/file${inline ? '?inline=1' : ''}`,

  listPersonAccounts: (resourceId: number) => request<PersonAccountRecord[]>(`/api/resources/${resourceId}/accounts`),
  addPersonAccount: (resourceId: number, input: PersonAccountInput) =>
    request<PersonAccountRecord>(`/api/resources/${resourceId}/accounts`, withBody('POST', input)),
  updatePersonAccount: (id: number, input: PersonAccountInput) =>
    request<PersonAccountRecord>(`/api/person-accounts/${id}`, withBody('PUT', input)),
  deletePersonAccount: (id: number) => request<void>(`/api/person-accounts/${id}`, { method: 'DELETE' }),

  listExpiring: (withinDays = 30) => request<ExpiringItem[]>(`/api/people/expiring?withinDays=${withinDays}`),

  listKeyDates: (projectId: number) => request<KeyDateRecord[]>(`/api/projects/${projectId}/key-dates`),
  addKeyDate: (projectId: number, input: KeyDateInput) => request<KeyDateRecord>(`/api/projects/${projectId}/key-dates`, withBody('POST', input)),
  updateKeyDate: (id: number, input: KeyDateInput) => request<KeyDateRecord>(`/api/key-dates/${id}`, withBody('PUT', input)),
  deleteKeyDate: (id: number) => request<void>(`/api/key-dates/${id}`, { method: 'DELETE' }),
  listUpcomingKeyDates: (withinDays = 30) => request<UpcomingKeyDate[]>(`/api/key-dates/upcoming?withinDays=${withinDays}`),
};
