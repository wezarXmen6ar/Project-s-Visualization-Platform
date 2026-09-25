import { Link } from 'react-router';
import { todayLocal } from '../../../shared/calendar';
import type { Me, ToDoRecord } from '../../../shared/types';
import { ToDoMetaLine } from '../../components/ToDoMetaLine';
import { byUrgency } from '../../todos';

interface NextUpProps {
  todos: ToDoRecord[];
  me: Me | undefined;
  onToggleDone: (t: ToDoRecord) => void;
}

/** My open to-dos on this project, most urgent first, at most 3. */
export function NextUp({ todos, me, onToggleDone }: NextUpProps) {
  const today = todayLocal();

  // While "I am" is still loading, `me` is undefined; show only the heading rather than flashing the "not set" prompt.
  if (me === undefined) {
    return (
      <section className="card">
        <h2>Next up</h2>
      </section>
    );
  }

  if (me.resourceId === null) {
    return (
      <section className="card">
        <h2>Next up</h2>
        <p className="muted">
          Set who you are in <Link to="/manage/settings">Settings</Link> to see your next steps here.
        </p>
      </section>
    );
  }

  const mine = byUrgency(todos.filter((t) => !t.done && t.assignee?.id === me.resourceId)).slice(0, 3);

  return (
    <section className="card">
      <h2>Next up</h2>
      {mine.length === 0 ? (
        <p className="muted">Nothing on your list for this project.</p>
      ) : (
        <ul className="todo-list">
          {mine.map((t) => (
            <li key={t.id} className="todo">
              <input
                type="checkbox"
                aria-label={`Done: ${t.title}`}
                checked={false}
                onChange={() => onToggleDone(t)}
              />
              <div>
                <div className="todo-title">{t.title}</div>
                <ToDoMetaLine todo={t} today={today} showAssignee={false} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
