import { useState, type FormEvent } from 'react';
import { toDoInputSchema, toIssues, type ToDoInput } from '../../shared/schemas';
import type { Me, ProjectRecord, ToDoRecord } from '../../shared/types';
import { AlertIcon } from '../icons';
import { messageFor, messagesOf } from '../errors';
import { useLang, useT } from '../i18n/LanguageProvider';
import { assigneeChoices, phaseChoices, toDoToInput, type PhaseNameFor } from '../todos';

interface ToDoFormProps {
  project: ProjectRecord;
  me: Me;
  /** The to-do being edited, or undefined for a new one. */
  initial?: ToDoRecord;
  onSave: (input: ToDoInput) => Promise<void>;
  onCancel: () => void;
  /** Maps a top-level phase's stored name to its display name (e.g. its Arabic name), for the Phase choices. */
  nameFor?: PhaseNameFor;
}

/** Add or edit a to-do: title, assignee, due date, phase and note. */
export function ToDoForm({ project, me, initial, onSave, onCancel, nameFor }: ToDoFormProps) {
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
  const { lang } = useLang();

  const choices = assigneeChoices(project, me, initial?.assignee ?? null, lang);
  const phases = phaseChoices(project, nameFor);

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
        {t('todo.fieldTitle')}
        <input value={title} onChange={(e) => setTitle(e.target.value)} dir="auto" data-user-content="" />
      </label>
      <label>
        {t('todo.assignedTo')}
        <select
          value={assigneeId === null ? '' : String(assigneeId)}
          onChange={(e) => setAssigneeId(e.target.value === '' ? null : Number(e.target.value))}
        >
          <option value="">{t('todo.unassigned')}</option>
          {choices.me ? <option value={String(choices.me.id)}>{t('todo.me', { name: choices.me.name })}</option> : null}
          {choices.managers.length > 0 ? (
            <optgroup label={t('todo.projectManagers')}>
              {choices.managers.map((m) => <option key={m.id} value={String(m.id)}>{m.label}</option>)}
            </optgroup>
          ) : null}
          {choices.team.length > 0 ? (
            <optgroup label={t('todo.team')}>
              {choices.team.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
            </optgroup>
          ) : null}
          {choices.former ? (
            <option value={String(choices.former.id)}>{t('todo.formerAssignee', { name: choices.former.name })}</option>
          ) : null}
        </select>
      </label>
      <label>
        {t('todo.dueField')}
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </label>
      <label>
        {t('todo.phaseField')}
        <select value={phaseId === null ? '' : String(phaseId)} onChange={(e) => setPhaseId(e.target.value === '' ? null : Number(e.target.value))}>
          <option value="">{t('todo.wholeProject')}</option>
          {phases.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
        </select>
      </label>
      <label>
        {t('todo.note')}
        <textarea value={note} onChange={(e) => setNote(e.target.value)} dir="auto" data-user-content="" />
      </label>
      <div className="option-add-actions">
        <button type="submit" className="button" disabled={saving}>{t('todo.save')}</button>
        <button type="button" className="button secondary" onClick={onCancel}>{t('common.cancel')}</button>
      </div>
    </form>
  );
}
