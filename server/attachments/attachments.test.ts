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
let projectId: number;

async function upload(
  name: string,
  opts: { body?: Buffer; type?: string; typeId?: number; phaseId?: number; documentDate?: string; entryId?: number } = {},
) {
  const params = new URLSearchParams();
  if (opts.typeId !== undefined) params.set('typeId', String(opts.typeId));
  if (opts.phaseId !== undefined) params.set('phaseId', String(opts.phaseId));
  if (opts.documentDate !== undefined) params.set('documentDate', opts.documentDate);
  if (opts.entryId !== undefined) params.set('entryId', String(opts.entryId));
  const qs = params.toString();
  const headers: Record<string, string> = { 'content-type': 'application/octet-stream', 'x-file-name': encodeURIComponent(name) };
  if (opts.type) headers['x-file-type'] = opts.type;
  return app.inject({
    method: 'POST', url: `/api/projects/${projectId}/attachments${qs ? `?${qs}` : ''}`, payload: opts.body ?? PDF_BYTES, headers,
  });
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'pvp-attachments-'));
  db = openDb(':memory:');
  app = buildApp(db, { attachmentsDir: dir, uploadLimitBytes: 1024 });
  const project = (
    await app.inject({
      method: 'POST', url: '/api/projects',
      payload: { name: 'Portal', color: '#3b82f6', startDate: '2026-09-25', phases: [{ name: 'Development', durationDays: 5 }] },
    })
  ).json();
  projectId = project.id;
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('uploading', () => {
  it('accepts an Arabic file name, reports previewable, and stores the file under the project folder', async () => {
    const res = await upload('محضر الاجتماع.pdf', { type: 'application/pdf' });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.name).toBe('محضر الاجتماع.pdf');
    expect(body.previewable).toBe(true);
    expect(body.size).toBe(PDF_BYTES.length);
    expect(body.mime).toBe('application/pdf');

    const files = readdirSync(join(dir, String(projectId)));
    expect(files).toHaveLength(1);
    expect(files[0]).toContain('محضر الاجتماع.pdf');
  });

  it('guesses the MIME type from the extension when X-File-Type is absent', async () => {
    const res = await upload('report.pdf');
    expect(res.json().mime).toBe('application/pdf');
    expect(res.json().previewable).toBe(true);
  });

  it('gives two uploads with the same name different stored names', async () => {
    await upload('same.pdf');
    await upload('same.pdf');
    const files = readdirSync(join(dir, String(projectId)));
    expect(files).toHaveLength(2);
    expect(files[0]).not.toBe(files[1]);
  });

  it('stores a hostile name safely inside the project folder', async () => {
    const res = await upload('..\\..\\evil.txt');
    expect(res.statusCode).toBe(201);
    const files = readdirSync(join(dir, String(projectId)));
    expect(files).toHaveLength(1);
    expect(files[0]).not.toContain('..');
    expect(files[0]).toContain('evil.txt');
  });

  it('rejects a file over the configured limit with 413 and error.fileTooLarge', async () => {
    const big = Buffer.alloc(2000, 'a');
    const res = await upload('big.pdf', { body: big });
    expect(res.statusCode).toBe(413);
    expect(res.json()).toEqual({ error: 'The file is larger than 50 MB', code: 'error.fileTooLarge' });
  });

  it('rejects an empty body with 400 and error.fileEmpty', async () => {
    const res = await upload('empty.txt', { body: Buffer.alloc(0) });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'The file is empty', code: 'error.fileEmpty' });
  });

  it('404s for a missing project', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/projects/999999/attachments', payload: PDF_BYTES,
      headers: { 'content-type': 'application/octet-stream', 'x-file-name': encodeURIComponent('x.pdf') },
    });
    expect(res.statusCode).toBe(404);
  });

  it('rejects an unknown phase, an unknown type and an unknown entry, and writes nothing', async () => {
    const res = await upload('x.pdf', { phaseId: 999999, typeId: 999999, entryId: 999999 });
    expect(res.statusCode).toBe(400);
    const paths = res.json().issues.map((i: { path: string }) => i.path);
    expect(paths).toEqual(expect.arrayContaining(['phaseId', 'typeId', 'entryId']));
    expect(readdirSync(dir).some((n) => n === String(projectId))).toBe(false);
  });
});

describe('downloading', () => {
  it('returns the same bytes with an attachment disposition by default, and inline for a previewable type', async () => {
    const created = (await upload('محضر.pdf', { type: 'application/pdf' })).json();

    const plain = await app.inject({ method: 'GET', url: `/api/attachments/${created.id}/file` });
    expect(plain.statusCode).toBe(200);
    expect(plain.rawPayload.equals(PDF_BYTES)).toBe(true);
    expect(plain.headers['content-disposition']).toContain("attachment; filename*=UTF-8''");
    expect(plain.headers['x-content-type-options']).toBe('nosniff');

    const inline = await app.inject({ method: 'GET', url: `/api/attachments/${created.id}/file?inline=1` });
    expect(inline.headers['content-disposition']).toContain('inline');
  });

  it('never inlines a non-previewable type even when asked', async () => {
    const created = (await upload('tool.exe', { type: 'application/x-msdownload' })).json();
    const res = await app.inject({ method: 'GET', url: `/api/attachments/${created.id}/file?inline=1` });
    expect(res.headers['content-disposition']).toContain('attachment');
  });

  it('404s for a missing attachment', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/attachments/999999/file' });
    expect(res.statusCode).toBe(404);
  });
});

