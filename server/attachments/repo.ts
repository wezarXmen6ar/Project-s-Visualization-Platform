import type { DatabaseSync } from 'node:sqlite';
import type { ISODate } from '../../shared/calendar';
import { translate } from '../../shared/i18n/translate';
import type { AttachmentUpdateData, ValidationIssue } from '../../shared/schemas';
import type { AttachmentRecord } from '../../shared/types';
import { isPreviewable } from './files';
import { PHASE_JOIN_SQL, PHASE_NAME_COLUMNS_SQL, phaseRefFromRow } from '../phaseRef';

interface AttachmentRow {
  id: number;
  project_id: number;
  phase_id: number | null;
  entry_id: number | null;
  type_id: number | null;
  original_name: string;
  stored_name: string;
  mime: string;
  size: number;
  document_date: string | null;
  uploaded_at: string;
  phase_name: string | null;
  phase_top_name: string | null;
  phase_sub_name: string | null;
  type_name: string | null;
  type_name_ar: string | null;
}

const SELECT_ATTACHMENTS = `
  SELECT a.*,${PHASE_NAME_COLUMNS_SQL}, lv.name AS type_name, lv.name_ar AS type_name_ar
  FROM attachments a
  LEFT JOIN phases p ON p.id = a.phase_id
  ${PHASE_JOIN_SQL}
  LEFT JOIN list_values lv ON lv.id = a.type_id`;

/** Newest uploaded first, ties broken by id descending. */
const ORDER_ATTACHMENTS = 'ORDER BY a.uploaded_at DESC, a.id DESC';

function toAttachment(row: AttachmentRow): AttachmentRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    phase: phaseRefFromRow(row),
    entryId: row.entry_id,
    type: row.type_id === null ? null : { id: row.type_id, name: row.type_name!, nameAr: row.type_name_ar },
    name: row.original_name,
    mime: row.mime,
    size: row.size,
    documentDate: row.document_date as ISODate | null,
    uploadedAt: row.uploaded_at,
    previewable: isPreviewable(row.mime),
  };
}

function getRow(db: DatabaseSync, id: number): AttachmentRow | undefined {
  return db.prepare(`${SELECT_ATTACHMENTS} WHERE a.id = ?`).get(id) as unknown as AttachmentRow | undefined;
}

export function getAttachment(db: DatabaseSync, id: number): AttachmentRecord | undefined {
  const row = getRow(db, id);
  return row ? toAttachment(row) : undefined;
}

/** The file-system details a route needs for download or delete; not part of the public AttachmentRecord shape. */
export interface AttachmentFile {
  projectId: number;
  storedName: string;
  mime: string;
  originalName: string;
}

export function getAttachmentFile(db: DatabaseSync, id: number): AttachmentFile | undefined {
  const row = getRow(db, id);
  if (!row) return undefined;
  return { projectId: row.project_id, storedName: row.stored_name, mime: row.mime, originalName: row.original_name };
}

export interface AttachmentFilter {
  /** When set, attachments of this phase and, when it is a top-level phase, its sub-phases too. */
  phaseId?: number;
  typeId?: number;
}

/** Returns [] for an unknown phase filter (the route 404s on a missing project before calling this). */
export function listAttachments(db: DatabaseSync, projectId: number, filter: AttachmentFilter = {}): AttachmentRecord[] {
  let phaseIds: number[] | undefined;
  if (filter.phaseId !== undefined) {
    const phase = db.prepare('SELECT id, parent_id FROM phases WHERE id = ? AND project_id = ?').get(filter.phaseId, projectId) as unknown as
      | { id: number; parent_id: number | null }
      | undefined;
    if (!phase) return [];
    if (phase.parent_id === null) {
      const subs = db.prepare('SELECT id FROM phases WHERE parent_id = ?').all(phase.id) as unknown as { id: number }[];
      phaseIds = [phase.id, ...subs.map((s) => s.id)];
    } else {
      phaseIds = [phase.id];
    }
  }
  const conditions = ['a.project_id = ?'];
  const params: number[] = [projectId];
  if (phaseIds) {
    conditions.push(`a.phase_id IN (${phaseIds.map(() => '?').join(', ')})`);
    params.push(...phaseIds);
  }
  if (filter.typeId !== undefined) {
    conditions.push('a.type_id = ?');
    params.push(filter.typeId);
  }
  const rows = db
    .prepare(`${SELECT_ATTACHMENTS} WHERE ${conditions.join(' AND ')} ${ORDER_ATTACHMENTS}`)
    .all(...params) as unknown as AttachmentRow[];
  return rows.map(toAttachment);
}

/**
 * Validates the given references, when set: the phase belongs to the project, the type is an `attachmentType`
 * value, and the entry belongs to the project. Nothing is saved.
 */
export function checkAttachmentRefs(
  db: DatabaseSync, projectId: number, data: { typeId?: number | null; phaseId?: number | null; entryId?: number | null },
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (data.phaseId != null) {
    const phase = db.prepare('SELECT id FROM phases WHERE id = ? AND project_id = ?').get(data.phaseId, projectId);
    if (!phase) issues.push({ path: 'phaseId', message: translate('en', 'error.unknownPhase'), code: 'error.unknownPhase' });
  }
  if (data.typeId != null) {
    const type = db.prepare("SELECT id FROM list_values WHERE id = ? AND list = 'attachmentType'").get(data.typeId);
    if (!type) {
      issues.push({ path: 'typeId', message: translate('en', 'error.unknownAttachmentType'), code: 'error.unknownAttachmentType' });
    }
  }
  if (data.entryId != null) {
    const entry = db.prepare('SELECT id FROM entries WHERE id = ? AND project_id = ?').get(data.entryId, projectId);
    if (!entry) issues.push({ path: 'entryId', message: translate('en', 'error.unknownEntry'), code: 'error.unknownEntry' });
  }
  return issues;
}

export interface NewAttachment {
  phaseId: number | null;
  entryId: number | null;
  typeId: number | null;
  originalName: string;
  storedName: string;
  mime: string;
  size: number;
  documentDate: ISODate | null;
}

export function createAttachment(db: DatabaseSync, projectId: number, data: NewAttachment, uploadedAt: string): AttachmentRecord {
  const res = db
    .prepare(
      `INSERT INTO attachments (project_id, phase_id, entry_id, type_id, original_name, stored_name, mime, size, document_date, uploaded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      projectId, data.phaseId, data.entryId, data.typeId, data.originalName, data.storedName, data.mime, data.size, data.documentDate,
      uploadedAt,
    );
  return getAttachment(db, Number(res.lastInsertRowid))!;
}

/** Changes the metadata only: type, phase, document date and the entry it is linked to. */
export function updateAttachment(db: DatabaseSync, id: number, data: AttachmentUpdateData): AttachmentRecord | undefined {
  if (!getAttachment(db, id)) return undefined;
  db.prepare('UPDATE attachments SET type_id = ?, phase_id = ?, document_date = ?, entry_id = ? WHERE id = ?').run(
    data.typeId, data.phaseId, data.documentDate, data.entryId, id,
  );
  return getAttachment(db, id);
}

/**
 * Deletes the row only; the caller moves the file to `_deleted` first. Any key date linked to this attachment
 * (M7 Task 9) is kept on the project, unlinked: `attachment_id` is set to null by the column's own
 * `ON DELETE SET NULL` foreign key, so no extra query is needed here.
 */
export function deleteAttachmentRow(db: DatabaseSync, id: number): boolean {
  return Number(db.prepare('DELETE FROM attachments WHERE id = ?').run(id).changes) > 0;
}
