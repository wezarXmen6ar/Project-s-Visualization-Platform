import Fastify from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { todayLocal, type ISODate } from '../shared/calendar';
import { overlapsYear, portfolioStats } from '../shared/portfolio';
import { projectSpan } from '../shared/scheduler';
import {
  assignmentsUpdateSchema, leaveInputSchema, listValueInputSchema, meInputSchema, newProjectSchema, overloadDecisionSchema,
  projectDetailsSchema, resourceInputSchema, scheduleUpdateSchema, toDoInputSchema, toIssues,
} from '../shared/schemas';
import type { PortfolioResponse } from '../shared/types';
import {
  checkAssignmentPeople, isTechPerson, phaseAssignmentResourceIds, phaseProjectId, recordDecision, saveAssignments, workloadData,
} from './assignments/repo';
import { transaction } from './db';
import { addListValue, deleteListValue, getLists, isListName, renameListValue } from './lists/repo';
import { checkRefs, createProject, getProject, listProjects, updateProjectDetails, updateSchedule } from './projects/repo';
import {
  addLeave, checkResourceRefs, createResource, deleteLeave, deleteResource, listResources, updateResourceChecked,
} from './resources/repo';
import { getCalendar, getMe, setMe } from './settings';
import { checkToDo, createToDo, deleteToDo, getToDo, listToDos, updateToDo } from './todos/repo';

export interface AppOptions {
  /** Injectable clock so tests can fix "today". */
  today?: () => ISODate;
}

