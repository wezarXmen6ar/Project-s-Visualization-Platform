import { useCallback, useEffect, useState } from 'react';
import type { AttachmentRecord, EntryType, ListValue, Me, ProjectRecord, ResourceRecord, ToDoRecord } from '../../../shared/types';
import { api } from '../../api';
import { EntryForm } from '../../components/EntryForm';
import { EntryItem } from '../../components/EntryItem';
import { messagesOf } from '../../errors';
import { AlertIcon } from '../../icons';
import { useT } from '../../i18n/LanguageProvider';
import { useAsync } from '../../useAsync';
import { phaseChoices, type PhaseNameFor } from '../../todos';

interface HistoryTabProps {
  project: ProjectRecord;
  me: Me;
  people: ResourceRecord[];
  /** All the project's to-dos, so a follow-up row can show its own done state. */
  todos: ToDoRecord[];
  toggleDone: (t: ToDoRecord) => void;
  /** Maps a top-level phase's stored name to its display name (e.g. its Arabic name). */
  nameFor?: PhaseNameFor;
  /** For the "Attach files" picker's type default (Meeting Minutes / Other) and its own list editor entry. */
  attachmentTypes: ListValue[];
  /** An entry to scroll to and briefly highlight, e.g. from the Attachments tab's "From" column. */
  highlightEntryId?: number | null;
  /** Called once the highlight has been applied (or the entry couldn't be found), so the caller can clear it. */
  onHighlighted?: () => void;
  /** Bumped by the page when something changed elsewhere (e.g. the phase side panel), so the list loads again. */
  refreshKey?: number;
}

/** The History tab: meetings and updates, filterable by phase, with an inline add/edit form. */
export function HistoryTab({
  project, me, people, todos, toggleDone, nameFor, attachmentTypes, highlightEntryId, onHighlighted, refreshKey = 0,
}: HistoryTabProps) {
  const t = useT();
  const [phaseFilter, setPhaseFilter] = useState<number | null>(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const loaded = useAsync(() => api.listEntries(project.id, phaseFilter ?? undefined), [project.id, phaseFilter, version, refreshKey]);
  const entries = loaded.data ?? [];
  const [highlightedId, setHighlightedId] = useState<number | null>(null);

  // Lands on the entry the "From" column's link pointed to: scrolls it into view and briefly highlights it. If it
  // isn't in the loaded list (deleted, or filtered out by the phase filter), this is a no-op fallback to plain History.
  useEffect(() => {
    if (highlightEntryId == null || loaded.data === undefined) return;
    const found = entries.some((e) => e.id === highlightEntryId);
    if (found) {
      setHighlightedId(highlightEntryId);
      const el = document.getElementById(`entry-${highlightEntryId}`);
      if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'center' });
    }
    onHighlighted?.();
    if (!found) return;
    const timer = setTimeout(() => setHighlightedId(null), 2000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightEntryId, loaded.data]);
  // Every entry's attachments are shown inline, so the whole project's list is loaded once and grouped by entryId.
  const attachmentsLoaded = useAsync(() => api.listAttachments(project.id), [project.id, version, refreshKey]);
  const attachmentsByEntry = new Map<number, AttachmentRecord[]>();
  for (const a of attachmentsLoaded.data ?? []) {
    if (a.entryId === null) continue;
    attachmentsByEntry.set(a.entryId, [...(attachmentsByEntry.get(a.entryId) ?? []), a]);
  }

  const [adding, setAdding] = useState<EntryType | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [actionErrors, setActionErrors] = useState<string[]>([]);

  const phases = phaseChoices(project, nameFor);
  const todoById = new Map(todos.map((x) => [x.id, x]));

  async function deleteEntry(id: number) {
    setActionErrors([]);
    try {
      await api.deleteEntry(id);
      reload();
    } catch (err) {
      setActionErrors(messagesOf(err, t));
    }
  }

  return (
    <section className="card">
      <div className="phase-people-head">
        <h2>{t('tabs.history')}</h2>
        {!adding && editingId === null ? (
          <div className="option-add-actions">
            <button type="button" className="button secondary" onClick={() => setAdding('meeting')}>{t('history.addMeeting')}</button>
            <button type="button" className="button secondary" onClick={() => setAdding('update')}>{t('history.addUpdate')}</button>
          </div>
        ) : null}
      </div>

      <label className="entry-phase-filter">
        {t('history.phaseFilterLabel')}
        <select
          value={phaseFilter === null ? '' : String(phaseFilter)}
          onChange={(e) => setPhaseFilter(e.target.value === '' ? null : Number(e.target.value))}
        >
          <option value="">{t('history.allPhases')}</option>
          {phases.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
        </select>
      </label>

      {actionErrors.length > 0 ? (
        <div className="errors" role="alert">
          <AlertIcon />
          <ul>{actionErrors.map((m) => <li key={m}>{m}</li>)}</ul>
        </div>
      ) : null}

      {adding ? (
        <EntryForm
          project={project}
          me={me}
          people={people}
          type={adding}
          nameFor={nameFor}
          attachmentTypes={attachmentTypes}
          onSave={async (input) => {
            await api.createEntry(project.id, input);
            setAdding(null);
            reload();
          }}
          onCancel={() => setAdding(null)}
        />
      ) : null}

      {entries.length === 0 && !adding ? (
        <p className="muted">{t('history.nothingYet')}</p>
      ) : (
        <ul className="entry-list">
          {entries.map((entry) =>
            editingId === entry.id ? (
              <li key={entry.id} className="entry-editing">
                <EntryForm
                  project={project}
                  me={me}
                  people={people}
                  type={entry.type}
                  initial={entry}
                  nameFor={nameFor}
                  attachmentTypes={attachmentTypes}
                  onSave={async (input) => {
                    await api.updateEntry(entry.id, input);
                    setEditingId(null);
                    reload();
                  }}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            ) : (
              <EntryItem
                key={entry.id}
                entry={entry}
                nameFor={nameFor}
                followUps={entry.followUpToDoIds.map((id) => todoById.get(id)).filter((x): x is ToDoRecord => x !== undefined)}
                onToggleFollowUp={toggleDone}
                attachments={attachmentsByEntry.get(entry.id) ?? []}
                actions={{ onEdit: () => setEditingId(entry.id), onDelete: () => void deleteEntry(entry.id) }}
                highlighted={highlightedId === entry.id}
              />
            ),
          )}
        </ul>
      )}
    </section>
  );
}
