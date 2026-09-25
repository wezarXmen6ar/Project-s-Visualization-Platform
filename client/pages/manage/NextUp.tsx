import { Link } from 'react-router';
import { todayLocal } from '../../../shared/calendar';
import type { Me, ToDoRecord } from '../../../shared/types';
import { byUrgency, dueLabel, formerPhaseLabel } from '../../todos';

interface NextUpProps {
  todos: ToDoRecord[];
  me: Me | undefined;
  onToggleDone: (t: ToDoRecord) => void;
}

/** My open to-dos on this project, most urgent first, at most 3. */
export function NextUp({ todos, me, onToggleDone }: NextUpProps) {
  const today = todayLocal();

  if (!me || me.resourceId === null) {
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
          {mine.map((t) => {
            const label = dueLabel(t, today);
            const overdue = label.startsWith('Overdue');
            const former = formerPhaseLabel(t);
            return (
              <li key={t.id} className="todo">
                <input
                  type="checkbox"
                  aria-label={`Done: ${t.title}`}
                  checked={false}
                  onChange={() => onToggleDone(t)}
                />
                <div>
                  <div className="todo-title">{t.title}</div>
                  <div className="todo-meta">
                    {label ? <span className={overdue ? 'overdue' : undefined}>{label}</span> : null}
                    {label && t.phase ? ' · ' : ''}
                    {t.phase ? t.phase.name : ''}
                  </div>
                  {former ? <div className="todo-meta">{former}</div> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
