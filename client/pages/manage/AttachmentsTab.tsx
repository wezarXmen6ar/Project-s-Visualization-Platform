import { useCallback, useState, type DragEvent } from 'react';
import type { AttachmentRecord, EntryRecord, ListValue, ProjectRecord } from '../../../shared/types';
import { api } from '../../api';
import { AttachmentList } from '../../components/AttachmentList';
import { Uploader } from '../../components/Uploader';
import { messagesOf } from '../../errors';
import { AlertIcon, PlusIcon } from '../../icons';
import { useLang, useT } from '../../i18n/LanguageProvider';
import { listName } from '../../i18n/listNames';
import { useAsync } from '../../useAsync';
import { phaseChoices, type PhaseNameFor } from '../../todos';

interface AttachmentsTabProps {
  project: ProjectRecord;
  attachmentTypes: ListValue[];
  nameFor?: PhaseNameFor;
  /** Opens the History tab, for the "From" column's link. Passed the entry id so History can land on it and highlight it. */
  onOpenHistory: (entryId?: number) => void;
}

/** The Attachments tab: upload, filter, preview, download, edit and delete a project's files. */
export function AttachmentsTab({ project, attachmentTypes, nameFor, onOpenHistory }: AttachmentsTabProps) {
  const t = useT();
  const { lang } = useLang();
  const [typeFilter, setTypeFilter] = useState<number | null>(null);
  const [phaseFilter, setPhaseFilter] = useState<number | null>(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const loaded = useAsync(
    () => api.listAttachments(project.id, { typeId: typeFilter ?? undefined, phaseId: phaseFilter ?? undefined }),
    [project.id, typeFilter, phaseFilter, version],
  );
  const attachments = loaded.data ?? [];
  const phases = phaseChoices(project, nameFor);

  // Loaded so the "From" column can show the meeting/update's own title and date, not just a generic link.
  const entriesLoaded = useAsync(() => api.listEntries(project.id), [project.id, version]);
  const entryById = new Map<number, EntryRecord>((entriesLoaded.data ?? []).map((e) => [e.id, e]));
  const entryFor = (entryId: number) => entryById.get(entryId);

  const [uploading, setUploading] = useState(false);
  const [uploadTypeId, setUploadTypeId] = useState<number | null>(null);
  const [uploadPhaseId, setUploadPhaseId] = useState<number | null>(null);
  const [uploadDocumentDate, setUploadDocumentDate] = useState('');
  const [droppedFiles, setDroppedFiles] = useState<File[] | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const [editing, setEditing] = useState<AttachmentRecord | null>(null);
  const [editTypeId, setEditTypeId] = useState<number | null>(null);
  const [editPhaseId, setEditPhaseId] = useState<number | null>(null);
  const [editDocumentDate, setEditDocumentDate] = useState('');

  const [actionErrors, setActionErrors] = useState<string[]>([]);

  function startEditing(a: AttachmentRecord) {
    setEditing(a);
    setEditTypeId(a.type?.id ?? null);
    setEditPhaseId(a.phase?.id ?? null);
    setEditDocumentDate(a.documentDate ?? '');
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
          <button type="button" className="button secondary" onClick={() => setUploading(true)}>
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
        </div>
      ) : null}

      {uploading ? (
        <div className="upload-row">
          <label>
            {t('attachments.typeField')}
            <select value={uploadTypeId === null ? '' : String(uploadTypeId)} onChange={(e) => setUploadTypeId(e.target.value === '' ? null : Number(e.target.value))}>
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
          <Uploader
            projectId={project.id}
            typeId={uploadTypeId}
            phaseId={uploadPhaseId}
            documentDate={uploadDocumentDate === '' ? null : uploadDocumentDate}
            buttonLabel={t('attachments.uploadFile')}
            onUploaded={reload}
            initialFiles={droppedFiles}
            onInitialFilesConsumed={() => setDroppedFiles(null)}
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
      />
    </section>
  );
}
