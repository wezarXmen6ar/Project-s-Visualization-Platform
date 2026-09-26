import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import { openDb } from '../db';

const PDF_BYTES = Buffer.from('%PDF-1.4 fake pdf content');

let dir: string;
let db: DatabaseSync;
let app: ReturnType<typeof buildApp>;
let today: () => string;
let projectId: number;

async function otherProject() {
  const res = await app.inject({
    method: 'POST', url: '/api/projects',
    payload: { name: 'Other', color: '#3b82f6', startDate: '2026-09-25', phases: [{ name: 'Development', durationDays: 5 }] },
  });
  return res.json().id as number;
}

async function keyDateType(name: string) {
  const lists = (await app.inject({ method: 'GET', url: '/api/lists' })).json();
  return (lists.keyDateType.find((v: { name: string }) => v.name === name) as { id: number }).id;
}

async function attachmentType(name: string) {
  const lists = (await app.inject({ method: 'GET', url: '/api/lists' })).json();
  return (lists.attachmentType.find((v: { name: string }) => v.name === name) as { id: number }).id;
}

async function upload(pid: number, name: string, opts: { typeId?: number } = {}) {
  const params = new URLSearchParams();
  if (opts.typeId !== undefined) params.set('typeId', String(opts.typeId));
  const qs = params.toString();
  const res = await app.inject({
    method: 'POST', url: `/api/projects/${pid}/attachments${qs ? `?${qs}` : ''}`, payload: PDF_BYTES,
    headers: { 'content-type': 'application/octet-stream', 'x-file-name': encodeURIComponent(name), 'x-file-type': 'application/pdf' },
  });
  return res.json();
}

function addKeyDate(pid: number, payload: { typeId?: number | null; date: string; note?: string | null; attachmentId?: number | null }) {
  return app.inject({ method: 'POST', url: `/api/projects/${pid}/key-dates`, payload });
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'pvp-key-dates-'));
  db = openDb(':memory:');
  today = () => '2026-09-26';
  app = buildApp(db, { attachmentsDir: dir, today });
  const project = (
    await app.inject({
      method: 'POST', url: '/api/projects',
      payload: { name: 'Portal', color: '#3b82f6', startDate: '2026-09-25', phases: [{ name: 'Development', durationDays: 5 }] },
    })
  ).json();
  projectId = project.id;
});

afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('creating and listing key dates', () => {
  it('creates a key date with a type and a note, and lists it soonest first', async () => {
    const typeId = await keyDateType('License expiry');
    const soon = await addKeyDate(projectId, { typeId, date: '2026-10-10', note: 'Renew before this' });
    expect(soon.statusCode).toBe(201);
    expect(soon.json().type).toEqual({ id: typeId, name: 'License expiry', nameAr: 'انتهاء الترخيص' });
    expect(soon.json().note).toBe('Renew before this');
    expect(soon.json().attachment).toBeNull();
    expect(soon.json().state).toBe('soon');

    const later = await addKeyDate(projectId, { date: '2026-12-01' });
    const listed = await app.inject({ method: 'GET', url: `/api/projects/${projectId}/key-dates` });
    expect(listed.json().map((k: { id: number }) => k.id)).toEqual([soon.json().id, later.json().id]);
  });

  it('links a key date to an attachment from the same project, and reports it in the list', async () => {
    const attachment = await upload(projectId, 'contract.pdf', { typeId: await attachmentType('Contract') });
    const created = await addKeyDate(projectId, { date: '2026-10-10', attachmentId: attachment.id });
    expect(created.statusCode).toBe(201);
    expect(created.json().attachment).toEqual({ id: attachment.id, name: 'contract.pdf', mime: 'application/pdf', previewable: true });
  });

  it('rejects an attachment id from a different project, with 400 error.unknownAttachment', async () => {
    const other = await otherProject();
    const attachment = await upload(other, 'contract.pdf');
    const res = await addKeyDate(projectId, { date: '2026-10-10', attachmentId: attachment.id });
    expect(res.statusCode).toBe(400);
    expect(res.json().issues[0].code).toBe('error.unknownAttachment');
  });

  it('rejects an unknown key date type', async () => {
    const res = await addKeyDate(projectId, { date: '2026-10-10', typeId: 999999 });
    expect(res.statusCode).toBe(400);
  });

  it('404s creating a key date for an unknown project', async () => {
    const res = await addKeyDate(999999, { date: '2026-10-10' });
    expect(res.statusCode).toBe(404);
  });
});

