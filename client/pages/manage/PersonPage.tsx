import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { countWorkingDays, DEFAULT_CALENDAR, todayLocal, type WorkCalendar } from '../../../shared/calendar';
import { resourceInputSchema, toIssues, type ResourceInput } from '../../../shared/schemas';
import type { ResourceRecord, Side, Specialisation, ToDoRecord } from '../../../shared/types';
import { AlertIcon, ArrowLeftIcon, PlusIcon, TrashIcon } from '../../icons';
import { api } from '../../api';
import { ToDoRow } from '../../components/ToDoRow';
import { messageFor, messagesOf } from '../../errors';
import { formatDate } from '../../i18n/format';
import { useLang, useT } from '../../i18n/LanguageProvider';
import { listName, phaseName } from '../../i18n/listNames';
import { byUrgency, toDoToInput, type PhaseNameFor } from '../../todos';
import { useAsync } from '../../useAsync';
import { useWorkload } from '../../useWorkload';
import { SIDE_KEY, SPECIALISATION_KEY } from './labels';
import { PersonWork } from './PersonWork';

/** A person's open to-dos across every project. */
function PersonToDos({
  todos, today, onToggle, errors = [], nameFor,
}: { todos: ToDoRecord[]; today: string; onToggle: (t: ToDoRecord) => void; errors?: string[]; nameFor?: PhaseNameFor }) {
  const t = useT();
  const open = byUrgency(todos.filter((x) => !x.done));
  return (
    <section className="card">
      <h2>{t('nav.todos')}</h2>
      {errors.length > 0 ? <Errors messages={errors} /> : null}
      {open.length === 0 ? (
        <p className="muted">{t('person.noOpenToDos')}</p>
      ) : (
        <ul className="todo-list">
          {open.map((x) => (
            <ToDoRow key={x.id} todo={x} today={today} showProject onToggle={onToggle} nameFor={nameFor} />
          ))}
        </ul>
      )}
    </section>
  );
}

interface PersonDraft {
  name: string;
  side: Side;
  roleId: number | null;
  specialisation: Specialisation | null;
  capacity: number;
  email: string;
  phone: string;
  active: boolean;
}

const EMPTY_PERSON: PersonDraft = {
  name: '', side: 'tech', roleId: null, specialisation: null, capacity: 100, email: '', phone: '', active: true,
};

function draftFrom(p: ResourceRecord): PersonDraft {
  return {
    name: p.name,
    side: p.side,
    roleId: p.role?.id ?? null,
    specialisation: p.specialisation,
    capacity: p.capacity,
    email: p.email ?? '',
    phone: p.phone ?? '',
    active: p.active,
  };
}

function Errors({ messages }: { messages: string[] }) {
  if (messages.length === 0) return null;
  return (
    <div className="errors" role="alert">
      <AlertIcon />
      <ul>{messages.map((m) => <li key={m}>{m}</li>)}</ul>
    </div>
  );
}

