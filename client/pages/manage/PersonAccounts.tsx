import { useState } from 'react';
import type { ListValue, PersonAccountRecord } from '../../../shared/types';
import { api } from '../../api';
import { messagesOf } from '../../errors';
import { AlertIcon, PlusIcon, TrashIcon } from '../../icons';
import { useFormat } from '../../i18n/format';
import { useLang, useT } from '../../i18n/LanguageProvider';
import { listName } from '../../i18n/listNames';
import { useAsync } from '../../useAsync';

export interface PersonAccountsProps {
  resourceId: number;
  accountTypes: ListValue[];
  today: string;
  refreshKey?: number;
}

/** "renew within {n} days" / "expired {n} days ago" (Arabic plurals), against this account's own remindDays. */
function stateText(t: ReturnType<typeof useT>, a: PersonAccountRecord, today: string): string {
  const days = Math.round((new Date(`${a.expiryDate}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86_400_000);
  if (a.state === 'expired') return t('personAccounts.expiredAgo', { count: -days });
  if (a.state === 'soon') return t('personAccounts.renewWithin', { count: days });
  return '';
}

/** The person page's "Accounts" card (الأحقيات): add, renew, edit and delete a person's work accounts. Never on /present. */
export function PersonAccounts({ resourceId, accountTypes, today, refreshKey = 0 }: PersonAccountsProps) {
  const t = useT();
  const { lang } = useLang();
  const { formatDate } = useFormat();
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);
  const loaded = useAsync(() => api.listPersonAccounts(resourceId), [resourceId, version, refreshKey]);
  const accounts = loaded.data ?? [];

  const [adding, setAdding] = useState(false);
  const [addTypeId, setAddTypeId] = useState<number | null>(null);
  const [addExpiry, setAddExpiry] = useState('');
  const [addRemindDays, setAddRemindDays] = useState(30);
  const [addNote, setAddNote] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const [editing, setEditing] = useState<PersonAccountRecord | null>(null);
  const [editTypeId, setEditTypeId] = useState<number | null>(null);
  const [editExpiry, setEditExpiry] = useState('');
  const [editRemindDays, setEditRemindDays] = useState(30);
  const [editNote, setEditNote] = useState('');

  const [renewing, setRenewing] = useState<PersonAccountRecord | null>(null);
  const [renewExpiry, setRenewExpiry] = useState('');

  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  async function add() {
    setErrors([]);
    try {
      await api.addPersonAccount(resourceId, { typeId: addTypeId ?? undefined, expiryDate: addExpiry, remindDays: addRemindDays, note: addNote });
      setAdding(false);
      setAddTypeId(null);
      setAddExpiry('');
      setAddRemindDays(30);
      setAddNote('');
      reload();
    } catch (err) {
      setErrors(messagesOf(err, t));
    }
  }

  function startEditing(a: PersonAccountRecord) {
    setEditing(a);
    setEditTypeId(a.type?.id ?? null);
    setEditExpiry(a.expiryDate);
    setEditRemindDays(a.remindDays);
    setEditNote(a.note ?? '');
  }

  async function saveEdit() {
    if (!editing) return;
    setErrors([]);
    try {
      await api.updatePersonAccount(editing.id, {
        typeId: editTypeId ?? undefined, expiryDate: editExpiry, remindDays: editRemindDays, note: editNote,
      });
      setEditing(null);
      reload();
    } catch (err) {
      setErrors(messagesOf(err, t));
    }
  }

  function startRenewing(a: PersonAccountRecord) {
    setRenewing(a);
    setRenewExpiry('');
  }

  async function saveRenew() {
    if (!renewing || !renewExpiry) return;
    setErrors([]);
    try {
      await api.updatePersonAccount(renewing.id, {
        typeId: renewing.type?.id ?? undefined, expiryDate: renewExpiry, remindDays: renewing.remindDays,
        note: t('personAccounts.renewedNote', { date: formatDate(renewExpiry), old: formatDate(renewing.expiryDate) }),
      });
      setRenewing(null);
      reload();
    } catch (err) {
      setErrors(messagesOf(err, t));
    }
  }

  async function remove(id: number) {
    setErrors([]);
    try {
      await api.deletePersonAccount(id);
      setConfirmingId(null);
      reload();
    } catch (err) {
      setErrors(messagesOf(err, t));
    }
  }

  return (
    <section className="card">
      <div className="phase-people-head">
        <h2>{t('personAccounts.title')}</h2>
        {!adding ? (
          <button type="button" className="button secondary" onClick={() => setAdding(true)}>
            <PlusIcon />{t('personAccounts.addAccount')}
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
          <label>
            {t('personAccounts.colType')}
            <select value={addTypeId === null ? '' : String(addTypeId)} onChange={(e) => setAddTypeId(e.target.value === '' ? null : Number(e.target.value))}>
              <option value="">{t('personDocs.noType')}</option>
              {accountTypes.map((v) => <option key={v.id} value={String(v.id)}>{listName(v, lang)}</option>)}
            </select>
          </label>
          <label>
            {t('personAccounts.expiryField')}
            <input type="date" value={addExpiry} onChange={(e) => setAddExpiry(e.target.value)} />
          </label>
          <label>
            {t('personAccounts.remindDaysField')}
            <input type="number" min={1} max={365} value={addRemindDays} onChange={(e) => setAddRemindDays(e.target.valueAsNumber)} />
          </label>
          <label>
            {t('personAccounts.noteField')}
            <input dir="auto" value={addNote} onChange={(e) => setAddNote(e.target.value)} />
          </label>
          <div className="option-add-actions">
            <button type="button" className="button" disabled={!addExpiry} onClick={() => void add()}>{t('common.add')}</button>
            <button type="button" className="button secondary" onClick={() => setAdding(false)}>{t('common.cancel')}</button>
          </div>
        </div>
      ) : null}

      {editing ? (
        <div className="upload-row">
          <label>
            {t('personAccounts.colType')}
            <select value={editTypeId === null ? '' : String(editTypeId)} onChange={(e) => setEditTypeId(e.target.value === '' ? null : Number(e.target.value))}>
              <option value="">{t('personDocs.noType')}</option>
              {accountTypes.map((v) => <option key={v.id} value={String(v.id)}>{listName(v, lang)}</option>)}
            </select>
          </label>
          <label>
            {t('personAccounts.expiryField')}
            <input type="date" value={editExpiry} onChange={(e) => setEditExpiry(e.target.value)} />
          </label>
          <label>
            {t('personAccounts.remindDaysField')}
            <input type="number" min={1} max={365} value={editRemindDays} onChange={(e) => setEditRemindDays(e.target.valueAsNumber)} />
          </label>
          <label>
            {t('personAccounts.noteField')}
            <input dir="auto" value={editNote} onChange={(e) => setEditNote(e.target.value)} />
          </label>
          <div className="option-add-actions">
            <button type="button" className="button" onClick={() => void saveEdit()}>{t('common.save')}</button>
            <button type="button" className="button secondary" onClick={() => setEditing(null)}>{t('common.cancel')}</button>
          </div>
        </div>
      ) : null}

      {renewing ? (
        <div className="upload-row">
          <label>
            {t('personAccounts.renewedNewExpiry')}
            <input type="date" value={renewExpiry} onChange={(e) => setRenewExpiry(e.target.value)} />
          </label>
          <div className="option-add-actions">
            <button type="button" className="button" disabled={!renewExpiry} onClick={() => void saveRenew()}>{t('personAccounts.renewed')}</button>
            <button type="button" className="button secondary" onClick={() => setRenewing(null)}>{t('common.cancel')}</button>
          </div>
        </div>
      ) : null}

      {accounts.length === 0 ? (
        <p className="muted">{t('personAccounts.noneYet')}</p>
      ) : (
        <div className="table-scroll">
          <table aria-label={t('personAccounts.title')}>
            <thead>
              <tr>
                <th>{t('personAccounts.colType')}</th>
                <th>{t('personAccounts.colExpiry')}</th>
                <th>{t('personAccounts.colReminder')}</th>
                <th>{t('personAccounts.colNote')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => {
                const typeText = a.type ? listName(a.type, lang) : t('personDocs.noType');
                return (
                  <tr key={a.id}>
                    <td>{typeText}</td>
                    <td className={a.state === 'expired' ? 'expiry-expired' : a.state === 'soon' ? 'expiry-soon' : undefined}>
                      {formatDate(a.expiryDate)}
                      {a.state !== 'fine' ? <> · {stateText(t, a, today)}</> : null}
                    </td>
                    <td>{t('personAccounts.remindBefore', { count: a.remindDays })}</td>
                    <td dir="auto" data-user-content="">{a.note ?? '—'}</td>
                    <td className="option-add-actions">
                      {confirmingId === a.id ? (
                        <>
                          <span>{t('personAccounts.confirmDelete')}</span>
                          <button type="button" className="button danger" onClick={() => void remove(a.id)}>{t('common.delete')}</button>
                          <button type="button" className="button secondary" onClick={() => setConfirmingId(null)}>{t('common.keep')}</button>
                        </>
                      ) : (
                        <>
                          <button type="button" className="button secondary" onClick={() => startRenewing(a)}>{t('personAccounts.renewed')}</button>
                          <button
                            type="button" className="button secondary"
                            aria-label={t('personAccounts.editAria', { type: typeText })} onClick={() => startEditing(a)}
                          >
                            {t('common.edit')}
                          </button>
                          <button
                            type="button" className="button ghost-icon"
                            aria-label={t('personAccounts.deleteAria', { type: typeText })} onClick={() => setConfirmingId(a.id)}
                          >
                            <TrashIcon />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
