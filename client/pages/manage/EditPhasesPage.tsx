import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { scheduleUpdateSchema, toIssues, type ValidationIssue } from '../../../shared/schemas';
import { AlertIcon, ArrowLeftIcon } from '../../icons';
import { ApiError, api } from '../../api';
import { messageFor, messagesOf } from '../../errors';
import { translate } from '../../../shared/i18n/translate';
import type { Lang } from '../../../shared/i18n/types';
import { useLang, useT } from '../../i18n/LanguageProvider';
import { phaseName } from '../../i18n/listNames';
import { useAsync } from '../../useAsync';
import { useLists } from '../../useLists';
import { PhasesFields } from './PhasesFields';
import { removedItems, scheduleFromProject, scheduleToInput, type PhaseDraft } from './projectDraft';

interface ScheduleDraft {
  startDate: string;
  phases: PhaseDraft[];
}

type RemovedItem = { label: string; people: number; openToDos: number; doneToDos: number };

/** One removed item with its counts, e.g. "Development › Increment 2 (2 people, 3 open to-dos)". */
function itemLabel(lang: Lang, i: RemovedItem): string {
  const parts: string[] = [];
  if (i.people > 0) parts.push(translate(lang, 'phases.people', { count: i.people }));
  if (i.openToDos > 0) parts.push(translate(lang, 'phases.openToDos', { count: i.openToDos }));
  if (i.doneToDos > 0) parts.push(translate(lang, 'phases.doneToDos', { count: i.doneToDos }));
  if (parts.length === 0) return i.label;
  return translate(lang, 'phases.item', { label: i.label, counts: parts.join(lang === 'ar' ? '، ' : ', ') });
}

/** "A, B and C" in English; "A وB وC" in Arabic, which repeats و before every item after the first. */
function joinItems(lang: Lang, parts: string[]): string {
  if (lang === 'ar') return new Intl.ListFormat('ar', { type: 'conjunction' }).format(parts);
  return parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/**
 * The warning before saving, e.g. "Saving will remove Development › Increment 2 (2 people, 3 open to-dos) and QA
 * (1 person). The people on them will be unassigned." The unassigned sentence is added only when some people are
 * affected.
 */
function removalMessage(lang: Lang, items: RemovedItem[]): string {
  const joined = joinItems(lang, items.map((i) => itemLabel(lang, i)));
  const hasPeople = items.some((i) => i.people > 0);
  return translate(lang, hasPeople ? 'phases.removalWithPeople' : 'phases.removal', { items: joined });
}

/** Edits an existing project's start date and phases (with their sub-phases) on their own page. */
export function EditPhasesPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const t = useT();
  const { lang } = useLang();
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
        <Link to="/manage" className="crumb"><ArrowLeftIcon />{t('nav.projects')}</Link>
        <div className="errors" role="alert">
          <AlertIcon />
          <span>{messagesOf(project.error, t)[0]}</span>
        </div>
      </main>
    );
  }
  if (!project.data) return <main className="page"><p className="muted">{t('common.loading')}</p></main>;

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
      const removed = removedItems(project.data!, draft.phases, projectToDos.data ?? [], (name) => phaseName(name, lists, lang));
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
          : [{ path: '', message: messagesOf(err, t)[0] }],
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
    <main className="page page-wide">
      <div className="page-header">
        <div>
          <Link to={`/manage/projects/${id}`} className="crumb"><ArrowLeftIcon /><span dir="auto" data-user-content="">{project.data.name}</span></Link>
          <h1>{t('project.editPhases')}</h1>
        </div>
      </div>
      <p className="field-hint">{t('phases.hint')}</p>

      <form onSubmit={onSubmit} noValidate>
        {issues.length > 0 ? (
          <div className="errors" role="alert">
            <AlertIcon />
            <ul>{issues.map((i) => <li key={`${i.path}-${i.message}`}>{messageFor(t, i)}</li>)}</ul>
          </div>
        ) : null}
        {listsError ? (
          <div className="errors" role="alert">
            <AlertIcon />
            <span>{t('common.couldNotLoadLists', { error: messagesOf(listsError, t)[0] })}</span>
          </div>
        ) : null}
        {confirming ? (
          <div className="errors" role="alert">
            <AlertIcon />
            <div>
              <p>{removalMessage(lang, confirming)}</p>
              {confirming.some((i) => i.openToDos > 0) ? (
                <fieldset className="check-group">
                  <legend>{t('phases.theirOpenToDos')}</legend>
                  <label className="check">
                    <input
                      type="radio"
                      name="removedToDos"
                      checked={removedToDosChoice === 'keep'}
                      onChange={() => setRemovedToDosChoice('keep')}
                    />
                    {t('phases.keepThem')}
                  </label>
                  <label className="check">
                    <input
                      type="radio"
                      name="removedToDos"
                      checked={removedToDosChoice === 'delete'}
                      onChange={() => setRemovedToDosChoice('delete')}
                    />
                    {t('phases.deleteThem')}
                  </label>
                </fieldset>
              ) : null}
              <div className="wizard-actions">
                <button type="button" className="button" onClick={() => void save(true)}>{t('phases.saveAnyway')}</button>
                <button type="button" className="button secondary" onClick={() => setConfirming(null)}>{t('phases.keepEditing')}</button>
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
          <Link to={`/manage/projects/${id}`} className="button secondary">{t('common.cancel')}</Link>
          <button type="submit" className="button" disabled={saving}>{saving ? t('common.saving') : t('phases.save')}</button>
        </div>
      </form>
    </main>
  );
}
