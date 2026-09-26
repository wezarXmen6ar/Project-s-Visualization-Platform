import { useState, type FormEvent } from 'react';
import type { MessageKey } from '../../../shared/i18n/en';
import type { ListName, ListValue } from '../../../shared/types';
import { AlertIcon, PlusIcon, TrashIcon } from '../../icons';
import { ApiError, api } from '../../api';
import { messagesOf } from '../../errors';
import { useLang, useT } from '../../i18n/LanguageProvider';
import { listName } from '../../i18n/listNames';

/** Codes whose {name} param is the value's English name, even in Arabic (see server/lists/repo.ts): the value being
 * deleted is used elsewhere. Re-rendered with the value's own display name instead of the server's English one. */
const NAME_ERROR_CODES: MessageKey[] = ['error.listValueInUseProjects', 'error.listValueInUsePeople', 'error.phaseHasStarters'];

interface ListEditorProps {
  title: string;
  /** Singular name used in labels, e.g. "Goal" → "New goal", "Add goal" (lower-cased in English only). */
  singular: string;
  list: ListName;
  values: ListValue[];
  /** Called after every successful change, so the page can reload the lists. */
  onChanged: () => void;
}

/** Add, rename and delete the values of one dropdown list. */
export function ListEditor({ title, singular, list, values, onChanged }: ListEditorProps) {
  const t = useT();
  const { lang } = useLang();
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<{ id: number; name: string; nameAr: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lower = lang === 'en' ? singular.toLowerCase() : singular;

  /** The "in use" errors' `params.name` is the value's English name (see server/lists/repo.ts); `target` is the
   * value the action was performed on, so its display name (Arabic when set) replaces the English one. */
  function errorText(err: unknown, target?: ListValue): string {
    if (err instanceof ApiError && target && err.code && NAME_ERROR_CODES.includes(err.code) && err.params) {
      return t(err.code, { ...err.params, name: listName(target, lang) });
    }
    return messagesOf(err, t)[0];
  }

  async function run(action: () => Promise<unknown>, afterSuccess?: () => void, target?: ListValue) {
    setBusy(true);
    setError(null);
    try {
      await action();
      afterSuccess?.();
      onChanged();
    } catch (err) {
      setError(errorText(err, target));
    } finally {
      setBusy(false);
    }
  }

  function onAdd(e: FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (name) void run(() => api.addListValue(list, name), () => setNewName(''));
  }

  return (
    <section className="card">
      <h2>{title}</h2>
      {error ? (
        <div className="errors" role="alert">
          <AlertIcon />
          <span>{error}</span>
        </div>
      ) : null}

      {values.length === 0 ? (
        <p className="muted">{t('list.nothingYet')}</p>
      ) : (
        <ul className="list-editor">
          {values.map((v) => (
            <li key={v.id} className="list-editor-row">
              {editing?.id === v.id ? (
                <>
                  <input
                    aria-label={t('list.newName', { name: listName(v, lang) })}
                    dir="auto"
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  />
                  <input
                    aria-label={t('list.newNameAr', { name: listName(v, lang) })}
                    dir="rtl"
                    value={editing.nameAr}
                    onChange={(e) => setEditing({ ...editing, nameAr: e.target.value })}
                  />
                  <button
                    type="button"
                    className="button"
                    disabled={busy || !editing.name.trim()}
                    onClick={() =>
                      void run(
                        () => api.renameListValue(list, v.id, editing.name.trim(), editing.nameAr.trim() || null),
                        () => setEditing(null),
                      )
                    }
                  >
                    {t('common.save')}
                  </button>
                  <button type="button" className="button secondary" onClick={() => setEditing(null)}>{t('common.cancel')}</button>
                </>
              ) : (
                <>
                  <span className="list-editor-name" dir="auto" data-user-content="">{v.name}</span>
                  {v.nameAr ? <span className="list-editor-name-ar" dir="rtl">{v.nameAr}</span> : null}
                  <button
                    type="button"
                    className="button secondary"
                    aria-label={t('list.renameAria', { name: listName(v, lang) })}
                    onClick={() => setEditing({ id: v.id, name: v.name, nameAr: v.nameAr ?? '' })}
                  >
                    {t('list.rename')}
                  </button>
                  <button
                    type="button"
                    className="button ghost-icon"
                    aria-label={t('list.deleteAria', { name: listName(v, lang) })}
                    disabled={busy}
                    onClick={() => void run(() => api.deleteListValue(list, v.id), undefined, v)}
                  >
                    <TrashIcon />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <form className="list-editor-add" onSubmit={onAdd}>
        <input
          aria-label={t('list.new', { noun: lower })}
          placeholder={t('list.addPlaceholder', { noun: lower })}
          dir="auto"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="submit" className="button secondary" disabled={busy || !newName.trim()}>
          <PlusIcon />{t('list.add', { noun: lower })}
        </button>
      </form>
    </section>
  );
}
