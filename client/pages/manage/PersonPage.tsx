import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { countWorkingDays, DEFAULT_CALENDAR, todayLocal, type WorkCalendar } from '../../../shared/calendar';
import { resourceInputSchema, toIssues, type ResourceInput } from '../../../shared/schemas';
import type { ResourceRecord, Side, Specialisation } from '../../../shared/types';
import { AlertIcon, ArrowLeftIcon, PlusIcon, TrashIcon } from '../../icons';
import { api } from '../../api';
import { messagesOf } from '../../errors';
import { useAsync } from '../../useAsync';
import { useWorkload } from '../../useWorkload';
import { SPECIALISATION_LABEL, formatDate } from './labels';
import { PersonWork } from './PersonWork';

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

const workingDaysLabel = (n: number) => `${n} working day${n === 1 ? '' : 's'}`;

/** Leave for one tech-team person: listed, added and removed right away. */
function LeaveCard({ person, onChanged, calendar }: { person: ResourceRecord; onChanged: () => void; calendar: WorkCalendar }) {
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
      setErrors(messagesOf(err));
    }
  }

  async function remove(id: number) {
    try {
      await api.deleteLeave(id);
      setErrors([]);
      onChanged();
    } catch (err) {
      setErrors(messagesOf(err));
    }
  }

  return (
    <section className="card">
      <h2>Leave</h2>
      <p className="muted">Days on leave count as unavailable on the workload heatmap.</p>
      <Errors messages={errors} />
      {person.leave.length === 0 ? (
        <p className="muted">No leave booked.</p>
      ) : (
        <ul className="list-editor">
          {person.leave.map((l) => (
            <li key={l.id} className="list-editor-row">
              <span className="list-editor-name">
                {formatDate(l.start)} → {formatDate(l.end)}{l.note ? ` · ${l.note}` : ''} ·{' '}
                {workingDaysLabel(countWorkingDays(l.start, l.end, calendar))}
              </span>
              <button
                type="button"
                className="button ghost-icon"
                aria-label={`Remove leave from ${formatDate(l.start)}`}
                onClick={() => void remove(l.id)}
              >
                <TrashIcon />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="leave-add" onSubmit={add}>
        <label>Leave from<input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label>Leave to<input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
        <label>Note<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Annual leave" /></label>
        <button type="submit" className="button secondary" disabled={!start || !end}>
          <PlusIcon />Add leave
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

  const existing = isNew ? undefined : people.data?.find((p) => p.id === id);
  const back = <Link to="/manage/resources" className="crumb"><ArrowLeftIcon />Resources</Link>;

  if (!isNew && people.error) {
    return <main className="page">{back}<Errors messages={[people.error.message]} /></main>;
  }
  if (!isNew && !people.data) return <main className="page"><p className="muted">Loading…</p></main>;
  if (!isNew && !existing) return <main className="page">{back}<Errors messages={['Person not found']} /></main>;

  // Until the user changes something, the form shows the saved person (or an empty one).
  const saved = existing ? draftFrom(existing) : EMPTY_PERSON;
  const draft = edited ?? saved;
  const patch = (changes: Partial<PersonDraft>) => setEdited((prev) => ({ ...(prev ?? saved), ...changes }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const input: ResourceInput = { ...draft };
    const parsed = resourceInputSchema.safeParse(input);
    if (!parsed.success) {
      setIssues(toIssues(parsed.error).map((i) => i.message));
      return;
    }
    setIssues([]);
    setSaving(true);
    try {
      if (existing) await api.updateResource(existing.id, input);
      else await api.createResource(input);
      navigate('/manage/resources');
    } catch (err) {
      setIssues(messagesOf(err));
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
      setIssues(messagesOf(err));
    }
  }

  return (
    <main className="page">
      <div className="page-header">
        <div>
          {back}
          <h1>{existing ? existing.name : 'Add person'}</h1>
        </div>
      </div>

      <form onSubmit={onSubmit} noValidate>
        <Errors messages={issues} />
        <section className="card">
          <h2>Details</h2>
          <fieldset className="check-group side-choice">
            <legend>Side</legend>
            <label className="check">
              <input type="radio" name="side" checked={draft.side === 'tech'} onChange={() => patch({ side: 'tech' })} />
              Tech team
            </label>
            <label className="check">
              <input type="radio" name="side" checked={draft.side === 'business'} onChange={() => patch({ side: 'business' })} />
              Business side
            </label>
          </fieldset>
          <div className="form-grid">
            <label>
              Name
              <input value={draft.name} onChange={(e) => patch({ name: e.target.value })} />
            </label>
            {draft.side === 'tech' ? (
              <>
                <label>
                  Role
                  <select
                    value={draft.roleId === null ? '' : String(draft.roleId)}
                    onChange={(e) => patch({ roleId: e.target.value === '' ? null : Number(e.target.value) })}
                  >
                    <option value="">Not set</option>
                    {(lists.data?.role ?? []).map((r) => (
                      <option key={r.id} value={String(r.id)}>{r.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Specialisation
                  <select
                    value={draft.specialisation ?? ''}
                    onChange={(e) => patch({ specialisation: e.target.value === '' ? null : (e.target.value as Specialisation) })}
                  >
                    <option value="">Not set</option>
                    {Object.entries(SPECIALISATION_LABEL).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Capacity (%)
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
              Email
              <input type="email" value={draft.email} onChange={(e) => patch({ email: e.target.value })} />
            </label>
            <label>
              Phone (UAE mobile)
              <input type="tel" value={draft.phone} onChange={(e) => patch({ phone: e.target.value })} placeholder="+971 50 123 4567" />
            </label>
          </div>
          <label className="check active-toggle">
            <input type="checkbox" checked={draft.active} onChange={(e) => patch({ active: e.target.checked })} />
            Active
          </label>
          <p className="muted">
            {draft.side === 'tech'
              ? 'Only active tech-team people can be assigned to phases and appear on the workload heatmap.'
              : 'Business contacts can be chosen as a project’s business project manager. They are not counted in workload.'}
          </p>
        </section>

        <div className="wizard-actions">
          {existing ? (
            <button type="button" className="button danger" onClick={() => void onDelete()}>Delete person</button>
          ) : (
            <Link to="/manage/resources" className="button secondary">Cancel</Link>
          )}
          <button type="submit" className="button" disabled={saving}>
            {saving ? 'Saving…' : existing ? 'Save changes' : 'Add person'}
          </button>
        </div>
      </form>

      {existing && existing.side === 'tech' ? (
        <>
          <PersonWork personId={existing.id} workload={workload} today={todayLocal()} />
          <LeaveCard person={existing} onChanged={() => setVersion((v) => v + 1)} calendar={calendar.data ?? DEFAULT_CALENDAR} />
        </>
      ) : null}
    </main>
  );
}
