import { useEffect, useId, useRef } from 'react';
import type { AttachmentRecord } from '../../shared/types';
import { api } from '../api';
import { useT } from '../i18n/LanguageProvider';

const FOCUSABLE = 'button, a[href], iframe, input, [tabindex]:not([tabindex="-1"])';

export interface FilePreviewProps {
  attachment: AttachmentRecord;
  onClose: () => void;
  /** The element to return focus to once the dialog closes; typically the button that opened it. */
  returnFocusTo?: HTMLElement | null;
}

/**
 * A modal dialog previewing a PDF (in an iframe) or an image, with the file name and a Download link. Escape closes
 * it, Tab is trapped inside it, and closing returns focus to whatever opened it.
 */
export function FilePreview({ attachment, onClose, returnFocusTo }: FilePreviewProps) {
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

  const isImage = attachment.mime.startsWith('image/');

  return (
    <div className="file-preview-overlay">
      <div className="file-preview" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={dialogRef}>
        <div className="file-preview-head">
          <span id={titleId} className="file-preview-name" dir="auto" data-user-content="">{attachment.name}</span>
          <a className="button secondary" href={api.attachmentFileUrl(attachment.id)} download>{t('common.download')}</a>
          <button type="button" className="button ghost-icon" aria-label={t('filePreview.closeAria')} onClick={onClose}>×</button>
        </div>
        <div className="file-preview-body">
          {isImage ? (
            <img src={api.attachmentFileUrl(attachment.id, true)} alt={attachment.name} dir="auto" data-user-content="" />
          ) : (
            <iframe src={api.attachmentFileUrl(attachment.id, true)} title={attachment.name} dir="auto" data-user-content="" />
          )}
        </div>
      </div>
    </div>
  );
}
