import { useCallback, useState } from 'react';
import { todayLocal } from '../../../shared/calendar';
import type { Me, ProjectRecord, ToDoRecord } from '../../../shared/types';
import { dayDate } from '../../overloads';
import { ToDoForm } from '../../components/ToDoForm';
import { ToDoMetaLine } from '../../components/ToDoMetaLine';
import { api } from '../../api';
import { messagesOf } from '../../errors';
import { useLang, useT } from '../../i18n/LanguageProvider';
import { AlertIcon } from '../../icons';
import { useAsync } from '../../useAsync';
import { byUrgency, toDoToInput, type PhaseNameFor } from '../../todos';

/** Loads a project's to-dos (open and done); `reload` fetches them again after a change. */
export function useProjectToDos(projectId: number) {
  const t = useT();
  const [version, setVersion] = useState(0);
  const loaded = useAsync(() => api.listToDos({ projectId, includeDone: true }), [projectId, version]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const [toggleErrors, setToggleErrors] = useState<string[]>([]);
  const toggleDone = useCallback(
    async (toDo: ToDoRecord) => {
      setToggleErrors([]);
      try {
        await api.updateToDo(toDo.id, toDoToInput(toDo, { done: !toDo.done }));
        reload();
      } catch (err) {
        setToggleErrors(messagesOf(err, t));
      }
    },
    [reload, t],
  );
  return { todos: loaded.data ?? [], error: loaded.error, reload, toggleDone, toggleErrors };
}

interface ProjectToDosProps {
  project: ProjectRecord;
  me: Me | undefined;
  todos: ToDoRecord[];
  reload: () => void;
  toggleDone: (t: ToDoRecord) => void;
  toggleErrors?: string[];
  /** Maps a top-level phase's stored name to its display name (e.g. its Arabic name). */
  nameFor?: PhaseNameFor;
}

/** The project's to-dos: add, edit, tick off, and delete, with done ones tucked away by default. */
export function ProjectToDos({ project, me, todos, reload, toggleDone, toggleErrors = [], nameFor }: ProjectToDosProps) {
  const t = useT();
  const { lang } = useLang();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [showDone, setShowDone] = useState(false);
  const today = todayLocal();
  const meValue: Me = me ?? { resourceId: null, name: null };

  const open = byUrgency(todos.filter((x) => !x.done));
  const done = todos.filter((x) => x.done);

  async function deleteToDo(id: number) {
    await api.deleteToDo(id);
    setConfirmingId(null);
    reload();
  }

  return (
    <section className="card">
      <div className="phase-people-head">
        <h2>{t('nav.todos')}</h2>
        {!adding ? (
          <button type="button" className="button secondary" onClick={() => setAdding(true)}>{t('todo.add')}</button>
        ) : null}
      </div>

      {toggleErrors.length > 0 ? (
        <div className="errors" role="alert">
          <AlertIcon />
          <ul>{toggleErrors.map((m) => <li key={m}>{m}</li>)}</ul>
        </div>
      ) : null}

      {adding ? (
        <ToDoForm
          project={project}
          me={meValue}
          nameFor={nameFor}
          onSave={async (input) => {
            await api.createToDo(project.id, input);
            setAdding(false);
            reload();
          }}
          onCancel={() => setAdding(false)}
        />
      ) : null}

      {open.length === 0 ? (
        <p className="muted">{t('todo.nothingYet')}</p>
      ) : (
        <ul className="todo-list">
          {open.map((x) =>
            editingId === x.id ? (
              <li key={x.id} className="todo-editing">
                <ToDoForm
                  project={project}
                  me={meValue}
                  initial={x}
                  nameFor={nameFor}
                  onSave={async (input) => {
                    await api.updateToDo(x.id, input);
                    setEditingId(null);
                    reload();
                  }}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            ) : (
              <li key={x.id} className="todo">
                <input
                  type="checkbox"
                  aria-label={t('todo.doneAria', { title: x.title })}
                  checked={false}
                  onChange={() => void toggleDone(x)}
                />
                <div>
                  <div className="todo-title" dir="auto" data-user-content="">{x.title}</div>
                  <ToDoMetaLine todo={x} today={today} nameFor={nameFor} />
                  {x.note ? <div className="todo-note" dir="auto" data-user-content="">{x.note}</div> : null}
                </div>
                {confirmingId === x.id ? (
                  <div className="option-add-actions">
                    <span>{t('todo.confirmDelete')}</span>
                    <button type="button" className="button danger" onClick={() => void deleteToDo(x.id)}>{t('common.delete')}</button>
                    <button type="button" className="button secondary" onClick={() => setConfirmingId(null)}>{t('common.keep')}</button>
                  </div>
                ) : (
                  <div className="option-add-actions">
                    <button
                      type="button"
                      className="button secondary"
                      aria-label={t('todo.editAria', { title: x.title })}
                      onClick={() => setEditingId(x.id)}
                    >
                      {t('common.edit')}
                    </button>
                    <button
                      type="button"
                      className="button secondary"
                      aria-label={t('todo.deleteAria', { title: x.title })}
                      onClick={() => setConfirmingId(x.id)}
                    >
                      {t('common.delete')}
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
          {showDone ? t('todo.hideDone') : t('todo.showDone', { count: done.length })}
        </button>
      ) : null}

      {showDone && done.length > 0 ? (
        <ul className="todo-list">
          {done.map((x) => (
            <li key={x.id} className="todo done">
              <input type="checkbox" aria-label={t('todo.doneAria', { title: x.title })} checked onChange={() => void toggleDone(x)} />
              <div>
                <div className="todo-title" dir="auto" data-user-content="">{x.title}</div>
                <div className="todo-meta">{x.doneDate ? t('todo.doneOn', { date: dayDate(x.doneDate, lang) }) : ''}</div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
