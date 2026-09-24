import { mkdirSync } from 'node:fs';
import { newProjectSchema } from '../shared/schemas';
import { openDb } from './db';
import { DEMO_PROJECTS } from './demoData';
import { createProject } from './projects/repo';
import { getCalendar } from './settings';

mkdirSync('data', { recursive: true });
const db = openDb('data/pm.db');
const { n } = db.prepare('SELECT COUNT(*) AS n FROM projects').get() as unknown as { n: number };

if (n > 0 && !process.argv.includes('--force')) {
  console.log(`The database already has ${n} project(s), so nothing was added.`);
  console.log('Run "npm run seed -- --force" to add the demo projects anyway.');
} else {
  const cal = getCalendar(db);
  for (const project of DEMO_PROJECTS) createProject(db, cal, newProjectSchema.parse(project));
  console.log(`Added ${DEMO_PROJECTS.length} demo projects.`);
}
