import { useState, type FormEvent } from 'react';
import type { ListName, ListValue } from '../../../shared/types';
import { AlertIcon, PlusIcon, TrashIcon } from '../../icons';
import { api } from '../../api';
import { messagesOf } from '../../errors';
import { useT } from '../../i18n/LanguageProvider';

interface ListEditorProps {
  title: string;
  /** Singular name used in labels, e.g. "Goal" → "New goal", "Add goal". */
  singular: string;
  list: ListName;
  values: ListValue[];
  /** Called after every successful change, so the page can reload the lists. */
  onChanged: () => void;
}

/** Add, rename and delete the values of one dropdown list. */
export function ListEditor({ title, singular, list, values, onChanged }: ListEditorProps) {
  const t = useT();
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<{ id: number; name: string; nameAr: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lower = singular.toLowerCase();

  async function run(action: () => Promise<unknown>, afterSuccess?: () => void) {
    setBusy(true);
    setError(null);
    try {
      await action();
      afterSuccess?.();
      onChanged();
    } catch (err) {
      setError(messagesOf(err, t)[0]);
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
        <p className="muted">Nothing here yet.</p>
      ) : (
        <ul className="list-editor">
          {values.map((v) => (
            <li key={v.id} className="list-editor-row">
              {editing?.id === v.id ? (
                <>
                  <input
                    aria-label={`New name for ${v.name}`}
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  />
                  <input
                    aria-label={`New Arabic name for ${v.name}`}
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
                    Save
                  </button>
                  <button type="button" className="button secondary" onClick={() => setEditing(null)}>Cancel</button>
                </>
              ) : (
                <>
                  <span className="list-editor-name">{v.name}</span>
                  {v.nameAr ? <span className="list-editor-name-ar" dir="rtl">{v.nameAr}</span> : null}
                  <button
                    type="button"
                    className="button secondary"
                    aria-label={`Rename ${v.name}`}
                    onClick={() => setEditing({ id: v.id, name: v.name, nameAr: v.nameAr ?? '' })}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="button ghost-icon"
                    aria-label={`Delete ${v.name}`}
                    disabled={busy}
                    onClick={() => void run(() => api.deleteListValue(list, v.id))}
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
        <input aria-label={`New ${lower}`} placeholder={`Add a ${lower}…`} value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button type="submit" className="button secondary" disabled={busy || !newName.trim()}>
          <PlusIcon />Add {lower}
        </button>
      </form>
    </section>
  );
}