/** Leave for one tech-team person: listed, added and removed right away. */
function LeaveCard({ person, onChanged, calendar }: { person: ResourceRecord; onChanged: () => void; calendar: WorkCalendar }) {
  const t = useT();
  const { lang } = useLang();
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      await api.addLeave(person.id, { start, end, note });
      setStart('');
      setEnd('');
      setNote('');
      setErrors([]);
      onChanged();
    } catch (err) {
      setErrors(messagesOf(err, t));
    }
  }

  async function remove(id: number) {
    try {
      await api.deleteLeave(id);
      setErrors([]);
      onChanged();
    } catch (err) {
      setErrors(messagesOf(err, t));
    }
  }

  return (
    <section className="card">
      <h2>{t('person.leave')}</h2>
      <p className="muted">{t('person.leaveHint')}</p>
      <Errors messages={errors} />
      {person.leave.length === 0 ? (
        <p className="muted">{t('person.noLeave')}</p>
      ) : (
        <ul className="list-editor">
          {person.leave.map((l) => (
            <li key={l.id} className="list-editor-row">
              <span className="list-editor-name">
                {t('person.leaveRange', { start: formatDate(lang, l.start), end: formatDate(lang, l.end) })}
                {l.note ? <> · <span dir="auto" data-user-content="">{l.note}</span></> : ''} ·{' '}
                {t('person.workingDays', { count: countWorkingDays(l.start, l.end, calendar) })}
              </span>
              <button
                type="button"
                className="button ghost-icon"
                aria-label={t('person.removeLeave', { date: formatDate(lang, l.start) })}
                onClick={() => void remove(l.id)}
              >
                <TrashIcon />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="leave-add" onSubmit={add}>
        <label>{t('person.leaveFrom')}<input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label>{t('person.leaveTo')}<input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
        <label>
          {t('person.note')}
          <input dir="auto" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('person.notePlaceholder')} />
        </label>
        <button type="submit" className="button secondary" disabled={!start || !end}>
          <PlusIcon />{t('person.addLeave')}
        </button>
      </form>
    </section>
  );
}

export function PersonPage() {
  const params = useParams();
  const isNew = params.id === undefined;
  const id = Number(params.id);
  const navigate = useNavigate();
  const [version, setVersion] = useState(0);
  const people = useAsync(() => api.listResources(), [version]);
  const lists = useAsync(() => api.getLists(), []);
  const calendar = useAsync(() => api.getCalendar(), []);
  const { workload } = useWorkload();
  const [edited, setEdited] = useState<PersonDraft | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [todosVersion, setTodosVersion] = useState(0);
  const todosLoaded = useAsync(
    () => (isNew ? Promise.resolve([] as ToDoRecord[]) : api.listToDos({ assigneeId: id })),
    [isNew, id, todosVersion],
  );
  const todos = todosLoaded.data ?? [];
  const [todoErrors, setTodoErrors] = useState<string[]>([]);
  const t = useT();
  const { lang } = useLang();
  const nameFor = (name: string) => (lists.data ? phaseName(name, lists.data, lang) : name);
  async function toggleToDo(toDo: ToDoRecord) {
    setTodoErrors([]);
    try {
      await api.updateToDo(toDo.id, toDoToInput(toDo, { done: !toDo.done }));
      setTodosVersion((v) => v + 1);
    } catch (err) {
      setTodoErrors(messagesOf(err, t));
    }
  }

  const existing = isNew ? undefined : people.data?.find((p) => p.id === id);
  const back = <Link to="/manage/resources" className="crumb"><ArrowLeftIcon />{t('nav.resources')}</Link>;

  if (!isNew && people.error) {
    return <main className="page">{back}<Errors messages={messagesOf(people.error, t)} /></main>;
  }
  if (!isNew && !people.data) return <main className="page"><p className="muted">{t('common.loading')}</p></main>;
  if (!isNew && !existing) return <main className="page">{back}<Errors messages={[t('error.personNotFound')]} /></main>;

  // Until the user changes something, the form shows the saved person (or an empty one).
  const saved = existing ? draftFrom(existing) : EMPTY_PERSON;
  const draft = edited ?? saved;
  const patch = (changes: Partial<PersonDraft>) => setEdited((prev) => ({ ...(prev ?? saved), ...changes }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const input: ResourceInput = { ...draft };
    const parsed = resourceInputSchema.safeParse(input);
    if (!parsed.success) {
      setIssues(toIssues(parsed.error).map((i) => messageFor(t, i)));
      return;
    }
    setIssues([]);
    setSaving(true);
    try {
      if (existing) await api.updateResource(existing.id, input);
      else await api.createResource(input);
      navigate('/manage/resources');
    } catch (err) {
      setIssues(messagesOf(err, t));
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!existing) return;
    try {
      await api.deleteResource(existing.id);
      navigate('/manage/resources');
    } catch (err) {
      setIssues(messagesOf(err, t));
    }
  }

  return (
    <main className="page">
      <div className="page-header">
        <div>
          {back}
          {existing ? <h1 dir="auto" data-user-content="">{existing.name}</h1> : <h1>{t('resources.addPerson')}</h1>}
        </div>
      </div>

      <form onSubmit={onSubmit} noValidate>
        <Errors messages={issues} />
        <section className="card">
          <h2>{t('project.details')}</h2>
          <fieldset className="check-group side-choice">
            <legend>{t('resources.side')}</legend>
            <label className="check">
              <input type="radio" name="side" checked={draft.side === 'tech'} onChange={() => patch({ side: 'tech' })} />
              {t(SIDE_KEY.tech)}
            </label>
            <label className="check">
              <input type="radio" name="side" checked={draft.side === 'business'} onChange={() => patch({ side: 'business' })} />
              {t(SIDE_KEY.business)}
            </label>
          </fieldset>
          <div className="form-grid">
            <label>
              {t('person.name')}
              <input dir="auto" value={draft.name} onChange={(e) => patch({ name: e.target.value })} />
            </label>
            {draft.side === 'tech' ? (
              <>
                <label>
                  {t('resources.role')}
                  <select
                    value={draft.roleId === null ? '' : String(draft.roleId)}
                    onChange={(e) => patch({ roleId: e.target.value === '' ? null : Number(e.target.value) })}
                  >
                    <option value="">{t('common.notSet')}</option>
                    {(lists.data?.role ?? []).map((r) => (
                      <option key={r.id} value={String(r.id)}>{listName(r, lang)}</option>
                    ))}
                  </select>
                </label>
                <label>
                  {t('person.specialisation')}
                  <select
                    value={draft.specialisation ?? ''}
                    onChange={(e) => patch({ specialisation: e.target.value === '' ? null : (e.target.value as Specialisation) })}
                  >
                    <option value="">{t('common.notSet')}</option>
                    {Object.entries(SPECIALISATION_KEY).map(([key, label]) => (
                      <option key={key} value={key}>{t(label)}</option>
                    ))}
                  </select>
                </label>
                <label>
                  {t('person.capacity')}
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={Number.isNaN(draft.capacity) ? '' : draft.capacity}
                    onChange={(e) => patch({ capacity: e.target.valueAsNumber })}
                  />
                </label>
              </>
            ) : null}
            <label>
              {t('person.email')}
              <input type="email" dir="ltr" value={draft.email} onChange={(e) => patch({ email: e.target.value })} />
            </label>
            <label>
              {t('person.phone')}
              <input type="tel" dir="ltr" value={draft.phone} onChange={(e) => patch({ phone: e.target.value })} placeholder="+971 50 123 4567" />
            </label>
          </div>
          <label className="check active-toggle">
            <input type="checkbox" checked={draft.active} onChange={(e) => patch({ active: e.target.checked })} />
            {t('person.active')}
          </label>
          <p className="muted">{draft.side === 'tech' ? t('person.techHint') : t('person.businessHint')}</p>
        </section>

        <div className="wizard-actions">
          {existing ? (
            <button type="button" className="button danger" onClick={() => void onDelete()}>{t('person.delete')}</button>
          ) : (
            <Link to="/manage/resources" className="button secondary">{t('common.cancel')}</Link>
          )}
          <button type="submit" className="button" disabled={saving}>
            {saving ? t('common.saving') : existing ? t('edit.saveChanges') : t('resources.addPerson')}
          </button>
        </div>
      </form>

      {existing && existing.side === 'tech' ? (
        <>
          <PersonWork personId={existing.id} workload={workload} today={todayLocal()} todos={todos} nameFor={nameFor} />
          <PersonToDos todos={todos} today={todayLocal()} onToggle={(x) => void toggleToDo(x)} errors={todoErrors} nameFor={nameFor} />
          <LeaveCard person={existing} onChanged={() => setVersion((v) => v + 1)} calendar={calendar.data ?? DEFAULT_CALENDAR} />
        </>
      ) : null}

      {existing && existing.side !== 'tech' ? (
        <PersonToDos todos={todos} today={todayLocal()} onToggle={(x) => void toggleToDo(x)} errors={todoErrors} nameFor={nameFor} />
      ) : null}
    </main>
  );
}
