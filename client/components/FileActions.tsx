import { useRef, useState } from 'react';
import type { AttachmentRecord } from '../../shared/types';
import { api } from '../api';
import { useT } from '../i18n/LanguageProvider';
import { FilePreview } from './FilePreview';

export interface FileActionsProps {
  attachment: AttachmentRecord;
}

/**
 * Preview (when possible) and Download for one attachment: shared by the phase side panel's file row and
 * `AttachmentList`. The buttons' own text is a UI string ("Preview"/"Download"), so it carries no `dir="auto"` or
 * `data-user-content` — only their `aria-label`s embed the file name.
 */
export function FileActions({ attachment: a }: FileActionsProps) {
  const t = useT();
  const [previewing, setPreviewing] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      {a.previewable ? (
        <button
          ref={triggerRef}
          type="button"
          className="button secondary"
          aria-label={t('attachments.previewAria', { name: a.name })}
          onClick={() => setPreviewing(true)}
        >
          {t('common.preview')}
        </button>
      ) : null}
      <a
        className="button secondary"
        href={api.attachmentFileUrl(a.id)}
        download
        aria-label={t('attachments.downloadAria', { name: a.name })}
      >
        {t('common.download')}
      </a>
      {previewing ? <FilePreview attachment={a} onClose={() => setPreviewing(false)} returnFocusTo={triggerRef.current} /> : null}
    </>
  );
}
