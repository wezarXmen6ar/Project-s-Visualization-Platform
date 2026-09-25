import { useState, type FormEvent } from 'react';
import type { ListValue } from '../../../shared/types';
import { AlertIcon, PlusIcon, TrashIcon } from '../../icons';
import { api } from '../../api';
import { messagesOf } from '../../errors';
import { useLang, useT } from '../../i18n/LanguageProvider';
import { listName } from '../../i18n/listNames';
import { useAsync } from '../../useAsync';

interface StarterEditorProps {
  /** The Phases list, in list order. */
  phases: ListValue[];
}

/** Starter to-do checklists kept per Phases-list value: offered, ticked, when a project gets one of these phases. */
export function StarterEditor({ phases }: StarterEditorProps) {
  const t = useT();
  const { lang } = useLang();
  const [version, setVersion] = useState(0);
  const starters = useAsync(() => api.listStarters(), [version]);
  const reload = () => setVersion((v) => v + 1);

  const [selected, setSelected] = useState<number | null>(null);
  const [editing, setEditing] = useState<{ id: number; title: string } | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // `selected` can point at a phase value that Settings just deleted or renamed away; when that happens, fall
  // back to the first available phase instead of showing an empty selection.
  const selectedStillExists = selected !== null && phases.some((p) => p.id === selected);
  const phaseId = selectedStillExists ? selected : (phases[0]?.id ?? null);
  const phase = phases.find((p) => p.id === phaseId);
  const items = (starters.data ?? []).filter((s) => s.phaseListId === phaseId);

  async function run(action: () => Promise<unknown>, afterSuccess?: () => void) {
    setBusy(true);
    setError(null);
    try {
      await action();
      afterSuccess?.();
      reload();
    } catch (err) {
      setError(messagesOf(err, t)[0]);
    } finally {
      setBusy(false);
    }
  }

  function onAdd(e: FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (title && phaseId !== null) void run(() => api.addStarter({ phaseListId: phaseId, title }), () => setNewTitle(''));
  }

  return (
    <section className="card">
      <h2>{t('todo.starters')}</h2>
      <p className="field-hint">{t('starter.hint')}</p>

      {error ? (
        <div className="errors" role="alert">
          <AlertIcon />
          <span>{error}</span>
        </div>
      ) : null}

      <label>
        {t('todo.phaseField')}
        <select
          value={phaseId === null ? '' : String(phaseId)}
          onChange={(e) => {
            setSelected(Number(e.target.value));
            setEditing(null);
          }}
        >
          {phases.map((p) => {
            const count = (starters.data ?? []).filter((s) => s.phaseListId === p.id).length;
            return (
              <option key={p.id} value={p.id}>
                {listName(p, lang)} ({count})
              </option>
            );
          })}
        </select>
      </label>

      {items.length === 0 ? (
        <p className="muted">{t('starter.none', { phase: phase ? listName(phase, lang) : '' })}</p>
      ) : (
        <ul className="list-editor">
          {items.map((item) => (
            <li key={item.id} className="list-editor-row">
              {editing?.id === item.id ? (
                <>
                  <input
                    aria-label={t('starter.newTitle', { title: item.title })}
                    dir="auto"
                    value={editing.title}
                    onChange={(e) => setEditing({ id: item.id, title: e.target.value })}
                  />
                  <button
                    type="button"
                    className="button"
                    disabled={busy || !editing.title.trim()}
                    onClick={() => void run(() => api.renameStarter(item.id, editing.title.trim()), () => setEditing(null))}
                  >
                    {t('common.save')}
                  </button>
                  <button type="button" className="button secondary" onClick={() => setEditing(null)}>{t('common.cancel')}</button>
                </>
              ) : (
                <>
                  <span className="list-editor-name" dir="auto" data-user-content="">{item.title}</span>
                  <button
                    type="button"
                    className="button secondary"
                    aria-label={t('list.renameAria', { name: item.title })}
                    onClick={() => setEditing({ id: item.id, title: item.title })}
                  >
                    {t('list.rename')}
                  </button>
                  <button
                    type="button"
                    className="button ghost-icon"
                    aria-label={t('starter.deleteAria', { title: item.title })}
                    disabled={busy}
                    onClick={() => void run(() => api.deleteStarter(item.id))}
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
          aria-label={t('starter.new')}
          placeholder={t('starter.addPlaceholder')}
          dir="auto"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
        />
        <button type="submit" className="button secondary" disabled={busy || !newTitle.trim()}>
          <PlusIcon />{t('common.add')}
        </button>
      </form>
    </section>
  );
}
