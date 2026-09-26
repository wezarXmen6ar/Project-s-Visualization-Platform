import type { DatabaseSync } from 'node:sqlite';
import { addDays, type ISODate } from '../../shared/calendar';
import { expiryState } from '../../shared/expiry';
import { translate } from '../../shared/i18n/translate';
import type { PersonDocumentUpdateData, ValidationIssue } from '../../shared/schemas';
import type { ExpiringItem, PersonDocumentRecord } from '../../shared/types';
import { isPreviewable } from '../attachments/files';

/** Documents are never shown as "expiring soon" more than 30 days ahead; a document with no expiry date is never expiring. */
const DOCUMENT_WINDOW_DAYS = 30;

interface DocumentRow {
  id: number;
  resource_id: number;
  type_id: number | null;
  original_name: string;
  stored_name: string;
  mime: string;
  size: number;
  expiry_date: string | null;
  note: string | null;
  uploaded_at: string;
  person_name: string;
  type_name: string | null;
  type_name_ar: string | null;
}

const SELECT_DOCUMENTS = `
  SELECT d.*, r.name AS person_name, lv.name AS type_name, lv.name_ar AS type_name_ar
  FROM person_documents d
  JOIN resources r ON r.id = d.resource_id
  LEFT JOIN list_values lv ON lv.id = d.type_id`;

/** Newest uploaded first, ties broken by id descending. */
const ORDER_DOCUMENTS = 'ORDER BY d.uploaded_at DESC, d.id DESC';

function toDocument(row: DocumentRow, today: ISODate): PersonDocumentRecord {
  return {
    id: row.id,
    resourceId: row.resource_id,
    personName: row.person_name,
    type: row.type_id === null ? null : { id: row.type_id, name: row.type_name!, nameAr: row.type_name_ar },
    name: row.original_name,
    mime: row.mime,
    size: row.size,
    expiryDate: row.expiry_date as ISODate | null,
    note: row.note,
    uploadedAt: row.uploaded_at,
    previewable: isPreviewable(row.mime),
    state: expiryState(row.expiry_date as ISODate | null, today, DOCUMENT_WINDOW_DAYS),
  };
}

function getRow(db: DatabaseSync, id: number): DocumentRow | undefined {
  return db.prepare(`${SELECT_DOCUMENTS} WHERE d.id = ?`).get(id) as unknown as DocumentRow | undefined;
}

export function getPersonDocument(db: DatabaseSync, id: number, today: ISODate): PersonDocumentRecord | undefined {
  const row = getRow(db, id);
  return row ? toDocument(row, today) : undefined;
}

/** The file-system details a route needs for download or delete; not part of the public PersonDocumentRecord shape. */
export interface PersonDocumentFile {
  resourceId: number;
  storedName: string;
  mime: string;
  originalName: string;
}

export function getPersonDocumentFile(db: DatabaseSync, id: number): PersonDocumentFile | undefined {
  const row = getRow(db, id);
  if (!row) return undefined;
  return { resourceId: row.resource_id, storedName: row.stored_name, mime: row.mime, originalName: row.original_name };
}

export function listPersonDocuments(db: DatabaseSync, resourceId: number, today: ISODate): PersonDocumentRecord[] {
  const rows = db.prepare(`${SELECT_DOCUMENTS} WHERE d.resource_id = ? ${ORDER_DOCUMENTS}`).all(resourceId) as unknown as DocumentRow[];
  return rows.map((row) => toDocument(row, today));
}

/** Validates the type, when set: it must be a `personDocumentType` value. Nothing is saved. */
export function checkPersonDocumentRefs(db: DatabaseSync, data: { typeId?: number | null }): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (data.typeId != null) {
    const type = db.prepare("SELECT id FROM list_values WHERE id = ? AND list = 'personDocumentType'").get(data.typeId);
    if (!type) {
      issues.push({
        path: 'typeId', message: translate('en', 'error.unknownPersonDocumentType'), code: 'error.unknownPersonDocumentType',
      });
    }
  }
  return issues;
}

export interface NewPersonDocument {
  typeId: number | null;
  originalName: string;
  storedName: string;
  mime: string;
  size: number;
  expiryDate: ISODate | null;
  note: string | null;
}

export function createPersonDocument(
  db: DatabaseSync, resourceId: number, data: NewPersonDocument, uploadedAt: string, today: ISODate,
): PersonDocumentRecord {
  const res = db
    .prepare(
      `INSERT INTO person_documents (resource_id, type_id, original_name, stored_name, mime, size, expiry_date, note, uploaded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(resourceId, data.typeId, data.originalName, data.storedName, data.mime, data.size, data.expiryDate, data.note, uploadedAt);
  return getPersonDocument(db, Number(res.lastInsertRowid), today)!;
}

/** Changes the metadata only: type, expiry date and note. Returns undefined when the document does not exist. */
export function updatePersonDocument(
  db: DatabaseSync, id: number, data: PersonDocumentUpdateData, today: ISODate,
): PersonDocumentRecord | undefined {
  if (!getPersonDocument(db, id, today)) return undefined;
  db.prepare('UPDATE person_documents SET type_id = ?, expiry_date = ?, note = ? WHERE id = ?').run(
    data.typeId, data.expiryDate, data.note, id,
  );
  return getPersonDocument(db, id, today);
}

/** Deletes the row only; the caller moves the file to `_deleted` first. */
export function deletePersonDocumentRow(db: DatabaseSync, id: number): boolean {
  return Number(db.prepare('DELETE FROM person_documents WHERE id = ?').run(id).changes) > 0;
}

/** Every document expired, or expiring within `withinDays`, across everyone; feeds GET /api/people/expiring. */
export function listExpiringDocuments(db: DatabaseSync, today: ISODate, withinDays: number): ExpiringItem[] {
  const rows = db
    .prepare(`${SELECT_DOCUMENTS} WHERE d.expiry_date IS NOT NULL AND d.expiry_date <= ? ${ORDER_DOCUMENTS}`)
    .all(addDays(today, withinDays)) as unknown as DocumentRow[];
  return rows.map((row) => ({
    kind: 'document' as const,
    id: row.id,
    person: { id: row.resource_id, name: row.person_name },
    type: row.type_id === null ? null : { id: row.type_id, name: row.type_name!, nameAr: row.type_name_ar },
    name: row.original_name,
    expiryDate: row.expiry_date as ISODate,
    state: expiryState(row.expiry_date as ISODate, today, DOCUMENT_WINDOW_DAYS)!,
  }));
}
