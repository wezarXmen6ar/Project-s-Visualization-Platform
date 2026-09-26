import { useCallback, useRef, useState, type DragEvent } from 'react';
import type { AttachmentRecord, EntryRecord, ListValue, ProjectRecord } from '../../../shared/types';
import { api } from '../../api';
import { AttachmentList } from '../../components/AttachmentList';
import { draftFrom, KeyDateRows, newKeyDateDraft, toKeyDateInput, type KeyDateDraft } from '../../components/KeyDateRows';
import { Uploader } from '../../components/Uploader';
import { messagesOf } from '../../errors';
import { AlertIcon, PlusIcon } from '../../icons';
import { useLang, useT } from '../../i18n/LanguageProvider';
import { listName } from '../../i18n/listNames';
import { useAsync } from '../../useAsync';
import { phaseChoices, type PhaseNameFor } from '../../todos';
import type { AttachmentSortKey, SortDir } from './attachmentsTable';

interface AttachmentsTabProps {
  project: ProjectRecord;
  attachmentTypes: ListValue[];
  /** For the upload/edit rows' Key dates section. Defaults to none, so existing callers/tests need not pass it. */
  keyDateTypes?: ListValue[];
  nameFor?: PhaseNameFor;
  /** Opens the History tab, for the "From" column's link. Passed the entry id so History can land on it and highlight it. */
  onOpenHistory: (entryId?: number) => void;
  /** Bumped by the page when something changed elsewhere (e.g. the phase side panel), so the list loads again. */
  refreshKey?: number;
}

