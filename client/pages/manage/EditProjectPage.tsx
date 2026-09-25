import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { projectDetailsSchema, toIssues, type ValidationIssue } from '../../../shared/schemas';
import { AlertIcon, ArrowLeftIcon } from '../../icons';
import { ApiError, api } from '../../api';
import { useAsync } from '../../useAsync';
import { useLists } from '../../useLists';
import { useResources } from '../../useResources';
import { DetailsFields } from './DetailsFields';
import { ScopeFields } from './ScopeFields';
import { detailsFromProject, detailsToInput, type DetailsDraft } from './projectDraft';

export function EditProjectPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const project = useAsync(() => api.getProject(id), [id]);
  const { lists, error: listsError, remember } = useLists();
  const { people, error: peopleError, remember: rememberPerson } = useResources();
  const [edited, setEdited] = useState<DetailsDraft | null>(null);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
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
          : [{ path: '', message: err instanceof Error ? err.message : String(err) }],
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <Link to={`/manage/projects/${id}`} className="crumb"><ArrowLeftIcon />{project.data.name}</Link>
          <h1>Edit details</h1>
        </div>
      </div>

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
        {peopleError ? (
          <div className="errors" role="alert">
            <AlertIcon />
            <span>Could not load people: {peopleError.message}</span>
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
          Phases are changed on their own page: <Link to={`/manage/projects/${id}/phases`}>Edit phases</Link>
        </p>
        <div className="wizard-actions">
          <Link to={`/manage/projects/${id}`} className="button secondary">Cancel</Link>
          <button type="submit" className="button" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
        </div>
      </form>
    </main>
  );
}
