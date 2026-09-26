import type { Lang } from '../../../shared/i18n/types';
import type { AttachmentRecord, EntryRecord } from '../../../shared/types';
import { phaseRefLabel, type PhaseNameFor } from '../../todos';
import { compare, type SortDir } from './peopleTable';

export type { SortDir };

export type AttachmentSortKey = 'name' | 'type' | 'phase' | 'documentDate' | 'uploaded' | 'size' | 'from';

/** Looks up the entry (meeting/update) an attachment belongs to, for the "From" column's sort key. */
export type EntryFor = (entryId: number) => EntryRecord | undefined;

function typeKey(a: AttachmentRecord, lang: Lang): string | null {
  return a.type ? (lang === 'ar' ? a.type.nameAr ?? a.type.name : a.type.name) : null;
}

function phaseKey(a: AttachmentRecord, nameFor?: PhaseNameFor): string | null {
  return a.phase ? phaseRefLabel(a.phase, nameFor) : null;
}

function fromKey(a: AttachmentRecord, entryFor?: EntryFor): string | null {
  if (a.entryId === null) return null;
  const entry = entryFor?.(a.entryId);
  return entry ? entry.effectiveDate : null;
}

function attachmentKey(
  a: AttachmentRecord, key: AttachmentSortKey, lang: Lang, nameFor?: PhaseNameFor, entryFor?: EntryFor,
): string | number | null {
  switch (key) {
    case 'name':
      return a.name;
    case 'type':
      return typeKey(a, lang);
    case 'phase':
      return phaseKey(a, nameFor);
    case 'documentDate':
      return a.documentDate;
    case 'uploaded':
      return a.uploadedAt;
    case 'size':
      return a.size;
    case 'from':
      return fromKey(a, entryFor);
  }
}

/**
 * Sorts attachments by one column, as it reads in `lang`; a null value (no type, no phase, no document date, no
 * meeting) always sorts last, in both directions. Ties break by the newest upload first, then by id.
 */
export function sortAttachments(
  attachments: AttachmentRecord[], key: AttachmentSortKey, dir: SortDir, lang: Lang = 'en',
  nameFor?: PhaseNameFor, entryFor?: EntryFor,
): AttachmentRecord[] {
  return [...attachments].sort((a, b) => {
    const primary = compare(attachmentKey(a, key, lang, nameFor, entryFor), attachmentKey(b, key, lang, nameFor, entryFor), dir);
    if (primary !== 0) return primary;
    if (a.uploadedAt !== b.uploadedAt) return a.uploadedAt < b.uploadedAt ? 1 : -1;
    return a.id - b.id;
  });
}