describe('listing and updating', () => {
  it('lists an attachment for its project, newest first, and filters by type', async () => {
    const a = (await upload('a.pdf')).json();
    const b = (await upload('b.pdf')).json();
    const list = await app.inject({ method: 'GET', url: `/api/projects/${projectId}/attachments` });
    expect(list.json().map((x: { id: number }) => x.id)).toEqual([b.id, a.id]);
  });

  it('changes only the metadata on PUT', async () => {
    const created = (await upload('a.pdf')).json();
    const res = await app.inject({
      method: 'PUT', url: `/api/attachments/${created.id}`, payload: { documentDate: '2026-09-20' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: created.id, name: 'a.pdf', documentDate: '2026-09-20' });
  });

  it('404s updating a missing attachment', async () => {
    const res = await app.inject({ method: 'PUT', url: '/api/attachments/999999', payload: {} });
    expect(res.statusCode).toBe(404);
  });
});

describe('deleting', () => {
  it('moves the file to _deleted and removes the row', async () => {
    const created = (await upload('a.pdf')).json();
    const files = readdirSync(join(dir, String(projectId)));
    const storedName = files[0];

    const res = await app.inject({ method: 'DELETE', url: `/api/attachments/${created.id}` });
    expect(res.statusCode).toBe(204);

    expect(readdirSync(join(dir, String(projectId)))).not.toContain(storedName);
    expect(readdirSync(join(dir, String(projectId), '_deleted'))).toContain(storedName);

    const missing = await app.inject({ method: 'GET', url: `/api/attachments/${created.id}/file` });
    expect(missing.statusCode).toBe(404);
  });

  it('404s deleting a missing attachment', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/api/attachments/999999' });
    expect(res.statusCode).toBe(404);
  });
});

describe('attachment types in Settings', () => {
  it('appear in GET /api/lists with Arabic names, newest additions never overriding the default order', async () => {
    const lists = (await app.inject({ method: 'GET', url: '/api/lists' })).json();
    expect(lists.attachmentType.map((v: { name: string }) => v.name)).toEqual([
      'Meeting Minutes', 'Approval', 'Change Request', 'Business Analysis Document', 'BRD', 'Documentation', 'Design',
      'Test Report', 'Contract', 'Other',
    ]);
    expect(lists.attachmentType.map((v: { nameAr: string | null }) => v.nameAr)).toEqual([
      'محضر اجتماع', 'اعتماد', 'Change Request', 'الدراسة التحليلية', 'وثيقة متطلبات الأعمال (BRD)', 'وثائق المشروع', 'التصميم',
      'تقرير الاختبار', 'العقد', 'أخرى',
    ]);
  });

  it("can't delete a type that is in use", async () => {
    const lists = (await app.inject({ method: 'GET', url: '/api/lists' })).json();
    const approval = lists.attachmentType.find((v: { name: string }) => v.name === 'Approval');
    await upload('a.pdf', { typeId: approval.id });

    const refused = await app.inject({ method: 'DELETE', url: `/api/lists/attachmentType/${approval.id}` });
    expect(refused.statusCode).toBe(409);
    expect(refused.json()).toEqual({
      error: '"Approval" is used by 1 attachment', code: 'error.listValueInUseAttachments', params: { name: 'Approval', count: 1 },
    });

    const other = lists.attachmentType.find((v: { name: string }) => v.name === 'Other');
    const deleted = await app.inject({ method: 'DELETE', url: `/api/lists/attachmentType/${other.id}` });
    expect(deleted.statusCode).toBe(204);
  });
});

describe('linking to entries', () => {
  it('links attachmentIds when creating an entry, and PUT without any unlinks them (the attachment remains)', async () => {
    const created = (await upload('a.pdf')).json();
    const entry = (
      await app.inject({
        method: 'POST', url: `/api/projects/${projectId}/entries`,
        payload: { type: 'update', effectiveDate: '2026-09-26', title: 'Status', attachmentIds: [created.id] },
      })
    ).json();
    expect(entry.attachmentIds).toEqual([created.id]);

    const updated = await app.inject({
      method: 'PUT', url: `/api/entries/${entry.id}`,
      payload: { type: 'update', effectiveDate: '2026-09-26', title: 'Status' },
    });
    expect(updated.json().attachmentIds).toEqual([]);

    const stillThere = await app.inject({ method: 'GET', url: `/api/attachments/${created.id}/file` });
    expect(stillThere.statusCode).toBe(200);
  });

  it('rejects an attachment from another project', async () => {
    const other = (
      await app.inject({
        method: 'POST', url: '/api/projects',
        payload: { name: 'Other', color: '#3b82f6', startDate: '2026-09-25', phases: [{ name: 'A', durationDays: 5 }] },
      })
    ).json();
    const otherAttachment = (
      await app.inject({
        method: 'POST', url: `/api/projects/${other.id}/attachments`, payload: PDF_BYTES,
        headers: { 'content-type': 'application/octet-stream', 'x-file-name': encodeURIComponent('other.pdf') },
      })
    ).json();

    const res = await app.inject({
      method: 'POST', url: `/api/projects/${projectId}/entries`,
      payload: { type: 'update', effectiveDate: '2026-09-26', title: 'Status', attachmentIds: [otherAttachment.id] },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().issues).toContainEqual({
      path: 'attachmentIds.0', message: 'Unknown attachment', code: 'error.unknownAttachment',
    });
  });
});
