import { useState, type FormEvent } from 'react';
import { todayLocal } from '../../shared/calendar';
import { entryInputSchema, toIssues, type EntryInput } from '../../shared/schemas';
import type { AttachmentRecord, EntryRecord, EntryType, ListValue, Me, ProjectRecord, ResourceRecord } from '../../shared/types';
import { api } from '../api';
import { attendeeChoices, entryToInput } from '../entries';
import { AlertIcon } from '../icons';
import { messageFor, messagesOf } from '../errors';
import { useAsync } from '../useAsync';
import { useLang, useT } from '../i18n/LanguageProvider';
import { assigneeChoices, phaseChoices, type PhaseNameFor } from '../todos';
import { Uploader } from './Uploader';

interface FollowUpRow {
  title: string;
  assigneeId: number | null;
  dueDate: string;
}

interface EntryFormProps {
  project: ProjectRecord;
  me: Me;
  /** Everyone in Resources, for the attendees picker. */
  people: ResourceRecord[];
  /** The kind of entry to create. Ignored (the existing entry's own type is kept) when editing. */
  type: EntryType;
  /** The entry being edited, or undefined for a new one. */
  initial?: EntryRecord;
  nameFor?: PhaseNameFor;
  /** For the "Attach files" picker's type default: "Meeting Minutes" for a meeting, "Other" for an update. */
  attachmentTypes: ListValue[];
  onSave: (input: EntryInput) => Promise<void>;
  onCancel: () => void;
}

