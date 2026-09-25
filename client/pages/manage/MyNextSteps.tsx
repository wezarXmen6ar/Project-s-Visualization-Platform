import { useState } from 'react';
import { Link } from 'react-router';
import { todayLocal } from '../../../shared/calendar';
import type { ToDoRecord } from '../../../shared/types';
import { api } from '../../api';
import { AlertIcon } from '../../icons';
import { ToDoRow } from '../../components/ToDoRow';
import { messagesOf } from '../../errors';
import { byUrgency, toDoToInput } from '../../todos';
import { useAsync } from '../../useAsync';
import { useMe } from '../../useMe';

/** My open to-dos across every project, most urgent first, at most 5. */
export function MyNextSteps() {
  const { me } = useMe();
  const [version, setVersion] = useState(0);
  const assigneeId = me?.resourceId ?? null;
  const loaded = useAsync(
    () => (assigneeId !== null ? api.listToDos({ assigneeId }) : Promise.resolve([] as ToDoRecord[])),
    [assigneeId, version],
  );
  const today = todayLocal();
  const [errors, setErrors] = useState<string[]>([]);

  async function toggleDone(t: ToDoRecord) {
    setErrors([]);
    try {
      await api.updateToDo(t.id, toDoToInput(t, { done: !t.done }));
      setVersion((v) => v + 1);
    } catch (err) {
      setErrors(messagesOf(err));
    }
  }

  // While "I am" is still loading, `me` is undefined; show only the heading rather than flashing the "not set" prompt.
  if (me === undefined) {
    return (
      <section className="card">
        <h2>My next steps</h2>
      </section>
    );
  }

  if (me.resourceId === null) {
    return (
      <section className="card">
        <h2>My next steps</h2>
        <p className="muted">
          Set who you are in <Link to="/manage/settings">Settings</Link> to see your next steps here.
        </p>
      </section>
    );
  }

  const mine = byUrgency((loaded.data ?? []).filter((t) => !t.done)).slice(0, 5);

  return (
    <section className="card">
      <div className="phase-people-head">
        <h2>My next steps</h2>
        <Link to="/manage/todos?assignee=me">All to-dos</Link>
      </div>
      {errors.length > 0 ? (
        <div className="errors" role="alert">
          <AlertIcon />
          <ul>{errors.map((m) => <li key={m}>{m}</li>)}</ul>
        </div>
      ) : null}
      {mine.length === 0 ? (
        <p className="muted">Nothing on your list. Nice.</p>
      ) : (
        <ul className="todo-list">
          {mine.map((t) => (
            <ToDoRow key={t.id} todo={t} today={today} showProject onToggle={(x) => void toggleDone(x)} />
          ))}
        </ul>
      )}
    </section>
  );
}
