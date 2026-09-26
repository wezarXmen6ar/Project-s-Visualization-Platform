import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../app';
import { openDb } from '../db';
import * as files from './files';

const PDF_BYTES = Buffer.from('%PDF-1.4 fake pdf content');
const SVG_BYTES = Buffer.from('<svg onload="alert(1)"><script>alert(1)</script></svg>');

let dir: string;
let db: DatabaseSync;
let app: ReturnType<typeof buildApp>;
let projectId: number;
let devPhaseId: number;
let subPhaseId: number;
let qaPhaseId: number;

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
      payload: {
        name: 'Portal', color: '#3b82f6', startDate: '2026-09-25',
        phases: [
          { name: 'Development', durationDays: 5, subPhases: [{ name: 'Increment 1', durationDays: 5 }] },
          { name: 'QA', durationDays: 3 },
        ],
      },
    })
  ).json();
  projectId = project.id;
  devPhaseId = project.phases[0].id;
  subPhaseId = project.phases[0].subPhases[0].id;
  qaPhaseId = project.phases[1].id;
});

afterEach(() => {
  vi.restoreAllMocks();
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
    const stored = readdirSync(join(dir, String(projectId)));
    expect(stored).toHaveLength(1);
    expect(stored[0]).not.toContain('..');
    expect(stored[0]).toContain('evil.txt');
  });

  it.each(['../x.txt', '..', '.'])('stores the hostile name %j safely inside the project folder', async (name) => {
    const res = await upload(name);
    expect(res.statusCode).toBe(201);
    const stored = readdirSync(join(dir, String(projectId)));
    expect(stored).toHaveLength(1);
    expect(stored[0]).not.toContain('..');
    // Every character of the folder-traversal name is stripped or already safe, so the stored name still parses
    // as "<uuid>-<sanitised>" and stays inside the project folder rather than escaping it.
    expect(stored[0]).toMatch(/^[0-9a-f-]{36}-.+$/);
  });

  it('ignores a bogus X-File-Type header and guesses the MIME type from the extension instead', async () => {
    const res = await upload('report.pdf', { type: 'javascript:alert(1)' });
    expect(res.statusCode).toBe(201);
    expect(res.json().mime).toBe('application/pdf');
  });

  it('rejects an X-File-Name that is not valid percent-encoding with 400 and error.badFileName', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/projects/${projectId}/attachments`, payload: PDF_BYTES,
      headers: { 'content-type': 'application/octet-stream', 'x-file-name': '%' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "The file name couldn't be read", code: 'error.badFileName' });
  });

  it('rejects a non-numeric typeId with 400 and issues', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/projects/${projectId}/attachments?typeId=abc`, payload: PDF_BYTES,
      headers: { 'content-type': 'application/octet-stream', 'x-file-name': encodeURIComponent('x.pdf') },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().issues.map((i: { path: string }) => i.path)).toContain('typeId');
  });

  it('rejects a malformed documentDate with 400 and issues', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/projects/${projectId}/attachments?documentDate=31%2F12%2F2026`, payload: PDF_BYTES,
      headers: { 'content-type': 'application/octet-stream', 'x-file-name': encodeURIComponent('x.pdf') },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().issues).toContainEqual({
      path: 'documentDate', message: 'Must be a valid date (YYYY-MM-DD)', code: 'validation.invalidDate',
    });
  });

  it('treats empty typeId and documentDate values as absent', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/projects/${projectId}/attachments?typeId=&documentDate=`, payload: PDF_BYTES,
      headers: { 'content-type': 'application/octet-stream', 'x-file-name': encodeURIComponent('x.pdf') },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ type: null, documentDate: null });
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
    // A PDF skips `sandbox`, which some PDF viewers refuse to run under; every other type keeps it.
    expect(plain.headers['content-security-policy']).toBe("default-src 'none'; img-src 'self'; style-src 'unsafe-inline'");

    const inline = await app.inject({ method: 'GET', url: `/api/attachments/${created.id}/file?inline=1` });
    expect(inline.headers['content-disposition']).toContain('inline');
  });

  it('never inlines a non-previewable type even when asked', async () => {
    const created = (await upload('tool.exe', { type: 'application/x-msdownload' })).json();
    const res = await app.inject({ method: 'GET', url: `/api/attachments/${created.id}/file?inline=1` });
    expect(res.headers['content-disposition']).toContain('attachment');
  });

  it('never inlines an SVG even when asked, so a script inside it never runs in the browser', async () => {
    const created = (await upload('evil.svg', { type: 'image/svg+xml', body: SVG_BYTES })).json();
    expect(created.previewable).toBe(false);
    const res = await app.inject({ method: 'GET', url: `/api/attachments/${created.id}/file?inline=1` });
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['content-security-policy']).toBe("default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
  });

  it('never inlines an SVG whose declared type uses capitals, and stores the type in lower case', async () => {
    const created = (await upload('evil.svg', { type: 'image/SVG+xml', body: SVG_BYTES })).json();
    expect(created.previewable).toBe(false);
    expect(created.mime).toBe('image/svg+xml');
    const res = await app.inject({ method: 'GET', url: `/api/attachments/${created.id}/file?inline=1` });
    expect(res.headers['content-disposition']).toContain('attachment');
  });

  it('404s for a missing attachment', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/attachments/999999/file' });
    expect(res.statusCode).toBe(404);
  });
});

