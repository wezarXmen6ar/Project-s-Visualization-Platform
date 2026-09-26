import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
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

async function person(name = 'Fatima Noor', side: 'tech' | 'business' = 'tech') {
  return (await app.inject({ method: 'POST', url: '/api/resources', payload: { name, side } })).json();
}

async function personDocumentType(name: string) {
  const lists = (await app.inject({ method: 'GET', url: '/api/lists' })).json();
  return (lists.personDocumentType.find((v: { name: string }) => v.name === name) as { id: number }).id;
}

async function accountType(name: string) {
  const lists = (await app.inject({ method: 'GET', url: '/api/lists' })).json();
  return (lists.accountType.find((v: { name: string }) => v.name === name) as { id: number }).id;
}

async function uploadDocument(
  resourceId: number,
  fileName: string,
  opts: { body?: Buffer; type?: string; typeId?: number; expiryDate?: string; note?: string } = {},
) {
  const params = new URLSearchParams();
  if (opts.typeId !== undefined) params.set('typeId', String(opts.typeId));
  if (opts.expiryDate !== undefined) params.set('expiryDate', opts.expiryDate);
  if (opts.note !== undefined) params.set('note', opts.note);
  const qs = params.toString();
  const headers: Record<string, string> = { 'content-type': 'application/octet-stream', 'x-file-name': encodeURIComponent(fileName) };
  if (opts.type) headers['x-file-type'] = opts.type;
  return app.inject({
    method: 'POST', url: `/api/resources/${resourceId}/documents${qs ? `?${qs}` : ''}`, payload: opts.body ?? PDF_BYTES, headers,
  });
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'pvp-person-documents-'));
  db = openDb(':memory:');
  today = () => '2026-09-26';
  app = buildApp(db, { attachmentsDir: dir, today });
});

afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('person documents', () => {
  it('uploads a passport with an expiry date, returning 201, and stores the file under attachments/people/<id>', async () => {
    const fatima = await person();
    const typeId = await personDocumentType('Passport');
    const res = await uploadDocument(fatima.id, 'passport.pdf', { type: 'application/pdf', typeId, expiryDate: '2027-01-01' });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.type).toEqual({ id: typeId, name: 'Passport', nameAr: 'جواز السفر' });
    expect(body.expiryDate).toBe('2027-01-01');
    expect(body.previewable).toBe(true);
    expect(body.state).toBe('fine');

    const files = readdirSync(join(dir, 'people', String(fatima.id)));
    expect(files).toHaveLength(1);
    expect(files[0]).toContain('passport.pdf');
  });

  it('accepts an Arabic file name and round-trips it; inline is offered only for previewable types', async () => {
    const fatima = await person();
    const pdf = (await uploadDocument(fatima.id, 'جواز السفر.pdf', { type: 'application/pdf' })).json();
    expect(pdf.name).toBe('جواز السفر.pdf');
    expect(pdf.previewable).toBe(true);

    const other = (await uploadDocument(fatima.id, 'notes.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })).json();
    expect(other.previewable).toBe(false);

    const inline = await app.inject({ method: 'GET', url: `/api/person-documents/${pdf.id}/file?inline=1` });
    expect(inline.headers['content-disposition']).toContain('inline');
    const download = await app.inject({ method: 'GET', url: `/api/person-documents/${other.id}/file?inline=1` });
    expect(download.headers['content-disposition']).toContain('attachment');
  });

  it('lists a person\'s documents, updates metadata, and 404s for an unknown person', async () => {
    const fatima = await person();
    const typeId = await personDocumentType('NDA');
    await uploadDocument(fatima.id, 'nda.pdf', { typeId });

    const listed = await app.inject({ method: 'GET', url: `/api/resources/${fatima.id}/documents` });
    expect(listed.json()).toHaveLength(1);
    const docId = listed.json()[0].id;

    const updated = await app.inject({
      method: 'PUT', url: `/api/person-documents/${docId}`, payload: { typeId, expiryDate: '2026-10-01', note: 'Renewed soon' },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().expiryDate).toBe('2026-10-01');
    expect(updated.json().note).toBe('Renewed soon');

    const missing = await app.inject({ method: 'GET', url: '/api/resources/999999/documents' });
    expect(missing.statusCode).toBe(404);
  });

  it('deletes a document, moving the file to _deleted', async () => {
    const fatima = await person();
    const doc = (await uploadDocument(fatima.id, 'nda.pdf')).json();
    const res = await app.inject({ method: 'DELETE', url: `/api/person-documents/${doc.id}` });
    expect(res.statusCode).toBe(204);
    expect(readdirSync(join(dir, 'people', String(fatima.id)))).toHaveLength(0);
    const deletedFiles = readdirSync(join(dir, '_deleted'));
    expect(deletedFiles).toHaveLength(1);

    const again = await app.inject({ method: 'DELETE', url: `/api/person-documents/${doc.id}` });
    expect(again.statusCode).toBe(404);
  });

  it('refuses to delete a person who has documents, with error.reasonHasDocuments', async () => {
    const fatima = await person();
    await uploadDocument(fatima.id, 'nda.pdf');
    await uploadDocument(fatima.id, 'passport.pdf');
    const res = await app.inject({ method: 'DELETE', url: `/api/resources/${fatima.id}` });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('error.personInUseDelete');
    expect(res.json().params.reasons).toEqual([{ code: 'error.reasonHasDocuments', count: 2 }]);
  });

  it('rejects an unknown document type', async () => {
    const fatima = await person();
    const res = await uploadDocument(fatima.id, 'nda.pdf', { typeId: 999999 });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/people/expiring — documents', () => {
  it('returns the expired and the soon ones but not a later one, each tagged with the person', async () => {
    const fatima = await person();
    const expired = (await uploadDocument(fatima.id, 'expired.pdf', { expiryDate: '2026-09-01' })).json();
    const soon = (await uploadDocument(fatima.id, 'soon.pdf', { expiryDate: '2026-10-10' })).json();
    const later = (await uploadDocument(fatima.id, 'later.pdf', { expiryDate: '2027-06-01' })).json();
    await uploadDocument(fatima.id, 'no-expiry.pdf');

    const res = await app.inject({ method: 'GET', url: '/api/people/expiring?withinDays=30' });
    expect(res.statusCode).toBe(200);
    const ids = res.json().map((i: { id: number; kind: string }) => `${i.kind}:${i.id}`);
    expect(ids).toContain(`document:${expired.id}`);
    expect(ids).toContain(`document:${soon.id}`);
    expect(ids).not.toContain(`document:${later.id}`);
    expect(res.json().find((i: { id: number }) => i.id === expired.id).state).toBe('expired');
    expect(res.json().find((i: { id: number }) => i.id === soon.id).state).toBe('soon');
    expect(res.json().find((i: { id: number }) => i.id === soon.id).person).toEqual({ id: fatima.id, name: 'Fatima Noor' });
    expect(res.json()).toHaveLength(2);
  });

  it('judges the state against the requested window, not the fixed 30 days, so a wider window is consistent', async () => {
    const fatima = await person();
    // 40 days after today (2026-09-26): outside the default 30-day window, inside a 60-day one.
    const doc = (await uploadDocument(fatima.id, 'in-40-days.pdf', { expiryDate: '2026-11-05' })).json();

    const narrow = await app.inject({ method: 'GET', url: '/api/people/expiring?withinDays=30' });
    expect(narrow.json().map((i: { id: number }) => i.id)).not.toContain(doc.id);

    const wide = await app.inject({ method: 'GET', url: '/api/people/expiring?withinDays=60' });
    const found = wide.json().find((i: { id: number }) => i.id === doc.id);
    expect(found).toBeDefined();
    expect(found.state).toBe('soon');
  });
});

describe('person accounts', () => {
  it('adds an account, lists it, updates it, and deletes it', async () => {
    const fatima = await person();
    const typeId = await accountType('Network account');
    const created = await app.inject({
      method: 'POST', url: `/api/resources/${fatima.id}/accounts`,
      payload: { typeId, expiryDate: '2026-11-01', remindDays: 45 },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().type).toEqual({ id: typeId, name: 'Network account', nameAr: 'أحقية الشبكة' });
    expect(created.json().state).toBe('soon');

    const listed = await app.inject({ method: 'GET', url: `/api/resources/${fatima.id}/accounts` });
    expect(listed.json()).toHaveLength(1);

    const updated = await app.inject({
      method: 'PUT', url: `/api/person-accounts/${created.json().id}`,
      payload: { typeId, expiryDate: '2027-01-01', remindDays: 30, note: 'Renewed on 2026-09-26, was 2026-11-01' },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().expiryDate).toBe('2027-01-01');
    expect(updated.json().note).toBe('Renewed on 2026-09-26, was 2026-11-01');

    const deleted = await app.inject({ method: 'DELETE', url: `/api/person-accounts/${created.json().id}` });
    expect(deleted.statusCode).toBe(204);
  });

  it('refuses to delete a person who has an account, with error.reasonHasAccounts', async () => {
    const fatima = await person();
    const typeId = await accountType('Email');
    await app.inject({ method: 'POST', url: `/api/resources/${fatima.id}/accounts`, payload: { typeId, expiryDate: '2026-12-01' } });
    const res = await app.inject({ method: 'DELETE', url: `/api/resources/${fatima.id}` });
    expect(res.statusCode).toBe(409);
    expect(res.json().params.reasons).toEqual([{ code: 'error.reasonHasAccounts', count: 1 }]);
  });

  it('rejects an unknown account type', async () => {
    const fatima = await person();
    const res = await app.inject({
      method: 'POST', url: `/api/resources/${fatima.id}/accounts`, payload: { typeId: 999999, expiryDate: '2026-12-01' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('refuses an account for a business-side person, with error.accountsTechOnly', async () => {
    const mariam = await person('Mariam', 'business');
    const res = await app.inject({
      method: 'POST', url: `/api/resources/${mariam.id}/accounts`, payload: { expiryDate: '2026-12-01' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('error.accountsTechOnly');
  });
});

describe('GET /api/people/expiring — accounts', () => {
  it('includes a 45-day reminder lead expiring in 40 days, but not a 30-day one expiring in 40 days', async () => {
    const fatima = await person();
    const typeId = await accountType('Network account');
    const forty = '2026-11-05'; // 40 days after 2026-09-26
    const warns = await app.inject({
      method: 'POST', url: `/api/resources/${fatima.id}/accounts`, payload: { typeId, expiryDate: forty, remindDays: 45 },
    });
    const doesNotWarn = await app.inject({
      method: 'POST', url: `/api/resources/${fatima.id}/accounts`, payload: { typeId, expiryDate: forty, remindDays: 30 },
    });

    const res = await app.inject({ method: 'GET', url: '/api/people/expiring?withinDays=30' });
    const ids = res.json().map((i: { id: number }) => i.id);
    expect(ids).toContain(warns.json().id);
    expect(ids).not.toContain(doesNotWarn.json().id);
  });

  it('returns documents and accounts together', async () => {
    const fatima = await person();
    const docTypeId = await personDocumentType('Passport');
    const accTypeId = await accountType('Network account');
    await uploadDocument(fatima.id, 'passport.pdf', { typeId: docTypeId, expiryDate: '2026-10-05' });
    await app.inject({
      method: 'POST', url: `/api/resources/${fatima.id}/accounts`, payload: { typeId: accTypeId, expiryDate: '2026-10-10' },
    });
    const res = await app.inject({ method: 'GET', url: '/api/people/expiring?withinDays=30' });
    const kinds = res.json().map((i: { kind: string }) => i.kind).sort();
    expect(kinds).toEqual(['account', 'document']);
  });
});

describe('residence', () => {
  it('is saved for a tech person and null for a business contact even if sent', async () => {
    const tech = await app.inject({
      method: 'POST', url: '/api/resources', payload: { name: 'Fatima Noor', side: 'tech', residence: 'abroad' },
    });
    expect(tech.json().residence).toBe('abroad');

    const business = await app.inject({
      method: 'POST', url: '/api/resources', payload: { name: 'Mariam', side: 'business', residence: 'uae' },
    });
    expect(business.json().residence).toBeNull();
  });
});

describe('/present renders no person documents', () => {
  it('the person-documents route is never referenced by any present/portfolio response shape', async () => {
    // Person documents and accounts are fetched only via /api/resources/:id/documents and /accounts, which the
    // presentation pages never call; this is a static guard that those endpoints exist only under /api and are
    // absent from the read-only portfolio payload.
    const fatima = await person();
    await uploadDocument(fatima.id, 'nda.pdf');
    const portfolio = await app.inject({ method: 'GET', url: '/api/portfolio' });
    expect(JSON.stringify(portfolio.json())).not.toContain('nda.pdf');
  });
});
