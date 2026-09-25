import { useState, type FormEvent } from 'react';
import type { ListValue } from '../../../shared/types';
import { AlertIcon, PlusIcon, TrashIcon } from '../../icons';
import { api } from '../../api';
import { useAsync } from '../../useAsync';

interface StarterEditorProps {
  /** The Phases list, in list order. */
  phases: ListValue[];
}

/** Starter to-do checklists kept per Phases-list value: offered, ticked, when a project gets one of these phases. */
export function StarterEditor({ phases }: StarterEditorProps) {
  const [version, setVersion] = useState(0);
  const starters = useAsync(() => api.listStarters(), [version]);
  const reload = () => setVersion((v) => v + 1);

  const [selected, setSelected] = useState<number | null>(null);
  const [editing, setEditing] = useState<{ id: number; title: string } | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const phaseId = selected ?? phases[0]?.id ?? null;
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
      setError(err instanceof Error ? err.message : String(err));
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
      <h2>Starter to-dos</h2>
      <p className="field-hint">Offered, ticked, when a project gets one of these phases. Nothing is added unless you keep it.</p>

      {error ? (
        <div className="errors" role="alert">
          <AlertIcon />
          <span>{error}</span>
        </div>
      ) : null}

      <label>
        Phase
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
                {p.name} ({count})
              </option>
            );
          })}
        </select>
      </label>

      {items.length === 0 ? (
        <p className="muted">No starter to-dos for {phase?.name ?? ''} yet.</p>
      ) : (
        <ul className="list-editor">
          {items.map((item) => (
            <li key={item.id} className="list-editor-row">
              {editing?.id === item.id ? (
                <>
                  <input
                    aria-label={`New title for ${item.title}`}
                    value={editing.title}
                    onChange={(e) => setEditing({ id: item.id, title: e.target.value })}
                  />
                  <button
                    type="button"
                    className="button"
                    disabled={busy || !editing.title.trim()}
                    onClick={() => void run(() => api.renameStarter(item.id, editing.title.trim()), () => setEditing(null))}
                  >
                    Save
                  </button>
                  <button type="button" className="button secondary" onClick={() => setEditing(null)}>Cancel</button>
                </>
              ) : (
                <>
                  <span className="list-editor-name">{item.title}</span>
                  <button
                    type="button"
                    className="button secondary"
                    aria-label={`Rename ${item.title}`}
                    onClick={() => setEditing({ id: item.id, title: item.title })}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="button ghost-icon"
                    aria-label={`Delete starter ${item.title}`}
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
          aria-label="New starter to-do"
          placeholder="Add a starter to-do…"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
        />
        <button type="submit" className="button secondary" disabled={busy || !newTitle.trim()}>
          <PlusIcon />Add
        </button>
      </form>
    </section>
  );
}
