import { mkdirSync } from 'node:fs';
import { buildApp } from './app';
import { openDb } from './db';

mkdirSync('data', { recursive: true });
const db = openDb('data/pm.db');
const app = buildApp(db);

app
  .listen({ port: 3001, host: '127.0.0.1' })
  .then(() => console.log('API ready on http://127.0.0.1:3001'))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
