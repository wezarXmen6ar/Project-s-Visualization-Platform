import Fastify, { type FastifyError } from 'fastify';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { todayLocal, type ISODate } from '../shared/calendar';
import { translate } from '../shared/i18n/translate';
import { overlapsYear, portfolioStats } from '../shared/portfolio';
import { projectSpan } from '../shared/scheduler';
import {
  assignmentsUpdateSchema, attachmentUpdateSchema, attachmentUploadQuerySchema, entryInputSchema, keyDateInputSchema, keyDateReplaceSchema,
  leaveInputSchema,
  listValueInputSchema, meInputSchema, newProjectSchema, overloadDecisionSchema, personAccountInputSchema, personDocumentUpdateSchema,
  personDocumentUploadQuerySchema, projectDetailsSchema, resourceInputSchema, scheduleUpdateSchema, starterAcceptSchema, starterTitleSchema,
  starterToDoInputSchema, toDoInputSchema, toIssues,
} from '../shared/schemas';
import type { PortfolioResponse } from '../shared/types';
import { backupStatus } from './backup';
import {
  checkAssignmentPeople, isTechPerson, phaseAssignmentResourceIds, phaseProjectId, recordDecision, saveAssignments, workloadData,
} from './assignments/repo';
import {
  checkAttachmentRefs, createAttachment, deleteAttachmentRow, getAttachment, getAttachmentFile, listAttachments, updateAttachment,
} from './attachments/repo';
import {
  isPreviewable, makeStoredName, moveAttachmentFileToDeleted, parseUploadHeaders, readAttachmentFile, removeAttachmentFile,
  sendStoredFile, writeAttachmentFile,
} from './attachments/files';
import { transaction } from './db';
import { checkEntry, createEntry, deleteEntry, getEntry, listEntries, updateEntry } from './entries/repo';
import { addListValue, deleteListValue, getLists, isListName, renameListValue } from './lists/repo';
import { checkRefs, createProject, getProject, listProjects, updateProjectDetails, updateSchedule } from './projects/repo';
import {
  addLeave, checkResourceRefs, createResource, deleteLeave, deleteResource, getResource, listResources, updateResourceChecked,
} from './resources/repo';
import {
  checkPersonAccountRefs, createPersonAccount, deletePersonAccountRow, getPersonAccount, listPersonAccounts, updatePersonAccount,
} from './people/accounts';
import {
  checkPersonDocumentRefs, createPersonDocument, deletePersonDocumentRow, getPersonDocument, getPersonDocumentFile,
  listPersonDocuments, updatePersonDocument,
} from './people/documents';
import { listExpiring } from './people/expiring';
import {
  checkKeyDateRefs, createKeyDate, deleteKeyDateRow, getKeyDate, listKeyDates, listUpcomingKeyDates, replaceAttachmentKeyDates,
  updateKeyDate,
} from './keyDates/repo';
import { getCalendar, getMe, setMe } from './settings';
import { acceptStarters, addStarter, deleteStarter, listStarters, renameStarter, starterSuggestions } from './starters/repo';
import { checkToDo, createToDo, deleteToDo, getToDo, listToDos, updateToDo } from './todos/repo';

const DEFAULT_UPLOAD_LIMIT_BYTES = 50 * 1024 * 1024;

export interface AppOptions {
  /** Injectable clock so tests can fix "today". */
  today?: () => ISODate;
  /** Where daily database backups are kept. */
  backupDir?: string;
  /** Where uploaded files are kept, under `<dir>/<projectId>/`; deleted ones move to the shared `<dir>/_deleted/`. */
  attachmentsDir?: string;
  /** The largest upload accepted, in bytes. Lowered in tests instead of sending a real 50 MB buffer. */
  uploadLimitBytes?: number;
}

/** A plain error body from one of this route's own message keys (not from a repo result, which already carries one). */
function err(key: 'error.unknownList' | 'error.personNotFound' | 'error.leaveNotFound' | 'error.projectNotFound' |
  'error.phaseNotFound' | 'error.todoNotFound' | 'error.starterNotFound' | 'error.chooseTechTeamMember' | 'error.invalidYear' |
  'error.entryNotFound' | 'error.attachmentNotFound' | 'error.fileEmpty' | 'error.badFileName' |
  'error.personDocumentNotFound' | 'error.personAccountNotFound' | 'error.accountsTechOnly' | 'error.keyDateNotFound') {
  return { error: translate('en', key), code: key };
}