describe('updating and deleting a key date', () => {
  it('updates its type, date and note, and 404s for an unknown one', async () => {
    const created = (await addKeyDate(projectId, { date: '2026-10-10' })).json();
    const typeId = await keyDateType('Contract end');
    const updated = await app.inject({
      method: 'PUT', url: `/api/key-dates/${created.id}`, payload: { typeId, date: '2026-11-01', note: 'Updated' },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().date).toBe('2026-11-01');
    expect(updated.json().note).toBe('Updated');

    const missing = await app.inject({ method: 'PUT', url: '/api/key-dates/999999', payload: { date: '2026-11-01' } });
    expect(missing.statusCode).toBe(404);
  });

  it('deletes a key date, and 404s deleting it again', async () => {
    const created = (await addKeyDate(projectId, { date: '2026-10-10' })).json();
    const res = await app.inject({ method: 'DELETE', url: `/api/key-dates/${created.id}` });
    expect(res.statusCode).toBe(204);
    const again = await app.inject({ method: 'DELETE', url: `/api/key-dates/${created.id}` });
    expect(again.statusCode).toBe(404);
  });
});

describe('deleting the linked attachment', () => {
  it('keeps the key date, with attachment: null', async () => {
    const attachment = await upload(projectId, 'contract.pdf');
    const created = (await addKeyDate(projectId, { date: '2026-10-10', attachmentId: attachment.id })).json();
    const del = await app.inject({ method: 'DELETE', url: `/api/attachments/${attachment.id}` });
    expect(del.statusCode).toBe(204);

    const listed = await app.inject({ method: 'GET', url: `/api/projects/${projectId}/key-dates` });
    const found = listed.json().find((k: { id: number }) => k.id === created.id);
    expect(found.attachment).toBeNull();
  });
});

describe('GET /api/key-dates/upcoming', () => {
  it('returns a soon one and one that passed last week, but not one 60 days ahead or one that passed 2 months ago', async () => {
    const soon = (await addKeyDate(projectId, { date: '2026-10-10' })).json(); // 14 days ahead
    const passedLastWeek = (await addKeyDate(projectId, { date: '2026-09-19' })).json(); // 7 days ago
    const farAhead = (await addKeyDate(projectId, { date: '2026-11-25' })).json(); // 60 days ahead
    const passedLongAgo = (await addKeyDate(projectId, { date: '2026-07-27' })).json(); // ~2 months ago

    const res = await app.inject({ method: 'GET', url: '/api/key-dates/upcoming?withinDays=30' });
    expect(res.statusCode).toBe(200);
    const ids = res.json().map((k: { id: number }) => k.id);
    expect(ids).toContain(soon.id);
    expect(ids).toContain(passedLastWeek.id);
    expect(ids).not.toContain(farAhead.id);
    expect(ids).not.toContain(passedLongAgo.id);
    expect(res.json().find((k: { id: number }) => k.id === soon.id).state).toBe('soon');
    expect(res.json().find((k: { id: number }) => k.id === passedLastWeek.id).state).toBe('expired');
    expect(res.json().find((k: { id: number }) => k.id === soon.id).project).toEqual({ id: projectId, name: 'Portal' });
  });
});

describe('/present renders no key dates', () => {
  it('the key-dates routes are never referenced by the read-only portfolio response', async () => {
    await addKeyDate(projectId, { date: '2026-10-10', note: 'Only in management' });
    const portfolio = await app.inject({ method: 'GET', url: '/api/portfolio' });
    expect(JSON.stringify(portfolio.json())).not.toContain('Only in management');
  });
});
