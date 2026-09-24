import Fastify from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { todayLocal, type ISODate } from '../shared/calendar';
import { overlapsYear, portfolioStats } from '../shared/portfolio';
import { projectSpan } from '../shared/scheduler';
import { listValueInputSchema, newProjectSchema, projectDetailsSchema, toIssues } from '../shared/schemas';
import type { PortfolioResponse } from '../shared/types';
import { addListValue, deleteListValue, getLists, isListName, renameListValue } from './lists/repo';
import { checkListRefs, createProject, getProject, listProjects, updateProjectDetails } from './projects/repo';
import { getCalendar } from './settings';

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

  app.get('/api/projects', async () => listProjects(db));

  app.get<{ Params: { id: string } }>('/api/projects/:id', async (req, reply) => {
    const project = getProject(db, Number(req.params.id));
    if (!project) return reply.code(404).send({ error: 'Project not found' });
    return project;
  });

  app.post('/api/projects', async (req, reply) => {
    const parsed = newProjectSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid project', issues: toIssues(parsed.error) });
    const issues = checkListRefs(db, parsed.data);
    if (issues.length > 0) return reply.code(400).send({ error: 'Invalid project', issues });
    return reply.code(201).send(createProject(db, getCalendar(db), parsed.data, today()));
  });

  app.put<{ Params: { id: string } }>('/api/projects/:id/details', async (req, reply) => {
    const parsed = projectDetailsSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid project', issues: toIssues(parsed.error) });
    const issues = checkListRefs(db, parsed.data);
    if (issues.length > 0) return reply.code(400).send({ error: 'Invalid project', issues });
    const project = updateProjectDetails(db, Number(req.params.id), parsed.data, today());
    if (!project) return reply.code(404).send({ error: 'Project not found' });
    return project;
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