/** The Attachments tab: upload, filter, preview, download, edit and delete a project's files. */
export function AttachmentsTab({
  project, attachmentTypes, keyDateTypes = [], nameFor, onOpenHistory, refreshKey = 0,
}: AttachmentsTabProps) {
  const t = useT();
  const { lang } = useLang();
  // Matched by the type's editable English name, the seeded value from the constraints table (see EntryForm's same
  // "Meeting Minutes" match). If the user renames it in Settings, this simply finds nothing and the Key dates
  // section stays collapsed by default for every type — uploads still work either way.
  const contractTypeId = attachmentTypes.find((v) => v.name === 'Contract')?.id ?? null;
  const [typeFilter, setTypeFilter] = useState<number | null>(null);
  const [phaseFilter, setPhaseFilter] = useState<number | null>(null);
  const [sort, setSort] = useState<{ key: AttachmentSortKey; dir: SortDir }>({ key: 'uploaded', dir: 'desc' });
  const toggleSort = (key: AttachmentSortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const loaded = useAsync(
    () => api.listAttachments(project.id, { typeId: typeFilter ?? undefined, phaseId: phaseFilter ?? undefined }),
    [project.id, typeFilter, phaseFilter, version, refreshKey],
  );
  const attachments = loaded.data ?? [];
  const phases = phaseChoices(project, nameFor);

  // Loaded so the "From" column can show the meeting/update's own title and date, not just a generic link.
  const entriesLoaded = useAsync(() => api.listEntries(project.id), [project.id, version, refreshKey]);
  const entryById = new Map<number, EntryRecord>((entriesLoaded.data ?? []).map((e) => [e.id, e]));
  const entryFor = (entryId: number) => entryById.get(entryId);

  const [uploading, setUploading] = useState(false);
  const [uploadTypeId, setUploadTypeId] = useState<number | null>(null);
  const [uploadPhaseId, setUploadPhaseId] = useState<number | null>(null);
  const [uploadDocumentDate, setUploadDocumentDate] = useState('');
  const [droppedFiles, setDroppedFiles] = useState<File[] | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // The upload row's Key dates section (M7 Task 9): open by default for a Contract, collapsed for anything else.
  // The rows are saved, atomically and linked to the file, only once the file itself has uploaded successfully.
  // A failed save keeps the rows and the uploaded file's id, so Retry can send them again without re-uploading
  // (M7 review fix — losing typed rows to a failed save, silently, was the bug).
  const [uploadKeyDatesOpen, setUploadKeyDatesOpen] = useState(false);
  const [uploadKeyDateRows, setUploadKeyDateRows] = useState<KeyDateDraft[]>([]);
  // Mirrors `uploadKeyDateRows`, so `saveUploadKeyDates` always reads the latest typed rows even when it's called
  // from a closure created earlier — e.g. `onUploaded`, captured by the Uploader at the render where the upload
  // started — instead of the (possibly stale) rows that existed at that time (M7 review fix).
  const uploadKeyDateRowsRef = useRef(uploadKeyDateRows);
  uploadKeyDateRowsRef.current = uploadKeyDateRows;
  const [keyDatesRetryAttachmentId, setKeyDatesRetryAttachmentId] = useState<number | null>(null);
  const [savingKeyDates, setSavingKeyDates] = useState(false);

  const [editing, setEditing] = useState<AttachmentRecord | null>(null);
  const [editTypeId, setEditTypeId] = useState<number | null>(null);
  const [editPhaseId, setEditPhaseId] = useState<number | null>(null);
  const [editDocumentDate, setEditDocumentDate] = useState('');
  const [editKeyDateRows, setEditKeyDateRows] = useState<KeyDateDraft[]>([]);

  const [actionErrors, setActionErrors] = useState<string[]>([]);

  // Every key date in the project, so an attachment being edited can show and edit its own (filtered by attachmentId).
  const keyDatesLoaded = useAsync(() => api.listKeyDates(project.id), [project.id, version, refreshKey]);
  const allKeyDates = keyDatesLoaded.data ?? [];

  function onUploadTypeChange(v: number | null) {
    setUploadTypeId(v);
    if (v !== null && v === contractTypeId) {
      setUploadKeyDatesOpen(true);
      setUploadKeyDateRows((rows) => (rows.length === 0 ? [newKeyDateDraft()] : rows));
    }
  }

  // Saves the upload row's key dates, atomically and linked to the just-uploaded (or already-uploaded, on Retry)
  // file, via the one PUT that replaces its whole set (M7 review fix). Only on success are the rows cleared and
  // the section closed; on failure they, and the attachment id, are kept so Retry can send them again — the file
  // itself is already uploaded and is never re-sent.
  async function saveUploadKeyDates(attachmentId: number) {
    const rows = uploadKeyDateRowsRef.current.filter((r) => r.date !== '');
    if (rows.length === 0) {
      setUploadKeyDateRows([]);
      setUploadKeyDatesOpen(false);
      setKeyDatesRetryAttachmentId(null);
      return;
    }
    setSavingKeyDates(true);
    setActionErrors([]);
    try {
      await api.replaceAttachmentKeyDates(attachmentId, rows.map(toKeyDateInput));
      setUploadKeyDateRows([]);
      setUploadKeyDatesOpen(false);
      setKeyDatesRetryAttachmentId(null);
      reload();
    } catch (err) {
      setActionErrors(messagesOf(err, t));
      setKeyDatesRetryAttachmentId(attachmentId);
    } finally {
      setSavingKeyDates(false);
    }
  }

  // Called once per file that finishes uploading; the uploader accepts a single file while the Key dates section
  // has rows (M7 review fix), so this fires at most once for them.
  function onUploaded(attachment: AttachmentRecord) {
    reload();
    void saveUploadKeyDates(attachment.id);
  }

  function startEditing(a: AttachmentRecord) {
    setEditing(a);
    setEditTypeId(a.type?.id ?? null);
    setEditPhaseId(a.phase?.id ?? null);
    setEditDocumentDate(a.documentDate ?? '');
    setEditKeyDateRows(allKeyDates.filter((k) => k.attachment?.id === a.id).map(draftFrom));
  }

  async function saveEdit() {
    if (!editing) return;
    setActionErrors([]);
    try {
      await api.updateAttachment(editing.id, {
        typeId: editTypeId ?? undefined,
        phaseId: editPhaseId ?? undefined,
        documentDate: editDocumentDate === '' ? null : editDocumentDate,
      });
      // One atomic replace of the file's whole set of key dates (M7 review fix), instead of several independent
      // add/update/delete calls that could each succeed or fail on their own.
      await api.replaceAttachmentKeyDates(editing.id, editKeyDateRows.filter((r) => r.date !== '').map(toKeyDateInput));
      setEditing(null);
      reload();
    } catch (err) {
      setActionErrors(messagesOf(err, t));
    }
  }

  async function deleteAttachment(a: AttachmentRecord) {
    setActionErrors([]);
    try {
      await api.deleteAttachment(a.id);
      reload();
    } catch (err) {
      setActionErrors(messagesOf(err, t));
    }
  }

  // Dragging files onto the tab opens the upload row (if it isn't already) and starts uploading them with its
  // current Type/Phase/Document date defaults, the same as choosing them through the Uploader's own button.
  function onDragOver(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    setDragActive(true);
  }
  function onDragLeave() {
    setDragActive(false);
  }
  function onDrop(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    setUploading(true);
    setDroppedFiles(files);
  }

  return (
    <section className="card" onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      <div className="phase-people-head">
        <h2>{t('tabs.attachments')}</h2>
        {!uploading ? (
          <button
            type="button" className="button secondary"
            onClick={() => {
              setUploading(true);
              setUploadKeyDatesOpen(false);
              setUploadKeyDateRows([]);
              setKeyDatesRetryAttachmentId(null);
            }}
          >
            <PlusIcon />{t('attachments.uploadFile')}
          </button>
        ) : null}
      </div>

      {dragActive ? <p className="attachments-drop-hint" role="status">{t('attachments.dropHint')}</p> : null}

      <div className="attachments-filters">
        <label className="entry-phase-filter">
          {t('attachments.typeFilterLabel')}
          <select value={typeFilter === null ? '' : String(typeFilter)} onChange={(e) => setTypeFilter(e.target.value === '' ? null : Number(e.target.value))}>
            <option value="">{t('attachments.allTypes')}</option>
            {attachmentTypes.map((v) => <option key={v.id} value={String(v.id)}>{listName(v, lang)}</option>)}
          </select>
        </label>
        <label className="entry-phase-filter">
          {t('attachments.phaseFilterLabel')}
          <select value={phaseFilter === null ? '' : String(phaseFilter)} onChange={(e) => setPhaseFilter(e.target.value === '' ? null : Number(e.target.value))}>
            <option value="">{t('attachments.allPhases')}</option>
            {phases.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
          </select>
        </label>
      </div>

      {actionErrors.length > 0 ? (
        <div className="errors" role="alert">
          <AlertIcon />
          <ul>{actionErrors.map((m) => <li key={m}>{m}</li>)}</ul>
          {keyDatesRetryAttachmentId !== null ? (
            <button
              type="button" className="button secondary" disabled={savingKeyDates}
              onClick={() => void saveUploadKeyDates(keyDatesRetryAttachmentId)}
            >
              {t('common.retry')}
            </button>
          ) : null}
        </div>
      ) : null}

      {uploading ? (
        <div className="upload-row">
          <label>
            {t('attachments.typeField')}
            <select value={uploadTypeId === null ? '' : String(uploadTypeId)} onChange={(e) => onUploadTypeChange(e.target.value === '' ? null : Number(e.target.value))}>
              <option value="">{t('attachments.noType')}</option>
              {attachmentTypes.map((v) => <option key={v.id} value={String(v.id)}>{listName(v, lang)}</option>)}
            </select>
          </label>
          <label>
            {t('attachments.phaseField')}
            <select value={uploadPhaseId === null ? '' : String(uploadPhaseId)} onChange={(e) => setUploadPhaseId(e.target.value === '' ? null : Number(e.target.value))}>
              <option value="">{t('attachments.wholeProject')}</option>
              {phases.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
            </select>
          </label>
          <label>
            {t('attachments.documentDateField')}
            <input type="date" value={uploadDocumentDate} onChange={(e) => setUploadDocumentDate(e.target.value)} />
          </label>
          <div className="key-date-section">
            <button
              type="button" className="button-link" aria-expanded={uploadKeyDatesOpen}
              onClick={() => setUploadKeyDatesOpen((v) => !v)}
            >
              {t('keyDates.sectionTitle')}
            </button>
            {uploadKeyDatesOpen ? (
              <>
                <p className="muted">{t('keyDates.sectionHint')}</p>
                <KeyDateRows types={keyDateTypes} rows={uploadKeyDateRows} onChange={setUploadKeyDateRows} />
              </>
            ) : null}
          </div>

          <Uploader
            projectId={project.id}
            typeId={uploadTypeId}
            phaseId={uploadPhaseId}
            documentDate={uploadDocumentDate === '' ? null : uploadDocumentDate}
            buttonLabel={t('attachments.uploadFile')}
            onUploaded={onUploaded}
            initialFiles={droppedFiles}
            onInitialFilesConsumed={() => setDroppedFiles(null)}
            singleFile={uploadKeyDateRows.length > 0}
            singleFileHint={t('attachments.keyDatesSingleFileHint')}
          />
          <button type="button" className="button secondary" onClick={() => setUploading(false)}>{t('attachments.cancelUpload')}</button>
        </div>
      ) : null}

      {editing ? (
        <div className="upload-row">
          <label>
            {t('attachments.typeField')}
            <select value={editTypeId === null ? '' : String(editTypeId)} onChange={(e) => setEditTypeId(e.target.value === '' ? null : Number(e.target.value))}>
              <option value="">{t('attachments.noType')}</option>
              {attachmentTypes.map((v) => <option key={v.id} value={String(v.id)}>{listName(v, lang)}</option>)}
            </select>
          </label>
          <label>
            {t('attachments.phaseField')}
            <select value={editPhaseId === null ? '' : String(editPhaseId)} onChange={(e) => setEditPhaseId(e.target.value === '' ? null : Number(e.target.value))}>
              <option value="">{t('attachments.wholeProject')}</option>
              {phases.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
            </select>
          </label>
          <label>
            {t('attachments.documentDateField')}
            <input type="date" value={editDocumentDate} onChange={(e) => setEditDocumentDate(e.target.value)} />
          </label>
          <div className="key-date-section">
            <span className="key-date-section-title">{t('keyDates.sectionTitle')}</span>
            <KeyDateRows types={keyDateTypes} rows={editKeyDateRows} onChange={setEditKeyDateRows} />
          </div>
          <div className="option-add-actions">
            <button type="button" className="button" onClick={() => void saveEdit()}>{t('common.save')}</button>
            <button type="button" className="button secondary" onClick={() => setEditing(null)}>{t('common.cancel')}</button>
          </div>
        </div>
      ) : null}

      <AttachmentList
        attachments={attachments}
        nameFor={nameFor}
        onOpenEntry={onOpenHistory}
        entryFor={entryFor}
        actions={{ onEdit: startEditing, onDelete: (a) => void deleteAttachment(a) }}
        ariaLabel={t('tabs.attachments')}
        sortable={{ sort, onSort: toggleSort }}
      />
    </section>
  );
}
