import { Link } from 'react-router';
import { todayLocal } from '../../../shared/calendar';
import type { Me, ToDoRecord } from '../../../shared/types';
import { ToDoMetaLine } from '../../components/ToDoMetaLine';
import { useT } from '../../i18n/LanguageProvider';
import { withNodes } from '../../i18n/withNodes';
import { byUrgency, type PhaseNameFor } from '../../todos';

interface NextUpProps {
  todos: ToDoRecord[];
  me: Me | undefined;
  onToggleDone: (t: ToDoRecord) => void;
  /** Maps a top-level phase's stored name to its display name (e.g. its Arabic name). */
  nameFor?: PhaseNameFor;
}

/** My open to-dos on this project, most urgent first, at most 3. */
export function NextUp({ todos, me, onToggleDone, nameFor }: NextUpProps) {
  const t = useT();
  const today = todayLocal();

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

  const mine = byUrgency(todos.filter((x) => !x.done && x.assignee?.id === me.resourceId)).slice(0, 3);

  return (
    <section className="card">
      <h2>{t('todo.myNextSteps')}</h2>
      {mine.length === 0 ? (
        <p className="muted">{t('todo.nothingOnListProject')}</p>
      ) : (
        <ul className="todo-list">
          {mine.map((x) => (
            <li key={x.id} className="todo">
              <input
                type="checkbox"
                aria-label={t('todo.doneAria', { title: x.title })}
                checked={false}
                onChange={() => onToggleDone(x)}
              />
              <div>
                <div className="todo-title" dir="auto" data-user-content="">{x.title}</div>
                <ToDoMetaLine todo={x} today={today} showAssignee={false} nameFor={nameFor} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
