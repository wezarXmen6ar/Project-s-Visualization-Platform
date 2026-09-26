import { useRef, useState } from 'react';
import { toLocalDate, type ISODate } from '../../../shared/calendar';
import { daysUntilExpiry } from '../../../shared/expiry';
import type { ListValue, PersonDocumentRecord } from '../../../shared/types';
import { api } from '../../api';
import { FileActions } from '../../components/FileActions';
import { messagesOf } from '../../errors';
import { AlertIcon, PlusIcon, TrashIcon, UploadIcon } from '../../icons';
import { useFormat } from '../../i18n/format';
import { useLang, useT } from '../../i18n/LanguageProvider';
import { listName } from '../../i18n/listNames';
import { useAsync } from '../../useAsync';

export interface PersonDocumentsProps {
  resourceId: number;
  documentTypes: ListValue[];
  today: string;
  /** Bumped by the page when something else changed (e.g. the dashboard notice was acted on), to reload the list. */
  refreshKey?: number;
}

/** Days-left text for a "soon" document: "Expires today", or "Expires in 12 days" / "تنتهي خلال 12 يوماً" (Arabic plural). */
function expiresInDays(t: ReturnType<typeof useT>, expiryDate: ISODate, today: ISODate): string {
  const days = daysUntilExpiry(expiryDate, today);
  return days === 0 ? t('common.expiresToday') : t('personDocs.expiresIn', { count: days });
}

