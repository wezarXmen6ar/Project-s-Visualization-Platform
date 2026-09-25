import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { todayLocal } from '../../../shared/calendar';
import type { ToDoRecord } from '../../../shared/types';
import { AlertIcon, ArrowLeftIcon } from '../../icons';
import { api } from '../../api';
import { ToDoRow } from '../../components/ToDoRow';
import { messagesOf } from '../../errors';
import { useLang, useT } from '../../i18n/LanguageProvider';
import { phaseName } from '../../i18n/listNames';
import { withNodes } from '../../i18n/withNodes';
import { byUrgency, toDoToInput } from '../../todos';
import { useAsync } from '../../useAsync';
import { useLists } from '../../useLists';
import { useMe } from '../../useMe';

/** All to-dos across every project, filterable by project, assignee, done and a removed-phase flag kept in the URL. */
export function ToDosPage() {
  const t = useT();
  const { lang } = useLang();
  const { lists } = useLists();
  const nameFor = (name: string) => phaseName(name, lists, lang);
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
  const meUnset = assigneeParam === 'me' && me !== undefined && me.resourceId === null;

  const [toggleErrors, setToggleErrors] = useState<string[]>([]);

  async function toggleDone(toDo: ToDoRecord) {
    setToggleErrors([]);
    try {
      await api.updateToDo(toDo.id, toDoToInput(toDo, { done: !toDo.done }));
      setVersion((v) => v + 1);
    } catch (err) {
      setToggleErrors(messagesOf(err, t));
    }
  }

  return (
    <main className="page">
      <Link to="/manage" className="crumb"><ArrowLeftIcon />{t('nav.projects')}</Link>
      <div className="page-header">
        <div>
          <h1>{t('nav.todos')}</h1>
        </div>
      </div>

      {loaded.error ? (
        <div className="errors" role="alert">
          <AlertIcon />
          <span>{messagesOf(loaded.error, t)[0]}</span>
        </div>
      ) : null}

      {toggleErrors.length > 0 ? (
        <div className="errors" role="alert">
          <AlertIcon />
          <ul>{toggleErrors.map((m) => <li key={m}>{m}</li>)}</ul>
        </div>
      ) : null}

      <div className="filters">
        <label>
          {t('todos.project')}
          <select value={projectParam} onChange={(e) => setFilter('project', e.target.value || null)}>
            <option value="">{t('todos.allProjects')}</option>
            {projects.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </label>
        <label>
          {t('todo.assignedTo')}
          <select value={assigneeParam} onChange={(e) => setFilter('assignee', e.target.value || null)}>
            <option value="">{t('todos.anyone')}</option>
            {me && me.resourceId !== null ? <option value="me">{t('todos.mine')}</option> : null}
            <option value="unassigned">{t('todo.unassigned')}</option>
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
          {t('todos.showDone')}
        </label>
        {hasRemoved ? (
          <label className="check">
            <input
              type="checkbox"
              checked={removedParam}
              onChange={(e) => setFilter('removed', e.target.checked ? '1' : null)}
            />
            {t('todos.fromRemoved')}
          </label>
        ) : null}
      </div>

      {noMatches ? (
        meUnset ? (
          <p className="muted">
            {withNodes(t('todos.setWhoYouAre'), { settings: <Link to="/manage/settings">{t('nav.settings')}</Link> })}
          </p>
        ) : (
          <p className="muted">{t('todos.noMatches')}</p>
        )
      ) : (
        <>
          {open.length > 0 ? (
            <ul className="todo-list">
              {open.map((t) => (
                <ToDoRow key={t.id} todo={t} today={today} showProject onToggle={(x) => void toggleDone(x)} nameFor={nameFor} />
              ))}
            </ul>
          ) : null}
          {doneParam && done.length > 0 ? (
            <>
              <h2>{t('todos.done')}</h2>
              <ul className="todo-list">
                {done.map((t) => (
                  <ToDoRow key={t.id} todo={t} today={today} showProject onToggle={(x) => void toggleDone(x)} nameFor={nameFor} />
                ))}
              </ul>
            </>
          ) : null}
        </>
      )}
    </main>
  );
}
