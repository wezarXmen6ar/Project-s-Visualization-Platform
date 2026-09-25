import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { projectDetailsSchema, toIssues, type ValidationIssue } from '../../../shared/schemas';
import { AlertIcon, ArrowLeftIcon } from '../../icons';
import { ApiError, api } from '../../api';
import { messageFor, messagesOf } from '../../errors';
import { useT } from '../../i18n/LanguageProvider';
import { withNodes } from '../../i18n/withNodes';
import { useAsync } from '../../useAsync';
import { useLists } from '../../useLists';
import { useResources } from '../../useResources';
import { DetailsFields } from './DetailsFields';
import { ScopeFields } from './ScopeFields';
import { detailsFromProject, detailsToInput, type DetailsDraft } from './projectDraft';

export function EditProjectPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const t = useT();
  const project = useAsync(() => api.getProject(id), [id]);
  const { lists, error: listsError, remember } = useLists();
  const { people, error: peopleError, remember: rememberPerson } = useResources();
  const [edited, setEdited] = useState<DetailsDraft | null>(null);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
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

  // Until the user changes something, the form shows the saved project.
  const savedDraft = detailsFromProject(project.data);
  const draft = edited ?? savedDraft;
  const patch = (changes: Partial<DetailsDraft>) =>
    setEdited((prev) => ({ ...(prev ?? savedDraft), ...changes }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const input = detailsToInput(draft);
    const parsed = projectDetailsSchema.safeParse(input);
    if (!parsed.success) {
      setIssues(toIssues(parsed.error));
      return;
    }
    setIssues([]);
    setSaving(true);
    try {
      await api.updateProjectDetails(id, input);
      navigate(`/manage/projects/${id}`);
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

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <Link to={`/manage/projects/${id}`} className="crumb"><ArrowLeftIcon /><span dir="auto" data-user-content="">{project.data.name}</span></Link>
          <h1>{t('project.editDetails')}</h1>
        </div>
      </div>

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

        <DetailsFields
          value={draft}
          onChange={patch}
          lists={lists}
          onListAdded={remember}
          people={people}
          onPersonAdded={rememberPerson}
        />
        <ScopeFields value={draft} onChange={patch} />

        <p className="muted">
          {withNodes(t('edit.phasesElsewhere'), {
            link: <Link to={`/manage/projects/${id}/phases`}>{t('project.editPhases')}</Link>,
          })}
        </p>
        <div className="wizard-actions">
          <Link to={`/manage/projects/${id}`} className="button secondary">{t('common.cancel')}</Link>
          <button type="submit" className="button" disabled={saving}>{saving ? t('common.saving') : t('edit.saveChanges')}</button>
        </div>
      </form>
    </main>
  );
}
