import { useState } from 'react';
import { toLocalDate } from '../../shared/calendar';
import type { AttachmentRecord, EntryRecord } from '../../shared/types';
import { useFormat } from '../i18n/format';
import { useLang, useT } from '../i18n/LanguageProvider';
import { FileIcon } from '../icons';
import { phaseRefLabel, type PhaseNameFor } from '../todos';
import { FileActions } from './FileActions';

export interface AttachmentListColumns {
  type?: boolean;
  phase?: boolean;
  documentDate?: boolean;
  uploaded?: boolean;
  size?: boolean;
  from?: boolean;
}

const DEFAULT_COLUMNS: Required<AttachmentListColumns> = {
  type: true, phase: true, documentDate: true, uploaded: true, size: true, from: true,
};

export interface AttachmentListProps {
  attachments: AttachmentRecord[];
  nameFor?: PhaseNameFor;
  columns?: AttachmentListColumns;
  /** Called for the "From" column's link, when the attachment belongs to a meeting or update. Omit to hide the link. */
  onOpenEntry?: (entryId: number) => void;
  /** Looks up the entry an attachment belongs to, so the "From" link can show its title and date. */
  entryFor?: (entryId: number) => EntryRecord | undefined;
  /**
   * Edit and delete row actions; left out for a read-only list (EntryItem, the phase side panel, presentation).
   * `Preview` and `Download` are always shown (Preview only for a previewable file).
   */
  actions?: {
    onEdit: (a: AttachmentRecord) => void;
    onDelete: (a: AttachmentRecord) => void;
  };
  emptyMessage?: string;
  ariaLabel?: string;
}

/** A table of attachments, reused (read-only or with Edit/Delete) by the Attachments tab, EntryItem and the phase side panel. */
export function AttachmentList({
  attachments, nameFor, columns, onOpenEntry, entryFor, actions, emptyMessage, ariaLabel,
}: AttachmentListProps) {
  const t = useT();
  const { lang } = useLang();
  const { formatDate, shortDate, fileSize } = useFormat();
  const cols = { ...DEFAULT_COLUMNS, ...columns };
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  if (attachments.length === 0) {
    return <p className="muted">{emptyMessage ?? t('attachments.nothingYet')}</p>;
  }

  return (
    <>
      <table aria-label={ariaLabel ?? t('tabs.attachments')} className="attachment-table">
        <thead>
          <tr>
            <th>{t('attachments.colName')}</th>
            {cols.type ? <th>{t('attachments.colType')}</th> : null}
            {cols.phase ? <th>{t('attachments.colPhase')}</th> : null}
            {cols.documentDate ? <th>{t('attachments.colDocumentDate')}</th> : null}
            {cols.uploaded ? <th>{t('attachments.colUploaded')}</th> : null}
            {cols.size ? <th>{t('attachments.colSize')}</th> : null}
            {cols.from ? <th>{t('attachments.colFrom')}</th> : null}
            <th />
          </tr>
        </thead>
        <tbody>
          {attachments.map((a) => (
            <tr key={a.id}>
              <td data-col="name">
                <FileIcon />
                <span dir="auto" data-user-content="">{a.name}</span>
              </td>
              {cols.type ? (
                <td data-col="type">{a.type ? (lang === 'ar' ? a.type.nameAr ?? a.type.name : a.type.name) : t('attachments.noType')}</td>
              ) : null}
              {cols.phase ? <td data-col="phase">{a.phase ? phaseRefLabel(a.phase, nameFor) : t('attachments.wholeProject')}</td> : null}
              {cols.documentDate ? (
                <td data-col="date">{a.documentDate ? formatDate(a.documentDate) : t('common.notSet')}</td>
              ) : null}
              {cols.uploaded ? <td data-col="uploaded">{formatDate(toLocalDate(a.uploadedAt))}</td> : null}
              {cols.size ? <td data-col="size">{fileSize(a.size)}</td> : null}
              {cols.from ? (
                <td data-col="from">
                  {a.entryId !== null && onOpenEntry ? (
                    (() => {
                      const entry = entryFor?.(a.entryId);
                      return entry ? (
                        <button type="button" className="button-link" onClick={() => onOpenEntry(a.entryId!)}>
                          <span dir="auto" data-user-content="">{entry.title}</span>
                          {' · '}
                          {shortDate(entry.effectiveDate)}
                        </button>
                      ) : (
                        <button type="button" className="button-link" onClick={() => onOpenEntry(a.entryId!)}>
                          {t('attachments.viewInHistory')}
                        </button>
                      );
                    })()
                  ) : (
                    t('common.none')
                  )}
                </td>
              ) : null}
              <td data-col="actions" className="option-add-actions">
                <FileActions attachment={a} />
                {actions && confirmingId === a.id ? (
                  <>
                    <span>{t('attachments.confirmDelete')}</span>
                    <button
                      type="button"
                      className="button danger"
                      onClick={() => {
                        setConfirmingId(null);
                        actions.onDelete(a);
                      }}
                    >
                      {t('common.delete')}
                    </button>
                    <button type="button" className="button secondary" onClick={() => setConfirmingId(null)}>{t('common.keep')}</button>
                  </>
                ) : actions ? (
                  <>
                    <button
                      type="button"
                      className="button secondary"
                      dir="auto"
                      data-user-content=""
                      aria-label={t('attachments.editAria', { name: a.name })}
                      onClick={() => actions.onEdit(a)}
                    >
                      {t('common.edit')}
                    </button>
                    <button
                      type="button"
                      className="button secondary"
                      dir="auto"
                      data-user-content=""
                      aria-label={t('attachments.deleteAria', { name: a.name })}
                      onClick={() => setConfirmingId(a.id)}
                    >
                      {t('common.delete')}
                    </button>
                  </>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
