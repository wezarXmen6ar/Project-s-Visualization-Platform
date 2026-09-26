import { useState } from 'react';
import { daysUntilExpiry } from '../../../shared/expiry';
import type { ISODate } from '../../../shared/calendar';
import type { KeyDateRecord, ListValue } from '../../../shared/types';
import { api } from '../../api';
import { FileActions } from '../../components/FileActions';
import { draftFrom, KeyDateRows, newKeyDateDraft, toKeyDateInput, type KeyDateDraft } from '../../components/KeyDateRows';
import { messagesOf } from '../../errors';
import { AlertIcon, PlusIcon, TrashIcon } from '../../icons';
import { useFormat } from '../../i18n/format';
import { useLang, useT } from '../../i18n/LanguageProvider';
import { listName } from '../../i18n/listNames';
import { useAsync } from '../../useAsync';

export interface KeyDatesCardProps {
  projectId: number;
  keyDateTypes: ListValue[];
  today: string;
  /** Bumped by the page when something else changed (e.g. a key date was added from the Attachments tab), to reload. */
  refreshKey?: number;
}

/** "in 12 days" / "passed 3 days ago" / "today", against the fixed 30-day window (M7 Task 9). */
function relativeText(t: ReturnType<typeof useT>, k: KeyDateRecord, today: ISODate): string {
  const days = daysUntilExpiry(k.date, today);
  if (k.state === 'expired') return t('keyDates.passedAgo', { count: Math.abs(days) });
  return days === 0 ? t('keyDates.today') : t('keyDates.inDays', { count: days });
}

/** The Details tab's "Key dates" card (التواريخ المهمة, M7 Task 9): add, edit and delete a project's key dates. Never on /present. */
export function KeyDatesCard({ projectId, keyDateTypes, today, refreshKey = 0 }: KeyDatesCardProps) {
  const t = useT();
  const { lang } = useLang();
  const { formatDate } = useFormat();
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);
  const loaded = useAsync(() => api.listKeyDates(projectId), [projectId, version, refreshKey]);
  const keyDates = loaded.data ?? [];

  const [adding, setAdding] = useState(false);
  const [addRow, setAddRow] = useState<KeyDateDraft>(newKeyDateDraft());
  const [editing, setEditing] = useState<KeyDateRecord | null>(null);
  const [editRow, setEditRow] = useState<KeyDateDraft>(newKeyDateDraft());
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  function startAdding() {
    setAddRow(newKeyDateDraft());
    setAdding(true);
  }

  async function saveAdd() {
    setErrors([]);
    try {
      await api.addKeyDate(projectId, toKeyDateInput(addRow));
      setAdding(false);
      reload();
    } catch (err) {
      setErrors(messagesOf(err, t));
    }
  }

  function startEditing(k: KeyDateRecord) {
    setEditing(k);
    setEditRow(draftFrom(k));
  }

  async function saveEdit() {
    if (!editing) return;
    setErrors([]);
    try {
      // The card's own edit form never touches the link to a file: it always sends the file back unchanged, even
      // when there is none, so editing a key date here can never unlink it from its contract (M7 review fix).
      await api.updateKeyDate(editing.id, { ...toKeyDateInput(editRow), attachmentId: editing.attachment?.id });
      setEditing(null);
      reload();
    } catch (err) {
      setErrors(messagesOf(err, t));
    }
  }

  async function remove(id: number) {
    setErrors([]);
    try {
      await api.deleteKeyDate(id);
      setConfirmingId(null);
      reload();
    } catch (err) {
      setErrors(messagesOf(err, t));
    }
  }

  return (
    <section className="card">
      <div className="phase-people-head">
        <h2>{t('keyDates.title')}</h2>
        {!adding ? (
          <button type="button" className="button secondary" onClick={startAdding}>
            <PlusIcon />{t('keyDates.addKeyDate')}
          </button>
        ) : null}
      </div>

      {errors.length > 0 ? (
        <div className="errors" role="alert">
          <AlertIcon />
          <ul>{errors.map((m) => <li key={m}>{m}</li>)}</ul>
        </div>
      ) : null}

      {adding ? (
        <div className="upload-row">
          <KeyDateRows types={keyDateTypes} rows={[addRow]} onChange={(rows) => setAddRow(rows[0] ?? newKeyDateDraft())} allowAdd={false} allowRemove={false} />
          <div className="option-add-actions">
            <button type="button" className="button" onClick={() => void saveAdd()}>{t('common.save')}</button>
            <button type="button" className="button secondary" onClick={() => setAdding(false)}>{t('common.cancel')}</button>
          </div>
        </div>
      ) : null}

      {editing ? (
        <div className="upload-row">
          <KeyDateRows types={keyDateTypes} rows={[editRow]} onChange={(rows) => setEditRow(rows[0] ?? newKeyDateDraft())} allowAdd={false} allowRemove={false} />
          <div className="option-add-actions">
            <button type="button" className="button" onClick={() => void saveEdit()}>{t('common.save')}</button>
            <button type="button" className="button secondary" onClick={() => setEditing(null)}>{t('common.cancel')}</button>
          </div>
        </div>
      ) : null}

      {keyDates.length === 0 ? (
        <p className="muted">{t('keyDates.noneYet')}</p>
      ) : (
        <ul className="key-date-list">
          {keyDates.map((k) => (
            <li key={k.id} className="key-date-item">
              <div className="key-date-headline">
                <span dir="auto" data-user-content="">{k.type ? listName(k.type, lang) : t('keyDates.noType')}</span>
                <span>{formatDate(k.date)}</span>
                <span className={k.state === 'expired' ? 'expiry-expired' : k.state === 'soon' ? 'expiry-soon' : undefined}>
                  {relativeText(t, k, today as ISODate)}
                </span>
              </div>
              {k.note ? <p className="muted" dir="auto" data-user-content="">{k.note}</p> : null}
              <div className="option-add-actions">
                {k.attachment ? (
                  <FileActions
                    file={{
                      name: k.attachment.name, mime: k.attachment.mime, previewable: k.attachment.previewable,
                      fileUrl: api.attachmentFileUrl(k.attachment.id),
                    }}
                  />
                ) : null}
                {confirmingId === k.id ? (
                  <>
                    <span>{t('keyDates.confirmDelete')}</span>
                    <button type="button" className="button danger" onClick={() => void remove(k.id)}>{t('common.delete')}</button>
                    <button type="button" className="button secondary" onClick={() => setConfirmingId(null)}>{t('common.keep')}</button>
                  </>
                ) : (
                  <>
                    <button
                      type="button" className="button secondary" aria-label={t('keyDates.editAria', { type: k.type ? listName(k.type, lang) : t('keyDates.noType') })}
                      onClick={() => startEditing(k)}
                    >
                      {t('common.edit')}
                    </button>
                    <button
                      type="button" className="button ghost-icon" aria-label={t('keyDates.deleteAria', { type: k.type ? listName(k.type, lang) : t('keyDates.noType') })}
                      onClick={() => setConfirmingId(k.id)}
                    >
                      <TrashIcon />
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
