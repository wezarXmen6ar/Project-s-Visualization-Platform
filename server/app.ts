import Fastify from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { newProjectSchema, toIssues } from '../shared/schemas';
import { createProject, getProject, listProjects } from './projects/repo';
import { getCalendar } from './settings';

export function buildApp(db: DatabaseSync) {
  const app = Fastify();

  app.get('/api/health', async () => ({ ok: true }));

  app.get('/api/settings/calendar', async () => getCalendar(db));

  app.get('/api/projects', async () => listProjects(db));

  app.get<{ Params: { id: string } }>('/api/projects/:id', async (req, reply) => {
    const project = getProject(db, Number(req.params.id));
    if (!project) return reply.code(404).send({ error: 'Project not found' });
    return project;
  });

  app.post('/api/projects', async (req, reply) => {
    const parsed = newProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid project', issues: toIssues(parsed.error) });
    }
    return reply.code(201).send(createProject(db, getCalendar(db), parsed.data));
  });

  return app;
}
