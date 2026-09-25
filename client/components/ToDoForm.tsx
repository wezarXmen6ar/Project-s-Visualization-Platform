import { useState, type FormEvent } from 'react';
import { toDoInputSchema, toIssues, type ToDoInput } from '../../shared/schemas';
import type { Me, ProjectRecord, ToDoRecord } from '../../shared/types';
import { AlertIcon } from '../icons';
import { messageFor, messagesOf } from '../errors';
import { useT } from '../i18n/LanguageProvider';
import { assigneeChoices, phaseChoices, toDoToInput } from '../todos';

interface ToDoFormProps {
  project: ProjectRecord;
  me: Me;
  /** The to-do being edited, or undefined for a new one. */
  initial?: ToDoRecord;
  onSave: (input: ToDoInput) => Promise<void>;
  onCancel: () => void;
}

/** Add or edit a to-do: title, assignee, due date, phase and note. */
export function ToDoForm({ project, me, initial, onSave, onCancel }: ToDoFormProps) {
  const defaults: ToDoInput = initial
    ? toDoToInput(initial)
    : { title: '', note: null, assigneeId: me.resourceId, dueDate: null, phaseId: null, done: false };

  const [title, setTitle] = useState(defaults.title);
  const [assigneeId, setAssigneeId] = useState<number | null>(defaults.assigneeId ?? null);
  const [dueDate, setDueDate] = useState(defaults.dueDate ?? '');
  const [phaseId, setPhaseId] = useState<number | null>(defaults.phaseId ?? null);
  const [note, setNote] = useState(defaults.note ?? '');
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const t = useT();

  const choices = assigneeChoices(project, me, initial?.assignee ?? null);
  const phases = phaseChoices(project);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const input = {
      title,
      note: note.trim() === '' ? null : note,
      assigneeId,
      dueDate: dueDate === '' ? null : dueDate,
      phaseId,
      done: defaults.done,
    };
    const parsed = toDoInputSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(toIssues(parsed.error).map((i) => messageFor(t, i)));
      return;
    }
    setSaving(true);
    setErrors([]);
    try {
      await onSave(parsed.data);
    } catch (err) {
      setErrors(messagesOf(err, t));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="todo-form" onSubmit={submit} noValidate>
      {errors.length > 0 ? (
        <div className="errors" role="alert">
          <AlertIcon />
          <ul>{errors.map((m) => <li key={m}>{m}</li>)}</ul>
        </div>
      ) : null}
      <label>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label>
        Assigned to
        <select
          value={assigneeId === null ? '' : String(assigneeId)}
          onChange={(e) => setAssigneeId(e.target.value === '' ? null : Number(e.target.value))}
        >
          <option value="">Unassigned</option>
          {choices.me ? <option value={String(choices.me.id)}>{`Me — ${choices.me.name}`}</option> : null}
          {choices.managers.length > 0 ? (
            <optgroup label="Project managers">
              {choices.managers.map((m) => <option key={m.id} value={String(m.id)}>{m.label}</option>)}
            </optgroup>
          ) : null}
          {choices.team.length > 0 ? (
            <optgroup label="Team on this project">
              {choices.team.map((t) => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
            </optgroup>
          ) : null}
          {choices.former ? <option value={String(choices.former.id)}>{`${choices.former.name} (no longer on this project)`}</option> : null}
        </select>
      </label>
      <label>
        Due
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </label>
      <label>
        Phase
        <select value={phaseId === null ? '' : String(phaseId)} onChange={(e) => setPhaseId(e.target.value === '' ? null : Number(e.target.value))}>
          <option value="">Whole project</option>
          {phases.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
        </select>
      </label>
      <label>
        Note
        <textarea value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className="option-add-actions">
        <button type="submit" className="button" disabled={saving}>Save to-do</button>
        <button type="button" className="button secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