/** Add or edit a meeting or an update: title, date, phase, notes, attendees (meetings), highlight and follow-ups (new meetings). */
export function EntryForm({ project, me, people, type, initial, nameFor, attachmentTypes, onSave, onCancel }: EntryFormProps) {
  const t = useT();
  const { lang } = useLang();
  const entryType: EntryType = initial?.type ?? type;
  const isMeeting = entryType === 'meeting';
  const isNew = !initial;

  const defaults: EntryInput = initial ? entryToInput(initial) : {
    type: entryType, effectiveDate: todayLocal(), title: '', body: '', phaseId: null, highlight: false,
    attendeeIds: [], followUps: [], attachmentIds: [],
  };

  const [title, setTitle] = useState(defaults.title);
  const [effectiveDate, setEffectiveDate] = useState(defaults.effectiveDate);
  const [phaseId, setPhaseId] = useState<number | null>(defaults.phaseId ?? null);
  const [body, setBody] = useState(defaults.body ?? '');
  const [highlight, setHighlight] = useState(defaults.highlight ?? false);
  const [attendeeIds, setAttendeeIds] = useState<number[]>(defaults.attendeeIds ?? []);
  const [search, setSearch] = useState('');
  const [followUps, setFollowUps] = useState<FollowUpRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Attachments: new ones upload immediately when chosen; existing ones (when editing) can be unlinked with an ×.
  const [newAttachments, setNewAttachments] = useState<AttachmentRecord[]>([]);
  const [unlinkedExisting, setUnlinkedExisting] = useState<number[]>([]);
  const [uploadsBusy, setUploadsBusy] = useState(false);
  const existingIds = initial?.attachmentIds ?? [];
  const existingAttachments = useAsync(
    () => (existingIds.length > 0 ? api.listAttachments(project.id) : Promise.resolve([])),
    [project.id, initial?.id],
  );
  const existingForEntry = (existingAttachments.data ?? []).filter(
    (a) => existingIds.includes(a.id) && !unlinkedExisting.includes(a.id),
  );
  // Matched by the type's editable English name, which is the seeded value from the constraints table. If the user
  // renames it in Settings, this simply finds nothing and the picker falls back to no default type (typeId: null) —
  // uploads still work, they just start without a preselected type.
  const attachTypeId =
    attachmentTypes.find((v) => v.name === (isMeeting ? 'Meeting Minutes' : 'Other'))?.id ?? null;

  const phases = phaseChoices(project, nameFor);
  const { onProject, others } = attendeeChoices(project, people);
  const chosen = attendeeIds
    .map((id) => people.find((p) => p.id === id))
    .filter((p): p is ResourceRecord => p !== undefined);
  const q = search.trim().toLowerCase();
  const available = (list: ResourceRecord[]) =>
    list.filter((p) => !attendeeIds.includes(p.id) && (q === '' || p.name.toLowerCase().includes(q)));
  const onProjectAvailable = available(onProject);
  const othersAvailable = available(others);
  const followUpAssigneeChoices = assigneeChoices(project, me, null, lang);

  function addAttendee(id: number) {
    setAttendeeIds((v) => (v.includes(id) ? v : [...v, id]));
  }
  function removeAttendee(id: number) {
    setAttendeeIds((v) => v.filter((x) => x !== id));
  }
  function addFollowUp() {
    setFollowUps((v) => [...v, { title: '', assigneeId: me.resourceId, dueDate: '' }]);
  }
  function updateFollowUp(index: number, patch: Partial<FollowUpRow>) {
    setFollowUps((v) => v.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }
  function removeFollowUp(index: number) {
    setFollowUps((v) => v.filter((_, i) => i !== index));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (uploadsBusy) {
      setErrors([t('entryForm.uploadsPending')]);
      return;
    }
    const input = {
      type: entryType,
      effectiveDate,
      title,
      body,
      phaseId,
      highlight,
      attendeeIds: isMeeting ? attendeeIds : [],
      followUps:
        isNew && isMeeting
          ? followUps
            .filter((f) => f.title.trim() !== '')
            .map((f) => ({ title: f.title, assigneeId: f.assigneeId, dueDate: f.dueDate === '' ? null : f.dueDate }))
          : [],
      attachmentIds: [...existingForEntry.map((a) => a.id), ...newAttachments.map((a) => a.id)],
    };
    const parsed = entryInputSchema.safeParse(input);
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
    <form className="entry-form" onSubmit={submit} noValidate>
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
        {t('entryForm.effectiveDate')}
        <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
      </label>

      <label>
        {t('todo.phaseField')}
        <select value={phaseId === null ? '' : String(phaseId)} onChange={(e) => setPhaseId(e.target.value === '' ? null : Number(e.target.value))}>
          <option value="">{t('todo.wholeProject')}</option>
          {phases.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
        </select>
      </label>

      <label>
        {t(isMeeting ? 'entryForm.notesMeeting' : 'entryForm.notesUpdate')}
        <textarea value={body} onChange={(e) => setBody(e.target.value)} dir="auto" data-user-content="" />
      </label>

      {isMeeting ? (
        <div className="attendee-picker">
          <label htmlFor="entry-attendee-search">{t('entryForm.attendees')}</label>
          {chosen.length > 0 ? (
            <ul className="chip-list">
              {chosen.map((p) => (
                <li key={p.id} className="chip">
                  <span dir="auto" data-user-content="">{p.name}</span>
                  <button type="button" aria-label={t('entryForm.removeAttendeeAria', { name: p.name })} onClick={() => removeAttendee(p.id)}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <input
            id="entry-attendee-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('entryForm.searchPeople')}
            dir="auto"
          />
          <ul className="attendee-options">
            {onProjectAvailable.length > 0 ? <li className="attendee-group-label">{t('entryForm.onThisProject')}</li> : null}
            {onProjectAvailable.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => addAttendee(p.id)}>
                  <span dir="auto" data-user-content="">{p.name}</span>
                </button>
              </li>
            ))}
            {othersAvailable.length > 0 ? <li className="attendee-group-label">{t('entryForm.everyoneElse')}</li> : null}
            {othersAvailable.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => addAttendee(p.id)}>
                  <span dir="auto" data-user-content="">{p.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="attach-files">
        {existingForEntry.length > 0 || newAttachments.length > 0 ? (
          <ul className="chip-list">
            {existingForEntry.map((a) => (
              <li key={a.id} className="chip">
                <span dir="auto" data-user-content="">{a.name}</span>
                <button
                  type="button"
                  dir="auto"
                  data-user-content=""
                  aria-label={t('entryForm.removeAttachmentAria', { name: a.name })}
                  onClick={() => setUnlinkedExisting((v) => [...v, a.id])}
                >
                  ×
                </button>
              </li>
            ))}
            {newAttachments.map((a) => (
              <li key={a.id} className="chip">
                <span dir="auto" data-user-content="">{a.name}</span>
                <button
                  type="button"
                  dir="auto"
                  data-user-content=""
                  aria-label={t('entryForm.removeAttachmentAria', { name: a.name })}
                  onClick={() => setNewAttachments((v) => v.filter((x) => x.id !== a.id))}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <Uploader
          projectId={project.id}
          typeId={attachTypeId}
          buttonLabel={t('entryForm.attachFiles')}
          onUploaded={(a) => setNewAttachments((v) => [...v, a])}
          onBusyChange={setUploadsBusy}
        />
      </div>

      <label className="check">
        <input type="checkbox" checked={highlight} onChange={(e) => setHighlight(e.target.checked)} />
        {t('entryForm.showInPresentation')}
      </label>
      <p className="field-hint">{t('entryForm.showInPresentationHint')}</p>

      {isNew && isMeeting ? (
        <div className="followups">
          <h3>{t('entryForm.followUps')}</h3>
          {followUps.map((f, i) => (
            <div key={i} className="followup-row">
              <label>
                {t('todo.fieldTitle')}
                <input value={f.title} onChange={(e) => updateFollowUp(i, { title: e.target.value })} dir="auto" data-user-content="" />
              </label>
              <label>
                {t('todo.assignedTo')}
                <select
                  value={f.assigneeId === null ? '' : String(f.assigneeId)}
                  onChange={(e) => updateFollowUp(i, { assigneeId: e.target.value === '' ? null : Number(e.target.value) })}
                >
                  <option value="">{t('todo.unassigned')}</option>
                  {followUpAssigneeChoices.me ? (
                    <option value={String(followUpAssigneeChoices.me.id)}>{t('todo.me', { name: followUpAssigneeChoices.me.name })}</option>
                  ) : null}
                  {followUpAssigneeChoices.managers.length > 0 ? (
                    <optgroup label={t('todo.projectManagers')}>
                      {followUpAssigneeChoices.managers.map((m) => <option key={m.id} value={String(m.id)}>{m.label}</option>)}
                    </optgroup>
                  ) : null}
                  {followUpAssigneeChoices.team.length > 0 ? (
                    <optgroup label={t('todo.team')}>
                      {followUpAssigneeChoices.team.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                    </optgroup>
                  ) : null}
                </select>
              </label>
              <label>
                {t('todo.dueField')}
                <input type="date" value={f.dueDate} onChange={(e) => updateFollowUp(i, { dueDate: e.target.value })} />
              </label>
              <button
                type="button"
                className="button secondary"
                aria-label={t('entryForm.removeFollowUpAria', { index: i + 1 })}
                onClick={() => removeFollowUp(i)}
              >
                {t('common.remove')}
              </button>
            </div>
          ))}
          <button type="button" className="button secondary" onClick={addFollowUp}>{t('entryForm.addFollowUp')}</button>
        </div>
      ) : null}

      <div className="option-add-actions">
        <button type="submit" className="button" disabled={saving}>{t('common.save')}</button>
        <button type="button" className="button secondary" onClick={onCancel}>{t('common.cancel')}</button>
      </div>
    </form>
  );
}
