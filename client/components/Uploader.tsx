import { useRef, useState } from 'react';
import type { AttachmentRecord } from '../../shared/types';
import { api } from '../api';
import { messagesOf } from '../errors';
import { useFormat } from '../i18n/format';
import { useT } from '../i18n/LanguageProvider';
import { UploadIcon } from '../icons';

interface PendingFile {
  key: string;
  file: File;
  status: 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
}

export interface UploaderProps {
  projectId: number;
  /** Fixed metadata sent with every file this instance uploads. */
  typeId?: number | null;
  phaseId?: number | null;
  documentDate?: string | null;
  entryId?: number | null;
  /** The visible (and accessible) text for the file picker. */
  buttonLabel: string;
  /** Called once per file, right after it finishes uploading successfully. */
  onUploaded: (attachment: AttachmentRecord) => void;
  /** Reports whether any file is still uploading or has failed, so a parent form can hold off saving. */
  onBusyChange?: (busy: boolean) => void;
  disabled?: boolean;
}

/**
 * A button (and drop target) that uploads every file chosen, one request per file, showing a progress bar while it
 * runs and a Retry button if it fails. Shared by the Attachments tab and `EntryForm`'s "Attach files" picker.
 */
export function Uploader({
  projectId, typeId, phaseId, documentDate, entryId, buttonLabel, onUploaded, onBusyChange, disabled,
}: UploaderProps) {
  const t = useT();
  const { fileSize } = useFormat();
  const [files, setFiles] = useState<PendingFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  // Mirrors `files`, so its up-to-date value is available synchronously (state itself only updates on the next
  // render). Updating it and reporting busy happen as plain statements, never from inside a setState updater
  // function — doing that from there risks running while React is still rendering this component.
  const filesRef = useRef<PendingFile[]>([]);

  function applyFiles(next: PendingFile[]) {
    filesRef.current = next;
    setFiles(next);
    onBusyChange?.(next.some((f) => f.status !== 'done'));
  }

  function patchFile(key: string, patch: Partial<PendingFile>) {
    applyFiles(filesRef.current.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  }

  function startUpload(key: string, file: File) {
    patchFile(key, { status: 'uploading', progress: 0, error: undefined });
    api
      .uploadAttachment(
        projectId, file, file.name,
        {
          typeId: typeId ?? undefined,
          phaseId: phaseId ?? undefined,
          documentDate: documentDate ?? undefined,
          entryId: entryId ?? undefined,
        },
        (loaded, total) => {
          patchFile(key, { progress: total > 0 ? Math.round((loaded / total) * 100) : 0 });
        },
      )
      .then(
        (attachment) => {
          patchFile(key, { status: 'done', progress: 100 });
          onUploaded(attachment);
        },
        (err) => {
          patchFile(key, { status: 'error', error: messagesOf(err, t)[0] });
        },
      );
  }

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const added: PendingFile[] = Array.from(list).map((file, i) => ({
      key: `${Date.now()}-${i}-${file.name}`, file, status: 'uploading', progress: 0,
    }));
    applyFiles([...filesRef.current, ...added]);
    for (const f of added) startUpload(f.key, f.file);
  }

  function retry(key: string) {
    const target = filesRef.current.find((f) => f.key === key);
    if (target) startUpload(key, target.file);
  }

  return (
    <div
      className="uploader"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        addFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="visually-hidden"
        aria-label={buttonLabel}
        disabled={disabled}
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <button type="button" className="button secondary" disabled={disabled} onClick={() => inputRef.current?.click()}>
        <UploadIcon />
        {buttonLabel}
      </button>

      {files.length > 0 ? (
        <ul className="uploader-files">
          {files.map((f) => (
            <li key={f.key} className={`uploader-file uploader-file-${f.status}`}>
              <span className="uploader-file-name" dir="auto" data-user-content="">{f.file.name}</span>
              <span className="uploader-file-size">{fileSize(f.file.size)}</span>
              {f.status === 'uploading' ? (
                <progress className="uploader-progress" value={f.progress} max={100} aria-label={t('uploader.uploading')} />
              ) : null}
              {f.status === 'error' ? (
                <span className="uploader-file-error-row">
                  <span role="alert">{f.error}</span>
                  <button type="button" className="button secondary" onClick={() => retry(f.key)}>{t('common.retry')}</button>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
