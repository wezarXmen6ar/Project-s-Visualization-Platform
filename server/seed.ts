import { mkdirSync } from 'node:fs';
import { openDb } from './db';
import { seedDemo } from './demoData';
import { getCalendar } from './settings';

mkdirSync('data', { recursive: true });
const db = openDb('data/pm.db');
const { n } = db.prepare('SELECT COUNT(*) AS n FROM projects').get() as unknown as { n: number };

if (n > 0 && !process.argv.includes('--force')) {
  console.log(`The database already has ${n} project(s), so nothing was added.`);
  console.log('Run "npm run seed -- --force" to add the demo projects anyway.');
} else {
  console.log(`Added ${seedDemo(db, getCalendar(db))} demo projects.`);
}
