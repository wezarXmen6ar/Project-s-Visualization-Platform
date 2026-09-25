import { useState } from 'react';
import { Link } from 'react-router';
import { todayLocal } from '../../../shared/calendar';
import type { ToDoRecord } from '../../../shared/types';
import { api } from '../../api';
import { AlertIcon } from '../../icons';
import { ToDoRow } from '../../components/ToDoRow';
import { messagesOf } from '../../errors';
import { useLang, useT } from '../../i18n/LanguageProvider';
import { phaseName } from '../../i18n/listNames';
import { withNodes } from '../../i18n/withNodes';
import { byUrgency, toDoToInput } from '../../todos';
import { useAsync } from '../../useAsync';
import { useLists } from '../../useLists';
import { useMe } from '../../useMe';

/** My open to-dos across every project, most urgent first, at most 5. */
export function MyNextSteps() {
  const t = useT();
  const { lang } = useLang();
  const { lists } = useLists();
  const { me } = useMe();
  const [version, setVersion] = useState(0);
  const assigneeId = me?.resourceId ?? null;
  const loaded = useAsync(
    () => (assigneeId !== null ? api.listToDos({ assigneeId }) : Promise.resolve([] as ToDoRecord[])),
    [assigneeId, version],
  );
  const today = todayLocal();
  const [errors, setErrors] = useState<string[]>([]);

  async function toggleDone(toDo: ToDoRecord) {
    setErrors([]);
    try {
      await api.updateToDo(toDo.id, toDoToInput(toDo, { done: !toDo.done }));
      setVersion((v) => v + 1);
    } catch (err) {
      setErrors(messagesOf(err, t));
    }
  }

  // While "I am" is still loading, `me` is undefined; show only the heading rather than flashing the "not set" prompt.
  if (me === undefined) {
    return (
      <section className="card">
        <h2>{t('todo.myNextSteps')}</h2>
      </section>
    );
  }

  if (me.resourceId === null) {
    return (
      <section className="card">
        <h2>{t('todo.myNextSteps')}</h2>
        <p className="muted">
          {withNodes(t('todo.setWhoYouAre'), { settings: <Link to="/manage/settings">{t('nav.settings')}</Link> })}
        </p>
      </section>
    );
  }

  const mine = byUrgency((loaded.data ?? []).filter((x) => !x.done)).slice(0, 5);

  return (
    <section className="card">
      <div className="phase-people-head">
        <h2>{t('todo.myNextSteps')}</h2>
        <Link to="/manage/todos?assignee=me">{t('todo.allTodos')}</Link>
      </div>
      {errors.length > 0 ? (
        <div className="errors" role="alert">
          <AlertIcon />
          <ul>{errors.map((m) => <li key={m}>{m}</li>)}</ul>
        </div>
      ) : null}
      {mine.length === 0 ? (
        <p className="muted">{t('todo.nothingOnList')}</p>
      ) : (
        <ul className="todo-list">
          {mine.map((x) => (
            <ToDoRow
              key={x.id}
              todo={x}
              today={today}
              showProject
              onToggle={(y) => void toggleDone(y)}
              nameFor={(name) => phaseName(name, lists, lang)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