describe('listing and updating', () => {
  it('lists attachments for their project, newest first', async () => {
    const a = (await upload('a.pdf')).json();
    const b = (await upload('b.pdf')).json();
    const list = await app.inject({ method: 'GET', url: `/api/projects/${projectId}/attachments` });
    expect(list.json().map((x: { id: number }) => x.id)).toEqual([b.id, a.id]);
  });

  it('filters by typeId', async () => {
    const lists = (await app.inject({ method: 'GET', url: '/api/lists' })).json();
    const approval = lists.attachmentType.find((v: { name: string }) => v.name === 'Approval');
    const contract = lists.attachmentType.find((v: { name: string }) => v.name === 'Contract');
    const withApproval = (await upload('approved.pdf', { typeId: approval.id })).json();
    await upload('contract.pdf', { typeId: contract.id });
    await upload('untyped.pdf');

    const res = await app.inject({ method: 'GET', url: `/api/projects/${projectId}/attachments?typeId=${approval.id}` });
    expect(res.json().map((x: { id: number }) => x.id)).toEqual([withApproval.id]);
  });

  it("filters by phaseId, including a top-level phase's sub-phases", async () => {
    const onDev = (await upload('on-dev.pdf', { phaseId: devPhaseId })).json();
    const onSub = (await upload('on-sub.pdf', { phaseId: subPhaseId })).json();
    const onQa = (await upload('on-qa.pdf', { phaseId: qaPhaseId })).json();

    const forDev = await app.inject({ method: 'GET', url: `/api/projects/${projectId}/attachments?phaseId=${devPhaseId}` });
    expect(forDev.json().map((x: { id: number }) => x.id)).toEqual(expect.arrayContaining([onDev.id, onSub.id]));
    expect(forDev.json().map((x: { id: number }) => x.id)).not.toContain(onQa.id);

    const forSub = await app.inject({ method: 'GET', url: `/api/projects/${projectId}/attachments?phaseId=${subPhaseId}` });
    expect(forSub.json().map((x: { id: number }) => x.id)).toEqual([onSub.id]);
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
  it('moves the file to the one shared _deleted folder at the root of the attachments dir, and removes the row', async () => {
    const created = (await upload('a.pdf')).json();
    const storedFiles = readdirSync(join(dir, String(projectId)));
    const storedName = storedFiles[0];

    const res = await app.inject({ method: 'DELETE', url: `/api/attachments/${created.id}` });
    expect(res.statusCode).toBe(204);

    expect(readdirSync(join(dir, String(projectId)))).not.toContain(storedName);
    // `_deleted` sits directly under the attachments dir, not under the project folder, so Task 8's person
    // documents (a different folder entirely) land in the same place.
    expect(readdirSync(join(dir, '_deleted'))).toContain(storedName);

    const missing = await app.inject({ method: 'GET', url: `/api/attachments/${created.id}/file` });
    expect(missing.statusCode).toBe(404);
  });

  it('404s deleting a missing attachment', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/api/attachments/999999' });
    expect(res.statusCode).toBe(404);
  });

  it('keeps the row and answers 500 when moving the file fails for a reason other than it being missing', async () => {
    const created = (await upload('a.pdf')).json();
    vi.spyOn(files, 'moveAttachmentFileToDeleted').mockImplementation(() => {
      const error = new Error('EBUSY: resource busy or locked');
      throw error;
    });

    const res = await app.inject({ method: 'DELETE', url: `/api/attachments/${created.id}` });
    expect(res.statusCode).toBe(500);

    const still = await app.inject({ method: 'GET', url: `/api/attachments/${created.id}/file` });
    expect(still.statusCode).toBe(200);
  });

  it('removes the row when the file is already missing (ENOENT is ignored)', async () => {
    const created = (await upload('a.pdf')).json();
    const storedFiles = readdirSync(join(dir, String(projectId)));
    rmSync(join(dir, String(projectId), storedFiles[0]));

    const res = await app.inject({ method: 'DELETE', url: `/api/attachments/${created.id}` });
    expect(res.statusCode).toBe(204);

    const missing = await app.inject({ method: 'GET', url: `/api/attachments/${created.id}/file` });
    expect(missing.statusCode).toBe(404);
  });
});

describe('attachment types in Settings', () => {
  it('appear in GET /api/lists with Arabic names, in their seeded order', async () => {
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

describe('sanitiseFileName', () => {
  it('keeps Arabic diacritics such as a shadda', () => {
    // "مُحَمَّد" carries fatha, damma and shadda marks on top of its letters.
    expect(files.sanitiseFileName('مُحَمَّد.pdf')).toBe('مُحَمَّد.pdf');
  });

  it('strips trailing dots and spaces before cutting to length (Windows cannot keep either)', () => {
    expect(files.sanitiseFileName('report.')).toBe('report');
    expect(files.sanitiseFileName('report ')).toBe('report');
    expect(files.sanitiseFileName('report...')).toBe('report');
  });

  it('falls back to "_" when nothing safe is left', () => {
    expect(files.sanitiseFileName('.')).toBe('_');
    expect(files.sanitiseFileName('..')).toBe('_');
  });
});

describe('isPreviewable', () => {
  it('is false for image/svg+xml even though it is an image/* type', () => {
    expect(files.isPreviewable('image/svg+xml')).toBe(false);
  });

  it('is true for application/pdf and other image types', () => {
    expect(files.isPreviewable('application/pdf')).toBe(true);
    expect(files.isPreviewable('image/png')).toBe(true);
    expect(files.isPreviewable('IMAGE/JPEG')).toBe(true);
  });

  it('is false for image types outside the allowlist', () => {
    expect(files.isPreviewable('image/SVG+xml')).toBe(false);
    expect(files.isPreviewable('image/x-icon')).toBe(false);
  });
});
