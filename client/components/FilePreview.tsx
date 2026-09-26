import { useEffect, useId, useRef } from 'react';
import type { AttachmentRecord } from '../../shared/types';
import { api } from '../api';
import { useT } from '../i18n/LanguageProvider';

const FOCUSABLE = 'button, a[href], iframe, input, [tabindex]:not([tabindex="-1"])';

/** A previewable file's own details, independent of what kind of record it comes from (an attachment, a person document, …). */
export interface PreviewableFile {
  name: string;
  mime: string;
  /** The file's own URL, without `?inline=1` — `FilePreview` adds that itself for the iframe/image `src`. */
  fileUrl: string;
}

export type FilePreviewProps =
  | { attachment: AttachmentRecord; onClose: () => void; returnFocusTo?: HTMLElement | null }
  | ({ file: PreviewableFile; onClose: () => void; returnFocusTo?: HTMLElement | null });

function toFile(props: FilePreviewProps): PreviewableFile {
  if ('attachment' in props) {
    const a = props.attachment;
    return { name: a.name, mime: a.mime, fileUrl: api.attachmentFileUrl(a.id) };
  }
  return props.file;
}

/**
 * A modal dialog previewing a PDF (in an iframe) or an image, with the file name and a Download link. Escape closes
 * it, Tab is trapped inside it, and closing returns focus to whatever opened it. Reusable for any previewable file:
 * pass either `attachment` (attachments) or the generic `file` shape (e.g. person documents, M7 Task 8).
 */
export function FilePreview(props: FilePreviewProps) {
  const { onClose, returnFocusTo } = props;
  const file = toFile(props);
  const t = useT();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef(returnFocusTo);
  returnFocusRef.current = returnFocusTo;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusables = () => Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
    focusables()[0]?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    dialog.addEventListener('keydown', onKeyDown);
    return () => dialog.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => () => returnFocusRef.current?.focus(), []);

  const isImage = file.mime.startsWith('image/');
  const previewUrl = `${file.fileUrl}${file.fileUrl.includes('?') ? '&' : '?'}inline=1`;

  return (
    <div className="file-preview-overlay">
      <div className="file-preview" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={dialogRef}>
        <div className="file-preview-head">
          <span id={titleId} className="file-preview-name" dir="auto" data-user-content="">{file.name}</span>
          <a className="button secondary" href={file.fileUrl} download>{t('common.download')}</a>
          <button type="button" className="button ghost-icon" aria-label={t('filePreview.closeAria')} onClick={onClose}>×</button>
        </div>
        <div className="file-preview-body">
          {isImage ? (
            <img src={previewUrl} alt={file.name} dir="auto" data-user-content="" />
          ) : (
            <iframe src={previewUrl} title={file.name} dir="auto" data-user-content="" />
          )}
        </div>
      </div>
    </div>
  );
}