export function buildApp(db: DatabaseSync, opts: AppOptions = {}) {
  const today = opts.today ?? todayLocal;
  const backupDir = opts.backupDir ?? 'backups';
  const attachmentsDir = opts.attachmentsDir ?? 'attachments';
  const uploadLimitBytes = opts.uploadLimitBytes ?? DEFAULT_UPLOAD_LIMIT_BYTES;
  const projectAttachmentsDir = (projectId: number) => join(attachmentsDir, String(projectId));
  const personDocumentsDir = (resourceId: number) => join(attachmentsDir, 'people', String(resourceId));
  /** Whether a resource with this id exists at all, used by every route nested under `/api/resources/:id/...`. */
  const resourceExists = (id: number) => Boolean(db.prepare('SELECT id FROM resources WHERE id = ?').get(id));
  const deletedAttachmentsDir = join(attachmentsDir, '_deleted');
  const app = Fastify();

  app.addContentTypeParser('application/octet-stream', { parseAs: 'buffer', bodyLimit: uploadLimitBytes }, (_req, body, done) => {
    done(null, body);
  });

  app.setErrorHandler((error: FastifyError, req, reply) => {
    if (error.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
      // Only the upload route's own limit gets the file-specific message; any other route's body limit is generic.
      const isUpload = String(req.headers['content-type'] ?? '').startsWith('application/octet-stream');
      return isUpload
        ? reply.code(413).send({ error: translate('en', 'error.fileTooLarge'), code: 'error.fileTooLarge' })
        : reply.code(413).send({ error: translate('en', 'error.requestTooLarge'), code: 'error.requestTooLarge' });
    }
    return reply.code(error.statusCode ?? 500).send(error);
  });

  app.get('/api/health', async () => ({ ok: true }));

  app.get('/api/backups', async () => backupStatus(backupDir));

  app.get('/api/settings/calendar', async () => getCalendar(db));

  app.get('/api/lists', async () => getLists(db));

  app.post<{ Params: { list: string } }>('/api/lists/:list', async (req, reply) => {
    if (!isListName(req.params.list)) return reply.code(404).send(err('error.unknownList'));
    const parsed = listValueInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid value', issues: toIssues(parsed.error) });
    const { value, created } = addListValue(db, req.params.list, parsed.data.name, parsed.data.nameAr ?? null);
    return reply.code(created ? 201 : 200).send(value);
  });

  app.put<{ Params: { list: string; id: string } }>('/api/lists/:list/:id', async (req, reply) => {
    if (!isListName(req.params.list)) return reply.code(404).send(err('error.unknownList'));
    const parsed = listValueInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid value', issues: toIssues(parsed.error) });
    const result = renameListValue(db, req.params.list, Number(req.params.id), parsed.data.name, parsed.data.nameAr);
    return result.ok ? result.value : reply.code(result.status).send({ error: result.error, code: result.code, params: result.params });
  });

  app.delete<{ Params: { list: string; id: string } }>('/api/lists/:list/:id', async (req, reply) => {
    if (!isListName(req.params.list)) return reply.code(404).send(err('error.unknownList'));
    const result = deleteListValue(db, req.params.list, Number(req.params.id));
    return result.ok ? reply.code(204).send() : reply.code(result.status).send({ error: result.error, code: result.code, params: result.params });
  });

  app.get('/api/resources', async () => listResources(db, today()));

  app.post('/api/resources', async (req, reply) => {
    const parsed = resourceInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid person', issues: toIssues(parsed.error) });
    const issues = checkResourceRefs(db, parsed.data);
    if (issues.length > 0) return reply.code(400).send({ error: 'Invalid person', issues });
    return reply.code(201).send(createResource(db, parsed.data, today()));
  });

  app.put<{ Params: { id: string } }>('/api/resources/:id', async (req, reply) => {
    const parsed = resourceInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid person', issues: toIssues(parsed.error) });
    const issues = checkResourceRefs(db, parsed.data);
    if (issues.length > 0) return reply.code(400).send({ error: 'Invalid person', issues });
    const result = updateResourceChecked(db, Number(req.params.id), parsed.data, today());
    return result.ok ? result.resource : reply.code(result.status).send({ error: result.error, code: result.code, params: result.params });
  });

  app.delete<{ Params: { id: string } }>('/api/resources/:id', async (req, reply) => {
    const result = deleteResource(db, Number(req.params.id));
    return result.ok ? reply.code(204).send() : reply.code(result.status).send({ error: result.error, code: result.code, params: result.params });
  });

  app.post<{ Params: { id: string } }>('/api/resources/:id/leave', async (req, reply) => {
    const parsed = leaveInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid leave', issues: toIssues(parsed.error) });
    const leave = addLeave(db, Number(req.params.id), parsed.data);
    if (!leave) return reply.code(404).send(err('error.personNotFound'));
    return reply.code(201).send(leave);
  });

  app.delete<{ Params: { id: string } }>('/api/leave/:id', async (req, reply) =>
    deleteLeave(db, Number(req.params.id)) ? reply.code(204).send() : reply.code(404).send(err('error.leaveNotFound')));

  app.get<{ Params: { id: string } }>('/api/resources/:id/documents', async (req, reply) => {
    const resourceId = Number(req.params.id);
    if (!resourceExists(resourceId)) return reply.code(404).send(err('error.personNotFound'));
    return listPersonDocuments(db, resourceId, today());
  });

  app.post<{ Params: { id: string }; Querystring: { typeId?: string; expiryDate?: string; note?: string } }>(
    '/api/resources/:id/documents',
    async (req, reply) => {
      const resourceId = Number(req.params.id);
      if (!resourceExists(resourceId)) return reply.code(404).send(err('error.personNotFound'));

      const body = req.body;
      if (!Buffer.isBuffer(body) || body.length === 0) return reply.code(400).send(err('error.fileEmpty'));

      const headers = parseUploadHeaders(req.headers);
      if (!headers) return reply.code(400).send(err('error.badFileName'));
      const { originalName, mime } = headers;

      const parsedQuery = personDocumentUploadQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) return reply.code(400).send({ error: 'Invalid document', issues: toIssues(parsedQuery.error) });
      const { typeId, expiryDate, note } = parsedQuery.data;

      const issues = checkPersonDocumentRefs(db, { typeId });
      if (issues.length > 0) return reply.code(400).send({ error: 'Invalid document', issues });

      const dir = personDocumentsDir(resourceId);
      const storedName = makeStoredName(originalName);
      writeAttachmentFile(dir, storedName, body);
      try {
        const created = createPersonDocument(
          db, resourceId,
          { typeId, originalName, storedName, mime, size: body.length, expiryDate: expiryDate as ISODate | null, note },
          new Date().toISOString(), today(),
        );
        return reply.code(201).send(created);
      } catch (error) {
        try {
          removeAttachmentFile(dir, storedName);
        } catch {
          // Best effort: the insert already failed, so surface that error rather than a cleanup failure.
        }
        throw error;
      }
    },
  );

  app.get<{ Params: { id: string }; Querystring: { inline?: string } }>('/api/person-documents/:id/file', async (req, reply) => {
    const file = getPersonDocumentFile(db, Number(req.params.id));
    if (!file) return reply.code(404).send(err('error.personDocumentNotFound'));
    let data: Buffer;
    try {
      data = readAttachmentFile(personDocumentsDir(file.resourceId), file.storedName);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      return reply.code(404).send(err('error.personDocumentNotFound'));
    }
    const inline = req.query.inline === '1' && isPreviewable(file.mime);
    return sendStoredFile(reply, data, { originalName: file.originalName, mime: file.mime }, inline);
  });

  app.put<{ Params: { id: string } }>('/api/person-documents/:id', async (req, reply) => {
    const id = Number(req.params.id);
    const existing = getPersonDocument(db, id, today());
    if (!existing) return reply.code(404).send(err('error.personDocumentNotFound'));
    const parsed = personDocumentUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid document', issues: toIssues(parsed.error) });
    const issues = checkPersonDocumentRefs(db, parsed.data);
    if (issues.length > 0) return reply.code(400).send({ error: 'Invalid document', issues });
    return updatePersonDocument(db, id, parsed.data, today());
  });

  app.delete<{ Params: { id: string } }>('/api/person-documents/:id', async (req, reply) => {
    const id = Number(req.params.id);
    const file = getPersonDocumentFile(db, id);
    if (!file) return reply.code(404).send(err('error.personDocumentNotFound'));
    try {
      moveAttachmentFileToDeleted(personDocumentsDir(file.resourceId), file.storedName, deletedAttachmentsDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    deletePersonDocumentRow(db, id);
    return reply.code(204).send();
  });

  app.get<{ Params: { id: string } }>('/api/resources/:id/accounts', async (req, reply) => {
    const resourceId = Number(req.params.id);
    if (!resourceExists(resourceId)) return reply.code(404).send(err('error.personNotFound'));
    return listPersonAccounts(db, resourceId, today());
  });

  app.post<{ Params: { id: string } }>('/api/resources/:id/accounts', async (req, reply) => {
    const resourceId = Number(req.params.id);
    const person = getResource(db, resourceId, today());
    if (!person) return reply.code(404).send(err('error.personNotFound'));
    // Accounts are tech-side only (controller decision): a business contact only gets Documents.
    if (person.side !== 'tech') return reply.code(400).send(err('error.accountsTechOnly'));
    const parsed = personAccountInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid account', issues: toIssues(parsed.error) });
    const issues = checkPersonAccountRefs(db, parsed.data);
    if (issues.length > 0) return reply.code(400).send({ error: 'Invalid account', issues });
    return reply.code(201).send(createPersonAccount(db, resourceId, parsed.data, new Date().toISOString(), today()));
  });

  app.put<{ Params: { id: string } }>('/api/person-accounts/:id', async (req, reply) => {
    const id = Number(req.params.id);
    const existing = getPersonAccount(db, id, today());
    if (!existing) return reply.code(404).send(err('error.personAccountNotFound'));
    // Accounts are tech-side only (controller decision), the same rule POST enforces on creation.
    const owner = getResource(db, existing.resourceId, today());
    if (owner && owner.side !== 'tech') return reply.code(400).send(err('error.accountsTechOnly'));
    const parsed = personAccountInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid account', issues: toIssues(parsed.error) });
    const issues = checkPersonAccountRefs(db, parsed.data);
    if (issues.length > 0) return reply.code(400).send({ error: 'Invalid account', issues });
    return updatePersonAccount(db, id, parsed.data, today());
  });

  app.delete<{ Params: { id: string } }>('/api/person-accounts/:id', async (req, reply) =>
    deletePersonAccountRow(db, Number(req.params.id)) ? reply.code(204).send() : reply.code(404).send(err('error.personAccountNotFound')));

  app.get<{ Querystring: { withinDays?: string } }>('/api/people/expiring', async (req) => {
    const withinDays = Number(req.query.withinDays);
    return listExpiring(db, today(), Number.isInteger(withinDays) && withinDays > 0 ? withinDays : 30);
  });

  app.get('/api/projects', async () => listProjects(db));

  app.get<{ Params: { id: string } }>('/api/projects/:id', async (req, reply) => {
    const project = getProject(db, Number(req.params.id));
    if (!project) return reply.code(404).send(err('error.projectNotFound'));
    return project;
  });

  app.post('/api/projects', async (req, reply) => {
    const parsed = newProjectSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid project', issues: toIssues(parsed.error) });
    const issues = [
      ...checkRefs(db, parsed.data),
      ...parsed.data.phases.flatMap((p, i) => [
        ...checkAssignmentPeople(db, p.assignments, `phases.${i}.assignments`, new Set(), today()),
        ...p.subPhases.flatMap((s, j) =>
          checkAssignmentPeople(db, s.assignments, `phases.${i}.subPhases.${j}.assignments`, new Set(), today())),
      ]),
    ];
    if (issues.length > 0) return reply.code(400).send({ error: 'Invalid project', issues });
    return reply.code(201).send(createProject(db, getCalendar(db), parsed.data, today()));
  });

  app.put<{ Params: { id: string } }>('/api/projects/:id/details', async (req, reply) => {
    const parsed = projectDetailsSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid project', issues: toIssues(parsed.error) });
    const issues = checkRefs(db, parsed.data, getProject(db, Number(req.params.id))?.projectManager?.id ?? null);
    if (issues.length > 0) return reply.code(400).send({ error: 'Invalid project', issues });
    const project = updateProjectDetails(db, Number(req.params.id), parsed.data, today());
    if (!project) return reply.code(404).send(err('error.projectNotFound'));
    return project;
  });

  app.put<{ Params: { id: string } }>('/api/projects/:id/schedule', async (req, reply) => {
    const parsed = scheduleUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid schedule', issues: toIssues(parsed.error) });
    const result = updateSchedule(db, getCalendar(db), Number(req.params.id), parsed.data, today());
    if (result.ok) return result.saved;
    if (result.status === 404) return reply.code(404).send({ error: result.error, code: result.code });
    return reply.code(400).send({ error: 'Invalid schedule', issues: result.issues });
  });

  app.put<{ Params: { id: string } }>('/api/phases/:id/assignments', async (req, reply) => {
    const phaseId = Number(req.params.id);
    const projectId = phaseProjectId(db, phaseId);
    if (projectId === undefined) return reply.code(404).send(err('error.phaseNotFound'));
    const parsed = assignmentsUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid assignments', issues: toIssues(parsed.error) });
    const issues = checkAssignmentPeople(db, parsed.data.assignments, 'assignments', phaseAssignmentResourceIds(db, phaseId), today());
    if (issues.length > 0) return reply.code(400).send({ error: 'Invalid assignments', issues });
    transaction(db, () => saveAssignments(db, phaseId, parsed.data.assignments));
    return getProject(db, projectId);
  });

  app.get('/api/workload', async () => workloadData(db));

  app.post('/api/overloads/decisions', async (req, reply) => {
    const parsed = overloadDecisionSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid decision', issues: toIssues(parsed.error) });
    if (!isTechPerson(db, parsed.data.resourceId)) return reply.code(404).send(err('error.personNotFound'));
    return reply.code(201).send(recordDecision(db, parsed.data, today()));
  });

  app.get<{ Querystring: { projectId?: string; assigneeId?: string; done?: string; removed?: string } }>(
    '/api/todos',
    async (req) => {
      const filter: Parameters<typeof listToDos>[1] = {};
      const projectId = Number(req.query.projectId);
      if (Number.isInteger(projectId) && projectId > 0) filter.projectId = projectId;
      const assigneeId = Number(req.query.assigneeId);
      if (Number.isInteger(assigneeId) && assigneeId > 0) filter.assigneeId = assigneeId;
      if (req.query.done === 'include') filter.includeDone = true;
      if (req.query.removed === '1') filter.fromRemovedPhases = true;
      return listToDos(db, filter);
    },
  );

  app.post<{ Params: { id: string } }>('/api/projects/:id/todos', async (req, reply) => {
    const projectId = Number(req.params.id);
    if (!db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId)) return reply.code(404).send(err('error.projectNotFound'));
    const parsed = toDoInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid to-do', issues: toIssues(parsed.error) });
    const issues = checkToDo(db, projectId, parsed.data);
    if (issues.length > 0) return reply.code(400).send({ error: 'Invalid to-do', issues });
    return reply.code(201).send(createToDo(db, projectId, parsed.data, today()));
  });

  app.put<{ Params: { id: string } }>('/api/todos/:id', async (req, reply) => {
    const id = Number(req.params.id);
    const existing = getToDo(db, id);
    if (!existing) return reply.code(404).send(err('error.todoNotFound'));
    const parsed = toDoInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid to-do', issues: toIssues(parsed.error) });
    const issues = checkToDo(db, existing.projectId, parsed.data, existing);
    if (issues.length > 0) return reply.code(400).send({ error: 'Invalid to-do', issues });
    return updateToDo(db, id, parsed.data, today());
  });

  app.delete<{ Params: { id: string } }>('/api/todos/:id', async (req, reply) =>
    deleteToDo(db, Number(req.params.id)) ? reply.code(204).send() : reply.code(404).send(err('error.todoNotFound')));

  app.get<{ Params: { id: string }; Querystring: { phaseId?: string } }>('/api/projects/:id/entries', async (req, reply) => {
    const projectId = Number(req.params.id);
    if (!db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId)) return reply.code(404).send(err('error.projectNotFound'));
    const phaseId = Number(req.query.phaseId);
    const filter = Number.isInteger(phaseId) && phaseId > 0 ? { phaseId } : {};
    return listEntries(db, projectId, filter);
  });

  app.post<{ Params: { id: string } }>('/api/projects/:id/entries', async (req, reply) => {
    const projectId = Number(req.params.id);
    if (!db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId)) return reply.code(404).send(err('error.projectNotFound'));
    const parsed = entryInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid entry', issues: toIssues(parsed.error) });
    const issues = checkEntry(db, projectId, parsed.data);
    if (issues.length > 0) return reply.code(400).send({ error: 'Invalid entry', issues });
    return reply.code(201).send(createEntry(db, projectId, parsed.data));
  });

  app.put<{ Params: { id: string } }>('/api/entries/:id', async (req, reply) => {
    const id = Number(req.params.id);
    const existing = getEntry(db, id);
    if (!existing) return reply.code(404).send(err('error.entryNotFound'));
    const parsed = entryInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid entry', issues: toIssues(parsed.error) });
    const issues = checkEntry(db, existing.projectId, parsed.data, { skipFollowUps: true });
    if (issues.length > 0) return reply.code(400).send({ error: 'Invalid entry', issues });
    return updateEntry(db, id, parsed.data);
  });

  app.delete<{ Params: { id: string } }>('/api/entries/:id', async (req, reply) =>
    deleteEntry(db, Number(req.params.id)) ? reply.code(204).send() : reply.code(404).send(err('error.entryNotFound')));

  app.get<{ Params: { id: string }; Querystring: { phaseId?: string; typeId?: string } }>(
    '/api/projects/:id/attachments',
    async (req, reply) => {
      const projectId = Number(req.params.id);
      if (!db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId)) return reply.code(404).send(err('error.projectNotFound'));
      const filter: Parameters<typeof listAttachments>[2] = {};
      const phaseId = Number(req.query.phaseId);
      if (Number.isInteger(phaseId) && phaseId > 0) filter.phaseId = phaseId;
      const typeId = Number(req.query.typeId);
      if (Number.isInteger(typeId) && typeId > 0) filter.typeId = typeId;
      return listAttachments(db, projectId, filter);
    },
  );

  app.post<{ Params: { id: string }; Querystring: { typeId?: string; phaseId?: string; documentDate?: string; entryId?: string } }>(
    '/api/projects/:id/attachments',
    async (req, reply) => {
      const projectId = Number(req.params.id);
      if (!db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId)) return reply.code(404).send(err('error.projectNotFound'));

      const body = req.body;
      if (!Buffer.isBuffer(body) || body.length === 0) return reply.code(400).send(err('error.fileEmpty'));

      const headers = parseUploadHeaders(req.headers);
      if (!headers) return reply.code(400).send(err('error.badFileName'));
      const { originalName, mime } = headers;

      const parsedQuery = attachmentUploadQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) return reply.code(400).send({ error: 'Invalid attachment', issues: toIssues(parsedQuery.error) });
      const { typeId, phaseId, entryId, documentDate } = parsedQuery.data;

      const issues = checkAttachmentRefs(db, projectId, { typeId, phaseId, entryId });
      if (issues.length > 0) return reply.code(400).send({ error: 'Invalid attachment', issues });

      const dir = projectAttachmentsDir(projectId);
      const storedName = makeStoredName(originalName);
      writeAttachmentFile(dir, storedName, body);
      try {
        const created = createAttachment(
          db, projectId,
          { phaseId, entryId, typeId, originalName, storedName, mime, size: body.length, documentDate: documentDate as ISODate | null },
          new Date().toISOString(),
        );
        return reply.code(201).send(created);
      } catch (error) {
        try {
          removeAttachmentFile(dir, storedName);
        } catch {
          // Best effort: the insert already failed, so surface that error rather than a cleanup failure.
        }
        throw error;
      }
    },
  );

  app.get<{ Params: { id: string }; Querystring: { inline?: string } }>('/api/attachments/:id/file', async (req, reply) => {
    const file = getAttachmentFile(db, Number(req.params.id));
    if (!file) return reply.code(404).send(err('error.attachmentNotFound'));
    let data: Buffer;
    try {
      data = readAttachmentFile(projectAttachmentsDir(file.projectId), file.storedName);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      return reply.code(404).send(err('error.attachmentNotFound'));
    }
    const inline = req.query.inline === '1' && isPreviewable(file.mime);
    return sendStoredFile(reply, data, { originalName: file.originalName, mime: file.mime }, inline);
  });

  app.put<{ Params: { id: string } }>('/api/attachments/:id', async (req, reply) => {
    const id = Number(req.params.id);
    const existing = getAttachment(db, id);
    if (!existing) return reply.code(404).send(err('error.attachmentNotFound'));
    const parsed = attachmentUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid attachment', issues: toIssues(parsed.error) });
    const issues = checkAttachmentRefs(db, existing.projectId, parsed.data);
    if (issues.length > 0) return reply.code(400).send({ error: 'Invalid attachment', issues });
    return updateAttachment(db, id, parsed.data);
  });

  app.delete<{ Params: { id: string } }>('/api/attachments/:id', async (req, reply) => {
    const id = Number(req.params.id);
    const file = getAttachmentFile(db, id);
    if (!file) return reply.code(404).send(err('error.attachmentNotFound'));
    try {
      moveAttachmentFileToDeleted(projectAttachmentsDir(file.projectId), file.storedName, deletedAttachmentsDir);
    } catch (error) {
      // The row is still removed even when the file is already missing on disk; any other error (e.g. a locked
      // file) is surfaced as a 500 and the row is kept, so the file isn't silently orphaned.
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    deleteAttachmentRow(db, id);
    return reply.code(204).send();
  });

  app.get<{ Params: { id: string } }>('/api/projects/:id/key-dates', async (req, reply) => {
    const projectId = Number(req.params.id);
    if (!db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId)) return reply.code(404).send(err('error.projectNotFound'));
    return listKeyDates(db, projectId, today());
  });

  app.post<{ Params: { id: string } }>('/api/projects/:id/key-dates', async (req, reply) => {
    const projectId = Number(req.params.id);
    if (!db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId)) return reply.code(404).send(err('error.projectNotFound'));
    const parsed = keyDateInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid key date', issues: toIssues(parsed.error) });
    const issues = checkKeyDateRefs(db, projectId, parsed.data);
    if (issues.length > 0) return reply.code(400).send({ error: 'Invalid key date', issues });
    return reply.code(201).send(createKeyDate(db, projectId, parsed.data, new Date().toISOString(), today()));
  });

  app.put<{ Params: { id: string } }>('/api/key-dates/:id', async (req, reply) => {
    const id = Number(req.params.id);
    const existing = getKeyDate(db, id, today());
    if (!existing) return reply.code(404).send(err('error.keyDateNotFound'));
    const parsed = keyDateInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid key date', issues: toIssues(parsed.error) });
    const issues = checkKeyDateRefs(db, existing.projectId, parsed.data);
    if (issues.length > 0) return reply.code(400).send({ error: 'Invalid key date', issues });
    return updateKeyDate(db, id, parsed.data, today());
  });

  app.delete<{ Params: { id: string } }>('/api/key-dates/:id', async (req, reply) =>
    deleteKeyDateRow(db, Number(req.params.id)) ? reply.code(204).send() : reply.code(404).send(err('error.keyDateNotFound')));

  app.get<{ Querystring: { withinDays?: string } }>('/api/key-dates/upcoming', async (req) => {
    const withinDays = Number(req.query.withinDays);
    return listUpcomingKeyDates(db, today(), Number.isInteger(withinDays) && withinDays > 0 ? withinDays : 30);
  });

  // Replaces a file's whole set of key dates in one transaction (M7 review fix), so an upload's typed rows are
  // saved atomically with it. Used both right after an upload and from the Attachments tab's edit row.
  app.put<{ Params: { id: string } }>('/api/attachments/:id/key-dates', async (req, reply) => {
    const id = Number(req.params.id);
    const parsed = keyDateReplaceSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid key dates', issues: toIssues(parsed.error) });
    const result = replaceAttachmentKeyDates(db, id, parsed.data, new Date().toISOString(), today());
    if (!result) return reply.code(404).send(err('error.attachmentNotFound'));
    if ('issues' in result) return reply.code(400).send({ error: 'Invalid key dates', issues: result.issues });
    return result.keyDates;
  });

  app.get('/api/starter-todos', async () => listStarters(db));

  app.post('/api/starter-todos', async (req, reply) => {
    const parsed = starterToDoInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid starter to-do', issues: toIssues(parsed.error) });
    const result = addStarter(db, parsed.data);
    if ('error' in result) return reply.code(400).send({ error: result.error, code: result.code });
    return reply.code(201).send(result);
  });

  app.put<{ Params: { id: string } }>('/api/starter-todos/:id', async (req, reply) => {
    const parsed = starterTitleSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid starter to-do', issues: toIssues(parsed.error) });
    const result = renameStarter(db, Number(req.params.id), parsed.data.title);
    return result ?? reply.code(404).send(err('error.starterNotFound'));
  });

  app.delete<{ Params: { id: string } }>('/api/starter-todos/:id', async (req, reply) =>
    deleteStarter(db, Number(req.params.id)) ? reply.code(204).send() : reply.code(404).send(err('error.starterNotFound')));

  app.get<{ Params: { id: string }; Querystring: { phaseIds?: string } }>(
    '/api/projects/:id/starter-suggestions',
    async (req, reply) => {
      const projectId = Number(req.params.id);
      if (!db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId)) return reply.code(404).send(err('error.projectNotFound'));
      const phaseIds = req.query.phaseIds
        ? req.query.phaseIds
            .split(',')
            .map(Number)
            .filter((n) => Number.isInteger(n) && n > 0)
        : undefined;
      return starterSuggestions(db, projectId, phaseIds);
    },
  );

  app.post<{ Params: { id: string } }>('/api/projects/:id/todos/from-starters', async (req, reply) => {
    const projectId = Number(req.params.id);
    if (!db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId)) return reply.code(404).send(err('error.projectNotFound'));
    const parsed = starterAcceptSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid items', issues: toIssues(parsed.error) });
    const result = acceptStarters(db, projectId, parsed.data.items, today());
    if ('issues' in result) return reply.code(400).send({ error: 'Invalid items', issues: result.issues });
    return reply.code(201).send(result);
  });

  app.get('/api/settings/me', async () => getMe(db));

  app.put('/api/settings/me', async (req, reply) => {
    const parsed = meInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid person', issues: toIssues(parsed.error) });
    const { resourceId } = parsed.data;
    if (resourceId !== null) {
      const person = db.prepare("SELECT active FROM resources WHERE id = ? AND side = 'tech' AND employment = 'staff'").get(resourceId) as unknown as
        | { active: number }
        | undefined;
      if (!person || person.active !== 1) return reply.code(400).send(err('error.chooseTechTeamMember'));
    }
    setMe(db, resourceId);
    return getMe(db);
  });

  app.get<{ Querystring: { year?: string } }>('/api/portfolio', async (req, reply) => {
    const now = today();
    const year = req.query.year === undefined ? Number(now.slice(0, 4)) : Number(req.query.year);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return reply.code(400).send(err('error.invalidYear'));
    }
    const all = listProjects(db);
    const inYear = all.filter((p) => {
      const span = projectSpan(p.phases);
      return span !== null && overlapsYear(span, year);
    });
    const body: PortfolioResponse = { year, today: now, stats: portfolioStats(all, year, now), projects: inYear };
    return body;
  });

  return app;
}
