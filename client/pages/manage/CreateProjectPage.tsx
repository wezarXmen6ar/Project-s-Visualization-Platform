import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { todayLocal } from '../../../shared/calendar';
import { newProjectSchema, toIssues, type NewProjectInput, type ValidationIssue } from '../../../shared/schemas';
import type { PhaseInput } from '../../../shared/scheduler';
import { AlertIcon, ArrowLeftIcon, ArrowRightIcon } from '../../icons';
import { ApiError, api } from '../../api';
import { useLists } from '../../useLists';
import { DetailsFields } from './DetailsFields';
import { DEFAULT_PHASES, PhasesFields } from './PhasesFields';
import { ScopeFields } from './ScopeFields';
import { detailsToInput, emptyDetails, firstStepWithIssue, stepOfIssue, type DetailsDraft } from './projectDraft';

const STEPS = ['Basic info', 'Description & scope', 'Phases'];
const LAST = STEPS.length - 1;

export function CreateProjectPage() {
  const navigate = useNavigate();
  const { lists, error: listsError, remember } = useLists();
  const [step, setStep] = useState(0);
  const [details, setDetails] = useState<DetailsDraft>(emptyDetails);
  const [startDate, setStartDate] = useState(todayLocal());
  const [phases, setPhases] = useState<PhaseInput[]>(DEFAULT_PHASES);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [saving, setSaving] = useState(false);

  const patchDetails = (patch: Partial<DetailsDraft>) => setDetails((d) => ({ ...d, ...patch }));
  const input = (): NewProjectInput => ({ ...detailsToInput(details), startDate, phases });

  function validate(): ValidationIssue[] {
    const parsed = newProjectSchema.safeParse(input());
    return parsed.success ? [] : toIssues(parsed.error);
  }

  /** Shows the issues and moves to the earliest step that has one. */
  function showIssues(found: ValidationIssue[]) {
    setIssues(found);
    const first = firstStepWithIssue(found);
    if (first !== null) setStep(first);
  }

  function back() {
    setIssues([]);
    setStep((s) => s - 1);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validate();

    // Steps 1–2: "Next" (or Enter) only checks the fields on the current step.
    if (step < LAST) {
      const blocking = found.filter((i) => stepOfIssue(i) === step);
      setIssues(blocking);
      if (blocking.length === 0) setStep(step + 1);
      return;
    }

    if (found.length > 0) {
      showIssues(found);
      return;
    }
    setIssues([]);
    setSaving(true);
    try {
      const project = await api.createProject(input());
      navigate(`/manage/projects/${project.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.issues.length > 0) showIssues(err.issues);
      else setIssues([{ path: '', message: err instanceof Error ? err.message : String(err) }]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <Link to="/manage" className="crumb"><ArrowLeftIcon />Projects</Link>
          <h1>New project</h1>
        </div>
      </div>

      <ol className="wizard-steps">
        {STEPS.map((label, i) => (
          <li key={label} className={i === step ? 'current' : i < step ? 'done' : undefined} aria-current={i === step ? 'step' : undefined}>
            <span className="wizard-step-number">{i + 1}</span>
            {label}
          </li>
        ))}
      </ol>

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

        {step === 0 ? <DetailsFields value={details} onChange={patchDetails} lists={lists} onListAdded={remember} /> : null}
        {step === 1 ? <ScopeFields value={details} onChange={patchDetails} /> : null}
        {step === 2 ? (
          <PhasesFields startDate={startDate} onStartDate={setStartDate} phases={phases} onPhases={setPhases} />
        ) : null}

        <div className="wizard-actions">
          {step > 0 ? (
            <button type="button" className="button secondary" onClick={back}>
              <ArrowLeftIcon />Back
            </button>
          ) : (
            <span />
          )}
          <button type="submit" className="button" disabled={saving}>
            {step < LAST ? <>Next<ArrowRightIcon /></> : saving ? 'Saving…' : 'Create project'}
          </button>
        </div>
      </form>
    </main>
  );
}
