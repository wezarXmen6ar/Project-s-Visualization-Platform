import { describe, expect, it } from 'vitest';
import type { AttachmentRecord } from '../../../shared/types';
import { sortAttachments } from './attachmentsTable';

function attachment(overrides: Partial<AttachmentRecord> & Pick<AttachmentRecord, 'id'>): AttachmentRecord {
  return {
    projectId: 1,
    phase: null,
    entryId: null,
    type: null,
    name: `File ${overrides.id}`,
    mime: 'application/pdf',
    size: 0,
    documentDate: null,
    uploadedAt: '2026-09-20T09:00:00.000Z',
    previewable: false,
    ...overrides,
  };
}

describe('sortAttachments', () => {
  it('sorts by size ascending and descending', () => {
    const list = [attachment({ id: 1, size: 300 }), attachment({ id: 2, size: 100 }), attachment({ id: 3, size: 200 })];
    expect(sortAttachments(list, 'size', 'asc').map((a) => a.id)).toEqual([2, 3, 1]);
    expect(sortAttachments(list, 'size', 'desc').map((a) => a.id)).toEqual([1, 3, 2]);
  });

  it('sorts by phase name, translated through nameFor', () => {
    const list = [
      attachment({ id: 1, phase: { id: 10, name: 'Development', phaseName: 'Development', subPhaseName: null } }),
      attachment({ id: 2, phase: { id: 11, name: 'Requirements', phaseName: 'Requirements', subPhaseName: null } }),
    ];
    // Untranslated, "Development" sorts before "Requirements"; a nameFor that swaps their order flips the sort.
    const swapped = (n: string) => (n === 'Development' ? 'Zulu' : n === 'Requirements' ? 'Alpha' : n);
    expect(sortAttachments(list, 'phase', 'asc').map((a) => a.id)).toEqual([1, 2]);
    expect(sortAttachments(list, 'phase', 'asc', 'en', swapped).map((a) => a.id)).toEqual([2, 1]);
  });

  it('sorts a null value (no type, no phase, no document date, no meeting) last in both directions', () => {
    const list = [
      attachment({ id: 1, documentDate: '2026-09-01' }),
      attachment({ id: 2, documentDate: null }),
      attachment({ id: 3, documentDate: '2026-08-01' }),
    ];
    expect(sortAttachments(list, 'documentDate', 'asc').map((a) => a.id)).toEqual([3, 1, 2]);
    expect(sortAttachments(list, 'documentDate', 'desc').map((a) => a.id)).toEqual([1, 3, 2]);
  });

  it('sorts attachments with no type last, in both directions', () => {
    const list = [
      attachment({ id: 1, type: { id: 100, name: 'Approval', nameAr: 'اعتماد' } }),
      attachment({ id: 2, type: null }),
      attachment({ id: 3, type: { id: 101, name: 'Contract', nameAr: 'العقد' } }),
    ];
    expect(sortAttachments(list, 'type', 'asc').map((a) => a.id)).toEqual([1, 3, 2]);
    expect(sortAttachments(list, 'type', 'desc').map((a) => a.id)).toEqual([3, 1, 2]);
  });

  it('breaks a tie by the newest upload first', () => {
    const list = [
      attachment({ id: 1, size: 100, uploadedAt: '2026-09-01T09:00:00.000Z' }),
      attachment({ id: 2, size: 100, uploadedAt: '2026-09-05T09:00:00.000Z' }),
    ];
    expect(sortAttachments(list, 'size', 'asc').map((a) => a.id)).toEqual([2, 1]);
  });

  it('defaults to newest upload first, unsorted', () => {
    const list = [
      attachment({ id: 1, uploadedAt: '2026-09-01T09:00:00.000Z' }),
      attachment({ id: 2, uploadedAt: '2026-09-10T09:00:00.000Z' }),
    ];
    expect(sortAttachments(list, 'uploaded', 'desc').map((a) => a.id)).toEqual([2, 1]);
  });
});