/** The person page's "Documents" card (الوثائق): upload, list, edit and delete a person's own documents. Never on /present. */
export function PersonDocuments({ resourceId, documentTypes, today, refreshKey = 0 }: PersonDocumentsProps) {
  const t = useT();
  const { lang } = useLang();
  const { formatDate } = useFormat();
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);
  const loaded = useAsync(() => api.listPersonDocuments(resourceId), [resourceId, version, refreshKey]);
  const documents = loaded.data ?? [];

  const [uploading, setUploading] = useState(false);
  const [uploadTypeId, setUploadTypeId] = useState<number | null>(null);
  const [uploadExpiry, setUploadExpiry] = useState('');
  const [uploadNote, setUploadNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // The upload's own progress (0–100) while `busy`, and the last file picked, so a failed upload's error (in the
  // shared `errors` banner) can be retried with the same file — mirrors `Uploader`'s own progress-and-Retry pattern.
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const lastFileRef = useRef<File | null>(null);

  const [editing, setEditing] = useState<PersonDocumentRecord | null>(null);
  const [editTypeId, setEditTypeId] = useState<number | null>(null);
  const [editExpiry, setEditExpiry] = useState('');
  const [editNote, setEditNote] = useState('');
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  function startEditing(d: PersonDocumentRecord) {
    setEditing(d);
    setEditTypeId(d.type?.id ?? null);
    setEditExpiry(d.expiryDate ?? '');
    setEditNote(d.note ?? '');
  }

  async function saveEdit() {
    if (!editing) return;
    setErrors([]);
    try {
      await api.updatePersonDocument(editing.id, {
        typeId: editTypeId ?? undefined, expiryDate: editExpiry === '' ? null : editExpiry, note: editNote,
      });
      setEditing(null);
      reload();
    } catch (err) {
      setErrors(messagesOf(err, t));
    }
  }

  async function remove(id: number) {
    setErrors([]);
    try {
      await api.deletePersonDocument(id);
      setConfirmingId(null);
      reload();
    } catch (err) {
      setErrors(messagesOf(err, t));
    }
  }

  async function doUpload(file: File) {
    lastFileRef.current = file;
    setBusy(true);
    setErrors([]);
    try {
      await api.uploadPersonDocument(
        resourceId, file, file.name,
        { typeId: uploadTypeId ?? undefined, expiryDate: uploadExpiry === '' ? undefined : uploadExpiry, note: uploadNote === '' ? undefined : uploadNote },
        (loaded, total) => setUploadProgress(total > 0 ? Math.round((loaded / total) * 100) : 0),
      );
      setUploading(false);
      setUploadTypeId(null);
      setUploadExpiry('');
      setUploadNote('');
      lastFileRef.current = null;
      reload();
    } catch (err) {
      setErrors(messagesOf(err, t));
    } finally {
      setBusy(false);
      setUploadProgress(null);
    }
  }

  function onFileChosen(file: File | undefined) {
    if (!file) return;
    void doUpload(file);
  }

  return (
    <section className="card">
      <div className="phase-people-head">
        <h2>{t('personDocs.title')}</h2>
        {!uploading ? (
          <button type="button" className="button secondary" onClick={() => setUploading(true)}>
            <PlusIcon />{t('personDocs.uploadDocument')}
          </button>
        ) : null}
      </div>

      {errors.length > 0 ? (
        <div className="errors" role="alert">
          <AlertIcon />
          <ul>{errors.map((m) => <li key={m}>{m}</li>)}</ul>
          {lastFileRef.current ? (
            <button type="button" className="button secondary" onClick={() => void doUpload(lastFileRef.current!)}>{t('common.retry')}</button>
          ) : null}
        </div>
      ) : null}

      {uploading ? (
        <div className="upload-row">
          <label>
            {t('personDocs.colType')}
            <select value={uploadTypeId === null ? '' : String(uploadTypeId)} onChange={(e) => setUploadTypeId(e.target.value === '' ? null : Number(e.target.value))}>
              <option value="">{t('personDocs.noType')}</option>
              {documentTypes.map((v) => <option key={v.id} value={String(v.id)}>{listName(v, lang)}</option>)}
            </select>
          </label>
          <label>
            {t('personDocs.expiryField')}
            <input type="date" value={uploadExpiry} onChange={(e) => setUploadExpiry(e.target.value)} />
          </label>
          <label>
            {t('personDocs.noteField')}
            <input dir="auto" value={uploadNote} onChange={(e) => setUploadNote(e.target.value)} />
          </label>
          <input
            ref={fileInputRef}
            type="file"
            className="visually-hidden"
            aria-label={t('personDocs.uploadDocument')}
            disabled={busy}
            onChange={(e) => {
              onFileChosen(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <button type="button" className="button secondary" disabled={busy} onClick={() => fileInputRef.current?.click()}>
            <UploadIcon />{busy ? t('common.adding') : t('personDocs.uploadDocument')}
          </button>
          <button type="button" className="button secondary" onClick={() => setUploading(false)}>{t('common.cancel')}</button>
          {busy && uploadProgress !== null ? (
            <progress className="uploader-progress" value={uploadProgress} max={100} aria-label={t('uploader.uploading')} />
          ) : null}
        </div>
      ) : null}

      {editing ? (
        <div className="upload-row">
          <label>
            {t('personDocs.colType')}
            <select value={editTypeId === null ? '' : String(editTypeId)} onChange={(e) => setEditTypeId(e.target.value === '' ? null : Number(e.target.value))}>
              <option value="">{t('personDocs.noType')}</option>
              {documentTypes.map((v) => <option key={v.id} value={String(v.id)}>{listName(v, lang)}</option>)}
            </select>
          </label>
          <label>
            {t('personDocs.expiryField')}
            <input type="date" value={editExpiry} onChange={(e) => setEditExpiry(e.target.value)} />
          </label>
          <label>
            {t('personDocs.noteField')}
            <input dir="auto" value={editNote} onChange={(e) => setEditNote(e.target.value)} />
          </label>
          <div className="option-add-actions">
            <button type="button" className="button" onClick={() => void saveEdit()}>{t('common.save')}</button>
            <button type="button" className="button secondary" onClick={() => setEditing(null)}>{t('common.cancel')}</button>
          </div>
        </div>
      ) : null}

      {documents.length === 0 ? (
        <p className="muted">{t('personDocs.noneYet')}</p>
      ) : (
        <div className="table-scroll">
          <table aria-label={t('personDocs.title')}>
            <thead>
              <tr>
                <th>{t('personDocs.colType')}</th>
                <th>{t('personDocs.colName')}</th>
                <th>{t('personDocs.colExpiry')}</th>
                <th>{t('personDocs.colUploaded')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => (
                <tr key={d.id}>
                  <td>{d.type ? listName(d.type, lang) : t('personDocs.noType')}</td>
                  <td dir="auto" data-user-content="">{d.name}</td>
                  <td className={d.state === 'expired' ? 'expiry-expired' : d.state === 'soon' ? 'expiry-soon' : undefined}>
                    {d.state === 'expired' ? t('personDocs.expired')
                      : d.state === 'soon' && d.expiryDate ? expiresInDays(t, d.expiryDate, today as ISODate)
                        : d.expiryDate ? formatDate(d.expiryDate) : t('common.notSet')}
                  </td>
                  <td>{formatDate(toLocalDate(d.uploadedAt))}</td>
                  <td className="option-add-actions">
                    <FileActions file={{ name: d.name, mime: d.mime, previewable: d.previewable, fileUrl: api.personDocumentFileUrl(d.id) }} />
                    {confirmingId === d.id ? (
                      <>
                        <span>{t('personDocs.confirmDelete')}</span>
                        <button type="button" className="button danger" onClick={() => void remove(d.id)}>{t('common.delete')}</button>
                        <button type="button" className="button secondary" onClick={() => setConfirmingId(null)}>{t('common.keep')}</button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button" className="button secondary" dir="auto" data-user-content=""
                          aria-label={t('personDocs.editAria', { name: d.name })} onClick={() => startEditing(d)}
                        >
                          {t('common.edit')}
                        </button>
                        <button
                          type="button" className="button ghost-icon" dir="auto" data-user-content=""
                          aria-label={t('personDocs.deleteAria', { name: d.name })} onClick={() => setConfirmingId(d.id)}
                        >
                          <TrashIcon />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
