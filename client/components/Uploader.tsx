import { useEffect, useRef, useState } from 'react';
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
  /**
   * Files to start uploading as soon as they arrive, e.g. dropped on the Attachments tab before this Uploader was
   * mounted. Consumed once (`onInitialFilesConsumed` fires right after), so a later drop can hand over a fresh array.
   */
  initialFiles?: File[] | null;
  onInitialFilesConsumed?: () => void;
  /**
   * Restricts the picker and drop target to one file at a time (M7 review fix): set while the Key dates section
   * has rows, since those rows are only ever linked to the single file being uploaded.
   */
  singleFile?: boolean;
  /** Shown under the picker only while `singleFile` is set, explaining the restriction. */
  singleFileHint?: string;
}

/**
 * A button (and drop target) that uploads every file chosen, one request per file, showing a progress bar while it
 * runs and a Retry button if it fails. Shared by the Attachments tab and `EntryForm`'s "Attach files" picker.
 */
export function Uploader({
  projectId, typeId, phaseId, documentDate, entryId, buttonLabel, onUploaded, onBusyChange, disabled,
  initialFiles, onInitialFilesConsumed, singleFile, singleFileHint,
}: UploaderProps) {
  const t = useT();
  const { fileSize } = useFormat();
  const [files, setFiles] = useState<PendingFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  // Mirrors `files`, so its up-to-date value is available synchronously (state itself only updates on the next
  // render). Updating it and reporting busy happen as plain statements, never from inside a setState updater
  // function — doing that from there risks running while React is still rendering this component.
  const filesRef = useRef<PendingFile[]>([]);
  // Mirrors `onUploaded`, so the upload's `.then` handler — created (and closed over whichever `onUploaded` was
  // current) at the render where the upload started — always calls the LATEST callback instead of a stale one
  // (M7 review fix). Without this, a parent whose own `onUploaded` closes over state that changes between the
  // upload starting and its response arriving (e.g. a key date typed in mid-upload) would see that change lost.
  const onUploadedRef = useRef(onUploaded);
  onUploadedRef.current = onUploaded;

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
          onUploadedRef.current(attachment);
        },
        (err) => {
          patchFile(key, { status: 'error', error: messagesOf(err, t)[0] });
        },
      );
  }

  function addFiles(list: FileList | File[] | null) {
    if (!list || list.length === 0) return;
    // Only the first file when restricted to one (M7 review fix): dropping several onto a single-file target
    // picks the first, rather than silently uploading the rest.
    const chosen = singleFile ? Array.from(list).slice(0, 1) : Array.from(list);
    const added: PendingFile[] = chosen.map((file, i) => ({
      key: `${Date.now()}-${i}-${file.name}`, file, status: 'uploading', progress: 0,
    }));
    applyFiles([...filesRef.current, ...added]);
    for (const f of added) startUpload(f.key, f.file);
  }

  function retry(key: string) {
    const target = filesRef.current.find((f) => f.key === key);
    if (target) startUpload(key, target.file);
  }

  // Files dropped on the Attachments tab before this Uploader was even mounted: start uploading them right away.
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      addFiles(initialFiles);
      onInitialFilesConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFiles]);

  return (
    <div
      className="uploader"
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        addFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        multiple={!singleFile}
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

      {singleFile && singleFileHint ? <p className="muted">{singleFileHint}</p> : null}

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