export function buildApp(db: DatabaseSync, opts: AppOptions = {}) {
  const today = opts.today ?? todayLocal;
  const app = Fastify();

  app.get('/api/health', async () => ({ ok: true }));

  app.get('/api/settings/calendar', async () => getCalendar(db));

  app.get('/api/lists', async () => getLists(db));

  app.post<{ Params: { list: string } }>('/api/lists/:list', async (req, reply) => {
    if (!isListName(req.params.list)) return reply.code(404).send({ error: 'Unknown list' });
    const parsed = listValueInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid value', issues: toIssues(parsed.error) });
    const { value, created } = addListValue(db, req.params.list, parsed.data.name);
    return reply.code(created ? 201 : 200).send(value);
  });

  app.put<{ Params: { list: string; id: string } }>('/api/lists/:list/:id', async (req, reply) => {
    if (!isListName(req.params.list)) return reply.code(404).send({ error: 'Unknown list' });
    const parsed = listValueInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid value', issues: toIssues(parsed.error) });
    const result = renameListValue(db, req.params.list, Number(req.params.id), parsed.data.name);
    return result.ok ? result.value : reply.code(result.status).send({ error: result.error });
  });

  app.delete<{ Params: { list: string; id: string } }>('/api/lists/:list/:id', async (req, reply) => {
    if (!isListName(req.params.list)) return reply.code(404).send({ error: 'Unknown list' });
    const result = deleteListValue(db, req.params.list, Number(req.params.id));
    return result.ok ? reply.code(204).send() : reply.code(result.status).send({ error: result.error });
  });

  app.get('/api/resources', async () => listResources(db));

  app.post('/api/resources', async (req, reply) => {
    const parsed = resourceInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid person', issues: toIssues(parsed.error) });
    const issues = checkResourceRefs(db, parsed.data);
    if (issues.length > 0) return reply.code(400).send({ error: 'Invalid person', issues });
    return reply.code(201).send(createResource(db, parsed.data));
  });

  app.put<{ Params: { id: string } }>('/api/resources/:id', async (req, reply) => {
    const parsed = resourceInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid person', issues: toIssues(parsed.error) });
    const issues = checkResourceRefs(db, parsed.data);
    if (issues.length > 0) return reply.code(400).send({ error: 'Invalid person', issues });
    const result = updateResourceChecked(db, Number(req.params.id), parsed.data);
    return result.ok ? result.resource : reply.code(result.status).send({ error: result.error });
  });

  app.delete<{ Params: { id: string } }>('/api/resources/:id', async (req, reply) => {
    const result = deleteResource(db, Number(req.params.id));
    return result.ok ? reply.code(204).send() : reply.code(result.status).send({ error: result.error });
  });

  app.post<{ Params: { id: string } }>('/api/resources/:id/leave', async (req, reply) => {
    const parsed = leaveInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid leave', issues: toIssues(parsed.error) });
    const leave = addLeave(db, Number(req.params.id), parsed.data);
    if (!leave) return reply.code(404).send({ error: 'Person not found' });
    return reply.code(201).send(leave);
  });

  app.delete<{ Params: { id: string } }>('/api/leave/:id', async (req, reply) =>
    deleteLeave(db, Number(req.params.id)) ? reply.code(204).send() : reply.code(404).send({ error: 'Leave not found' }));

  app.get('/api/projects', async () => listProjects(db));

  app.get<{ Params: { id: string } }>('/api/projects/:id', async (req, reply) => {
    const project = getProject(db, Number(req.params.id));
    if (!project) return reply.code(404).send({ error: 'Project not found' });
    return project;
  });

  app.post('/api/projects', async (req, reply) => {
    const parsed = newProjectSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid project', issues: toIssues(parsed.error) });
    const issues = [
      ...checkRefs(db, parsed.data),
      ...parsed.data.phases.flatMap((p, i) => [
        ...checkAssignmentPeople(db, p.assignments, `phases.${i}.assignments`),
        ...p.subPhases.flatMap((s, j) => checkAssignmentPeople(db, s.assignments, `phases.${i}.subPhases.${j}.assignments`)),
      ]),
    ];
    if (issues.length > 0) return reply.code(400).send({ error: 'Invalid project', issues });
    return reply.code(201).send(createProject(db, getCalendar(db), parsed.data, today()));
  });

  app.put<{ Params: { id: string } }>('/api/projects/:id/details', async (req, reply) => {
    const parsed = projectDetailsSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid project', issues: toIssues(parsed.error) });
    const issues = checkRefs(db, parsed.data);
    if (issues.length > 0) return reply.code(400).send({ error: 'Invalid project', issues });
    const project = updateProjectDetails(db, Number(req.params.id), parsed.data, today());
    if (!project) return reply.code(404).send({ error: 'Project not found' });
    return project;
  });

  app.put<{ Params: { id: string } }>('/api/projects/:id/schedule', async (req, reply) => {
    const parsed = scheduleUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid schedule', issues: toIssues(parsed.error) });
    const result = updateSchedule(db, getCalendar(db), Number(req.params.id), parsed.data, today());
    if (result.ok) return result.saved;
    if (result.status === 404) return reply.code(404).send({ error: result.error });
    return reply.code(400).send({ error: 'Invalid schedule', issues: result.issues });
  });

  app.put<{ Params: { id: string } }>('/api/phases/:id/assignments', async (req, reply) => {
    const phaseId = Number(req.params.id);
    const projectId = phaseProjectId(db, phaseId);
    if (projectId === undefined) return reply.code(404).send({ error: 'Phase not found' });
    const parsed = assignmentsUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid assignments', issues: toIssues(parsed.error) });
    const issues = checkAssignmentPeople(db, parsed.data.assignments, 'assignments', phaseAssignmentResourceIds(db, phaseId));
    if (issues.length > 0) return reply.code(400).send({ error: 'Invalid assignments', issues });
    transaction(db, () => saveAssignments(db, phaseId, parsed.data.assignments));
    return getProject(db, projectId);
  });

  app.get('/api/workload', async () => workloadData(db));

  app.post('/api/overloads/decisions', async (req, reply) => {
    const parsed = overloadDecisionSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid decision', issues: toIssues(parsed.error) });
    if (!isTechPerson(db, parsed.data.resourceId)) return reply.code(404).send({ error: 'Person not found' });
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
    if (!getProject(db, projectId)) return reply.code(404).send({ error: 'Project not found' });
    const parsed = toDoInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid to-do', issues: toIssues(parsed.error) });
    const issues = checkToDo(db, projectId, parsed.data);
    if (issues.length > 0) return reply.code(400).send({ error: 'Invalid to-do', issues });
    return reply.code(201).send(createToDo(db, projectId, parsed.data, today()));
  });

  app.put<{ Params: { id: string } }>('/api/todos/:id', async (req, reply) => {
    const id = Number(req.params.id);
    const existing = getToDo(db, id);
    if (!existing) return reply.code(404).send({ error: 'To-do not found' });
    const parsed = toDoInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid to-do', issues: toIssues(parsed.error) });
    const issues = checkToDo(db, existing.projectId, parsed.data, existing);
    if (issues.length > 0) return reply.code(400).send({ error: 'Invalid to-do', issues });
    return updateToDo(db, id, parsed.data, today());
  });

  app.delete<{ Params: { id: string } }>('/api/todos/:id', async (req, reply) =>
    deleteToDo(db, Number(req.params.id)) ? reply.code(204).send() : reply.code(404).send({ error: 'To-do not found' }));

  app.get('/api/settings/me', async () => getMe(db));

  app.put('/api/settings/me', async (req, reply) => {
    const parsed = meInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid person', issues: toIssues(parsed.error) });
    const { resourceId } = parsed.data;
    if (resourceId !== null) {
      const person = db.prepare("SELECT active FROM resources WHERE id = ? AND side = 'tech'").get(resourceId) as unknown as
        | { active: number }
        | undefined;
      if (!person || person.active !== 1) return reply.code(400).send({ error: 'Choose someone from your tech team' });
    }
    setMe(db, resourceId);
    return getMe(db);
  });

  app.get<{ Querystring: { year?: string } }>('/api/portfolio', async (req, reply) => {
    const now = today();
    const year = req.query.year === undefined ? Number(now.slice(0, 4)) : Number(req.query.year);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return reply.code(400).send({ error: 'year must be a whole number between 2000 and 2100' });
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
