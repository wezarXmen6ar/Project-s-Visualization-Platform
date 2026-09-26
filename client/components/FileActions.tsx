import { useRef, useState } from 'react';
import type { AttachmentRecord } from '../../shared/types';
import { api } from '../api';
import { useT } from '../i18n/LanguageProvider';
import { FilePreview, type PreviewableFile } from './FilePreview';

export type FileActionsProps =
  | { attachment: AttachmentRecord }
  | { file: PreviewableFile & { previewable: boolean } };

function toFile(props: FileActionsProps): PreviewableFile & { previewable: boolean } {
  if ('attachment' in props) {
    const a = props.attachment;
    return { name: a.name, mime: a.mime, fileUrl: api.attachmentFileUrl(a.id), previewable: a.previewable };
  }
  return props.file;
}

/**
 * Preview (when possible) and Download for one file: shared by the phase side panel's file row, `AttachmentList`
 * and `PersonDocuments` (M7 Task 8). The buttons' own text is a UI string ("Preview"/"Download"), so it carries no
 * `dir="auto"` or `data-user-content` — only their `aria-label`s embed the file name.
 */
export function FileActions(props: FileActionsProps) {
  const file = toFile(props);
  const t = useT();
  const [previewing, setPreviewing] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      {file.previewable ? (
        <button
          ref={triggerRef}
          type="button"
          className="button secondary"
          aria-label={t('attachments.previewAria', { name: file.name })}
          onClick={() => setPreviewing(true)}
        >
          {t('common.preview')}
        </button>
      ) : null}
      <a
        className="button secondary"
        href={file.fileUrl}
        download
        aria-label={t('attachments.downloadAria', { name: file.name })}
      >
        {t('common.download')}
      </a>
      {previewing ? <FilePreview file={file} onClose={() => setPreviewing(false)} returnFocusTo={triggerRef.current} /> : null}
    </>
  );
}
