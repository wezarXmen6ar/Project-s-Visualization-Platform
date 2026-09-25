import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { todayLocal } from '../../../shared/calendar';
import type { ToDoRecord } from '../../../shared/types';
import { AlertIcon, ArrowLeftIcon } from '../../icons';
import { api } from '../../api';
import { ToDoRow } from '../../components/ToDoRow';
import { byUrgency, toDoToInput } from '../../todos';
import { useAsync } from '../../useAsync';
import { useMe } from '../../useMe';

/** All to-dos across every project, filterable by project, assignee, done and a removed-phase flag kept in the URL. */
export function ToDosPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { me } = useMe();
  const [version, setVersion] = useState(0);
  const loaded = useAsync(() => api.listToDos({ includeDone: true }), [version]);
  const today = todayLocal();
  const todos = loaded.data ?? [];

  const projectParam = searchParams.get('project') ?? '';
  const assigneeParam = searchParams.get('assignee') ?? '';
  const doneParam = searchParams.get('done') === '1';
  const removedParam = searchParams.get('removed') === '1';

  const hasRemoved = todos.some((t) => t.formerPhase !== null);

  const projects = useMemo(() => {
    const map = new Map<number, string>();
    for (const t of todos) map.set(t.projectId, t.projectName);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [todos]);

  const assignees = useMemo(() => {
    const map = new Map<number, string>();
    for (const t of todos) if (t.assignee) map.set(t.assignee.id, t.assignee.name);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [todos]);

  function setFilter(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams);
    if (value === null || value === '') next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  }

  let filtered = todos;
  if (projectParam) filtered = filtered.filter((t) => String(t.projectId) === projectParam);
  if (assigneeParam === 'me') {
    filtered = me && me.resourceId !== null ? filtered.filter((t) => t.assignee?.id === me.resourceId) : [];
  } else if (assigneeParam === 'unassigned') {
    filtered = filtered.filter((t) => t.assignee === null);
  } else if (assigneeParam) {
    filtered = filtered.filter((t) => t.assignee?.id === Number(assigneeParam));
  }
  if (removedParam) filtered = filtered.filter((t) => t.formerPhase !== null);

  const open = byUrgency(filtered.filter((t) => !t.done));
  const done = [...filtered.filter((t) => t.done)].sort((a, b) => (b.doneDate ?? '').localeCompare(a.doneDate ?? ''));
  const noMatches = open.length === 0 && (!doneParam || done.length === 0);

  async function toggleDone(t: ToDoRecord) {
    await api.updateToDo(t.id, toDoToInput(t, { done: !t.done }));
    setVersion((v) => v + 1);
  }

  return (
    <main className="page">
      <Link to="/manage" className="crumb"><ArrowLeftIcon />Projects</Link>
      <div className="page-header">
        <div>
          <h1>To-dos</h1>
        </div>
      </div>

      {loaded.error ? (
        <div className="errors" role="alert">
          <AlertIcon />
          <span>{loaded.error.message}</span>
        </div>
      ) : null}

      <div className="filters">
        <label>
          Project
          <select value={projectParam} onChange={(e) => setFilter('project', e.target.value || null)}>
            <option value="">All projects</option>
            {projects.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </label>
        <label>
          Assigned to
          <select value={assigneeParam} onChange={(e) => setFilter('assignee', e.target.value || null)}>
            <option value="">Anyone</option>
            {me && me.resourceId !== null ? <option value="me">Mine</option> : null}
            <option value="unassigned">Unassigned</option>
            {assignees.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={doneParam}
            onChange={(e) => setFilter('done', e.target.checked ? '1' : null)}
          />
          Show done
        </label>
        {hasRemoved ? (
          <label className="check">
            <input
              type="checkbox"
              checked={removedParam}
              onChange={(e) => setFilter('removed', e.target.checked ? '1' : null)}
            />
            From removed phases
          </label>
        ) : null}
      </div>

      {noMatches ? (
        <p className="muted">No to-dos match these filters.</p>
      ) : (
        <>
          {open.length > 0 ? (
            <ul className="todo-list">
              {open.map((t) => (
                <ToDoRow key={t.id} todo={t} today={today} showProject onToggle={(x) => void toggleDone(x)} />
              ))}
            </ul>
          ) : null}
          {doneParam && done.length > 0 ? (
            <>
              <h2>Done</h2>
              <ul className="todo-list">
                {done.map((t) => (
                  <ToDoRow key={t.id} todo={t} today={today} showProject onToggle={(x) => void toggleDone(x)} />
                ))}
              </ul>
            </>
          ) : null}
        </>
      )}
    </main>
  );
}
