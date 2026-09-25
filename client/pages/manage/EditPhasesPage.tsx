import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { scheduleUpdateSchema, toIssues, type ValidationIssue } from '../../../shared/schemas';
import { AlertIcon, ArrowLeftIcon } from '../../icons';
import { ApiError, api } from '../../api';
import { useAsync } from '../../useAsync';
import { useLists } from '../../useLists';
import { PhasesFields } from './PhasesFields';
import { removedItems, scheduleFromProject, scheduleToInput, type PhaseDraft } from './projectDraft';

interface ScheduleDraft {
  startDate: string;
  phases: PhaseDraft[];
}

type RemovedItem = { label: string; people: number; openToDos: number };

/** "1 person" or "N people". */
function peopleCount(n: number): string {
  return `${n} ${n === 1 ? 'person' : 'people'}`;
}

/** "1 open to-do" or "N open to-dos". */
function toDosCount(n: number): string {
  return `${n} open ${n === 1 ? 'to-do' : 'to-dos'}`;
}

function itemLabel(i: RemovedItem): string {
  const parts: string[] = [];
  if (i.people > 0) parts.push(peopleCount(i.people));
  if (i.openToDos > 0) parts.push(toDosCount(i.openToDos));
  return parts.length > 0 ? `${i.label} (${parts.join(', ')})` : i.label;
}

/**
 * Joins the removed items with commas and a final "and", e.g. "Development › Increment 2 (2 people, 3 open to-dos)
 * and QA (1 person)." The unassigned line is added only when some people are affected.
 */
function removalMessage(items: RemovedItem[]): string {
  const parts = items.map(itemLabel);
  const joined =
    parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  const hasPeople = items.some((i) => i.people > 0);
  return `Saving will remove ${joined}.${hasPeople ? ' The people on them will be unassigned.' : ''}`;
}

/** Edits an existing project's start date and phases (with their sub-phases) on their own page. */
export function EditPhasesPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const project = useAsync(() => api.getProject(id), [id]);
  const projectToDos = useAsync(() => api.listToDos({ projectId: id, includeDone: true }), [id]);
  const { lists, error: listsError, remember } = useLists();
  const [edited, setEdited] = useState<ScheduleDraft | null>(null);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [confirming, setConfirming] = useState<RemovedItem[] | null>(null);
  const [removedToDosChoice, setRemovedToDosChoice] = useState<'keep' | 'delete'>('keep');
  const [saving, setSaving] = useState(false);

  if (project.error) {
    return (
      <main className="page">
        <Link to="/manage" className="crumb"><ArrowLeftIcon />Projects</Link>
        <div className="errors" role="alert">
          <AlertIcon />
          <span>{project.error.message}</span>
        </div>
      </main>
    );
  }
  if (!project.data) return <main className="page"><p className="muted">Loading…</p></main>;

  // Until the user changes something, the form shows the saved schedule.
  const savedDraft = scheduleFromProject(project.data);
  const draft = edited ?? savedDraft;
  const patch = (changes: Partial<ScheduleDraft>) => {
    setEdited((prev) => ({ ...(prev ?? savedDraft), ...changes }));
    setConfirming(null);
  };

  async function save(skipConfirm: boolean) {
    const input = { ...scheduleToInput(draft.startDate, draft.phases), removedToDos: removedToDosChoice };
    const parsed = scheduleUpdateSchema.safeParse(input);
    if (!parsed.success) {
      setIssues(toIssues(parsed.error));
      setConfirming(null);
      return;
    }
    setIssues([]);
    if (!skipConfirm) {
      const removed = removedItems(project.data!, draft.phases, projectToDos.data ?? []);
      if (removed.length > 0) {
        // Every new warning starts on the safe choice, so an earlier "Delete them" can't carry over.
        setRemovedToDosChoice('keep');
        setConfirming(removed);
        return;
      }
    }
    setConfirming(null);
    setSaving(true);
    try {
      const saved = await api.updateSchedule(id, input);
      navigate(saved.addedPhaseIds.length > 0 ? `/manage/projects/${id}?starter=${saved.addedPhaseIds.join(',')}` : `/manage/projects/${id}`);
    } catch (err) {
      setIssues(
        err instanceof ApiError && err.issues.length > 0
          ? err.issues
          : [{ path: '', message: err instanceof Error ? err.message : String(err) }],
      );
    } finally {
      setSaving(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await save(false);
  }

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <Link to={`/manage/projects/${id}`} className="crumb"><ArrowLeftIcon />{project.data.name}</Link>
          <h1>Edit phases</h1>
        </div>
      </div>
      <p className="field-hint">People stay on the phases you keep. Removing a phase also removes the people assigned to it.</p>

      <form onSubmit={onSubmit} noValidate>
        {issues.length > 0 ? (
          <div className="errors" role="alert">
            <AlertIcon />
            <ul>{issues.map((i) => <li key={`${i.path}-${i.message}`}>{i.message}</li>)}</ul>
          </div>
        ) : null}
        {listsError ? (
          <div className="errors" role="alert">
            <AlertIcon />
            <span>Could not load the dropdown lists: {listsError.message}</span>
          </div>
        ) : null}
        {confirming ? (
          <div className="errors" role="alert">
            <AlertIcon />
            <div>
              <p>{removalMessage(confirming)}</p>
              {confirming.some((i) => i.openToDos > 0) ? (
                <fieldset className="check-group">
                  <legend>Their open to-dos</legend>
                  <label className="check">
                    <input
                      type="radio"
                      name="removedToDos"
                      checked={removedToDosChoice === 'keep'}
                      onChange={() => setRemovedToDosChoice('keep')}
                    />
                    Keep them on the project
                  </label>
                  <label className="check">
                    <input
                      type="radio"
                      name="removedToDos"
                      checked={removedToDosChoice === 'delete'}
                      onChange={() => setRemovedToDosChoice('delete')}
                    />
                    Delete them
                  </label>
                </fieldset>
              ) : null}
              <div className="wizard-actions">
                <button type="button" className="button" onClick={() => void save(true)}>Save anyway</button>
                <button type="button" className="button secondary" onClick={() => setConfirming(null)}>Keep editing</button>
              </div>
            </div>
          </div>
        ) : null}

        <PhasesFields
          startDate={draft.startDate}
          onStartDate={(date) => patch({ startDate: date })}
          phases={draft.phases}
          onPhases={(phases) => patch({ phases })}
          phaseOptions={lists.phase}
          onListAdded={remember}
        />

        <div className="wizard-actions">
          <Link to={`/manage/projects/${id}`} className="button secondary">Cancel</Link>
          <button type="submit" className="button" disabled={saving}>{saving ? 'Saving…' : 'Save phases'}</button>
        </div>
      </form>
    </main>
  );
}
