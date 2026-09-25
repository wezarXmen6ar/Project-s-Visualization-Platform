import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { todayLocal } from '../../../shared/calendar';
import { newProjectSchema, toIssues, type NewProjectInput, type ValidationIssue } from '../../../shared/schemas';
import { AlertIcon, ArrowLeftIcon, ArrowRightIcon } from '../../icons';
import { ApiError, api } from '../../api';
import { messageFor, messagesOf } from '../../errors';
import type { MessageKey } from '../../../shared/i18n/en';
import { useLang, useT } from '../../i18n/LanguageProvider';
import { phaseName } from '../../i18n/listNames';
import { useLists } from '../../useLists';
import { useResources } from '../../useResources';
import { useWorkload } from '../../useWorkload';
import { DetailsFields } from './DetailsFields';
import { PeopleFields } from './PeopleFields';
import { DEFAULT_PHASES, PhasesFields } from './PhasesFields';
import { ScopeFields } from './ScopeFields';
import { detailsToInput, emptyDetails, firstStepWithIssue, phasesToInput, stepOfIssue, type DetailsDraft, type PhaseDraft } from './projectDraft';

const STEPS: MessageKey[] = ['wizard.stepBasics', 'wizard.stepScope', 'wizard.stepPhases', 'wizard.stepPeople'];
const LAST = STEPS.length - 1;

export function CreateProjectPage() {
  const navigate = useNavigate();
  const t = useT();
  const { lang } = useLang();
  const { lists, error: listsError, remember } = useLists();
  const { people, error: peopleError, remember: rememberPerson } = useResources();
  const { workload, error: workloadError } = useWorkload();
  const [step, setStep] = useState(0);
  const [details, setDetails] = useState<DetailsDraft>(emptyDetails);
  const [startDate, setStartDate] = useState(todayLocal());
  const [phases, setPhases] = useState<PhaseDraft[]>(DEFAULT_PHASES);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [saving, setSaving] = useState(false);

  const patchDetails = (patch: Partial<DetailsDraft>) => setDetails((d) => ({ ...d, ...patch }));
  const input = (): NewProjectInput => ({ ...detailsToInput(details), startDate, phases: phasesToInput(phases) });

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
      navigate(`/manage/projects/${project.id}?starter=all`);
    } catch (err) {
      if (err instanceof ApiError && err.issues.length > 0) showIssues(err.issues);
      else setIssues([{ path: '', message: messagesOf(err, t)[0] }]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page page-wide">
      <div className="page-header">
        <div>
          <Link to="/manage" className="crumb"><ArrowLeftIcon />{t('nav.projects')}</Link>
          <h1>{t('wizard.title')}</h1>
        </div>
      </div>

      <ol className="wizard-steps">
        {STEPS.map((label, i) => (
          <li key={label} className={i === step ? 'current' : i < step ? 'done' : undefined} aria-current={i === step ? 'step' : undefined}>
            <span className="wizard-step-number">{i + 1}</span>
            {t(label)}
          </li>
        ))}
      </ol>

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
        {peopleError ? (
          <div className="errors" role="alert">
            <AlertIcon />
            <span>{t('common.couldNotLoadPeople', { error: messagesOf(peopleError, t)[0] })}</span>
          </div>
        ) : null}
        {workloadError ? (
          <div className="errors" role="alert">
            <AlertIcon />
            <span>{t('common.couldNotLoadWorkload', { error: messagesOf(workloadError, t)[0] })}</span>
          </div>
        ) : null}

        {step === 0 ? (
          <DetailsFields
            value={details}
            onChange={patchDetails}
            lists={lists}
            onListAdded={remember}
            people={people}
            onPersonAdded={rememberPerson}
          />
        ) : null}
        {step === 1 ? <ScopeFields value={details} onChange={patchDetails} /> : null}
        {step === 2 ? (
          <PhasesFields
            startDate={startDate}
            onStartDate={setStartDate}
            phases={phases}
            onPhases={setPhases}
            phaseOptions={lists.phase}
            onListAdded={remember}
          />
        ) : null}
        {step === 3 ? (
          <PeopleFields
            projectName={details.name}
            startDate={startDate}
            phases={phases}
            onPhases={setPhases}
            people={people}
            workload={workload}
            nameFor={(name) => phaseName(name, lists, lang)}
            roles={lists.role}
          />
        ) : null}

        <div className="wizard-actions">
          {step > 0 ? (
            <button type="button" className="button secondary" onClick={back}>
              <ArrowLeftIcon />{t('common.back')}
            </button>
          ) : (
            <span />
          )}
          <button type="submit" className="button" disabled={saving}>
            {step < LAST ? <>{t('common.next')}<ArrowRightIcon /></> : saving ? t('common.saving') : t('wizard.create')}
          </button>
        </div>
      </form>
    </main>
  );
}
