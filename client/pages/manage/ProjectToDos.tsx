import { useCallback, useState, type ReactNode } from 'react';
import { todayLocal } from '../../../shared/calendar';
import type { Me, ProjectRecord, ToDoRecord } from '../../../shared/types';
import { formatDate } from './labels';
import { ToDoForm } from '../../components/ToDoForm';
import { api } from '../../api';
import { useAsync } from '../../useAsync';
import { byUrgency, dueLabel, toDoToInput } from '../../todos';

/** Loads a project's to-dos (open and done); `reload` fetches them again after a change. */
export function useProjectToDos(projectId: number) {
  const [version, setVersion] = useState(0);
  const loaded = useAsync(() => api.listToDos({ projectId, includeDone: true }), [projectId, version]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { todos: loaded.data ?? [], error: loaded.error, reload };
}

interface ToDoRowMetaProps {
  t: ToDoRecord;
  today: string;
}

function ToDoMeta({ t, today }: ToDoRowMetaProps) {
  const label = dueLabel(t, today);
  const overdue = label.startsWith('Overdue');
  const parts: { key: string; node: ReactNode }[] = [
    { key: 'assignee', node: t.assignee?.name ?? 'Unassigned' },
  ];
  if (label) parts.push({ key: 'due', node: <span className={overdue ? 'overdue' : undefined}>{label}</span> });
  if (t.phase) parts.push({ key: 'phase', node: t.phase.name });
  return (
    <div className="todo-meta">
      {parts.map((p, i) => (
        <span key={p.key}>
          {i > 0 ? ' · ' : ''}
          {p.node}
        </span>
      ))}
    </div>
  );
}

interface ProjectToDosProps {
  project: ProjectRecord;
  me: Me | undefined;
  todos: ToDoRecord[];
  reload: () => void;
}

/** The project's to-dos: add, edit, tick off, and delete, with done ones tucked away by default. */
export function ProjectToDos({ project, me, todos, reload }: ProjectToDosProps) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [showDone, setShowDone] = useState(false);
  const today = todayLocal();
  const meValue: Me = me ?? { resourceId: null, name: null };

  const open = byUrgency(todos.filter((t) => !t.done));
  const done = todos.filter((t) => t.done);

  async function toggleDone(t: ToDoRecord) {
    await api.updateToDo(t.id, toDoToInput(t, { done: !t.done }));
    reload();
  }

  async function deleteToDo(id: number) {
    await api.deleteToDo(id);
    setConfirmingId(null);
    reload();
  }

  return (
    <section className="card">
      <div className="phase-people-head">
        <h2>To-dos</h2>
        {!adding ? (
          <button type="button" className="button secondary" onClick={() => setAdding(true)}>Add to-do</button>
        ) : null}
      </div>

      {adding ? (
        <ToDoForm
          project={project}
          me={meValue}
          onSave={async (input) => {
            await api.createToDo(project.id, input);
            setAdding(false);
            reload();
          }}
          onCancel={() => setAdding(false)}
        />
      ) : null}

      {open.length === 0 ? (
        <p className="muted">Nothing to do yet.</p>
      ) : (
        <ul className="todo-list">
          {open.map((t) =>
            editingId === t.id ? (
              <li key={t.id} className="todo">
                <ToDoForm
                  project={project}
                  me={meValue}
                  initial={t}
                  onSave={async (input) => {
                    await api.updateToDo(t.id, input);
                    setEditingId(null);
                    reload();
                  }}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            ) : (
              <li key={t.id} className="todo">
                <input type="checkbox" aria-label={`Done: ${t.title}`} checked={false} onChange={() => void toggleDone(t)} />
                <div>
                  <div className="todo-title">{t.title}</div>
                  <ToDoMeta t={t} today={today} />
                  {t.note ? <div className="todo-note">{t.note}</div> : null}
                </div>
                {confirmingId === t.id ? (
                  <div className="option-add-actions">
                    <span>Delete this to-do?</span>
                    <button type="button" className="button danger" onClick={() => void deleteToDo(t.id)}>Delete</button>
                    <button type="button" className="button secondary" onClick={() => setConfirmingId(null)}>Keep</button>
                  </div>
                ) : (
                  <div className="option-add-actions">
                    <button type="button" className="button secondary" aria-label={`Edit ${t.title}`} onClick={() => setEditingId(t.id)}>
                      Edit
                    </button>
                    <button type="button" className="button secondary" aria-label={`Delete ${t.title}`} onClick={() => setConfirmingId(t.id)}>
                      Delete
                    </button>
                  </div>
                )}
              </li>
            ),
          )}
        </ul>
      )}

      {done.length > 0 ? (
        <button type="button" className="button secondary" onClick={() => setShowDone((v) => !v)}>
          {showDone ? 'Hide done' : `Show ${done.length} done`}
        </button>
      ) : null}

      {showDone && done.length > 0 ? (
        <ul className="todo-list">
          {done.map((t) => (
            <li key={t.id} className="todo done">
              <input type="checkbox" aria-label={`Done: ${t.title}`} checked onChange={() => void toggleDone(t)} />
              <div>
                <div className="todo-title">{t.title}</div>
                <div className="todo-meta">{t.doneDate ? `Done ${formatDate(t.doneDate)}` : ''}</div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
