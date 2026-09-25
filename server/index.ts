import { mkdirSync } from 'node:fs';
import { todayLocal } from '../shared/calendar';
import { buildApp } from './app';
import { backupIfDue } from './backup';
import { openDb } from './db';

mkdirSync('data', { recursive: true });
const db = openDb('data/pm.db');
const app = buildApp(db);

const HOUR_MS = 60 * 60 * 1000;

function takeBackupIfDue(): void {
  try {
    backupIfDue(db, 'backups', todayLocal());
  } catch (err) {
    console.error(err);
  }
}

takeBackupIfDue();
setInterval(takeBackupIfDue, HOUR_MS);

app
  .listen({ port: 3001, host: '127.0.0.1' })
  .then(() => console.log('API ready on http://127.0.0.1:3001'))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
