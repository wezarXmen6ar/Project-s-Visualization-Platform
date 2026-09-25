// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router';
import { describe, expect, it } from 'vitest';
import { mockFetch, sampleLists, samplePeople, sampleProject, type MockHandler } from '../../testing/mockFetch';
import { CreateProjectPage } from './CreateProjectPage';

function ProjectStub() {
  const { id } = useParams();
  return <div>Project page {id}</div>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/manage/projects/new']}>
      <Routes>
        <Route path="/manage/projects/new" element={<CreateProjectPage />} />
        <Route path="/manage/projects/:id" element={<ProjectStub />} />
      </Routes>
    </MemoryRouter>,
  );
}

const baseRoutes: Record<string, MockHandler> = {
  'GET /api/settings/calendar': () => ({ body: { weekendDays: [0, 6], holidays: [] } }),
  'GET /api/lists': () => ({ body: sampleLists() }),
  'GET /api/resources': () => ({ body: samplePeople() }),
};

type User = ReturnType<typeof userEvent.setup>;

async function openPhasesStep(user: User) {
  await user.type(screen.getByLabelText('Project name'), 'Portal');
  await user.click(screen.getByRole('button', { name: 'Next' }));
  await user.click(screen.getByRole('button', { name: 'Next' }));
}

/** The phase dropdowns show their names once the lists have loaded. */
async function phasesLoaded() {
  await waitFor(() => expect(screen.getByLabelText('Phase 1 name')).toHaveDisplayValue('Requirements gathering'));
}

describe('CreateProjectPage wizard', () => {
  it('starts on Basic info and will not move on without a project name', async () => {
    mockFetch(baseRoutes);
    const user = userEvent.setup();
    renderPage();
    expect(screen.getByRole('heading', { name: 'Basic info' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Project name is required')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Basic info' })).toBeInTheDocument();
  });

  it('keeps what was typed when going back', async () => {
    mockFetch(baseRoutes);
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('Project name'), 'Portal');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: 'Description' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText('Project name')).toHaveValue('Portal');
  });

  it('creates a project with its details, scope and phases', async () => {
    const fetchMock = mockFetch({
      ...baseRoutes,
      'POST /api/projects': () => ({ status: 201, body: sampleProject({ id: 7 }) }),
    });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Project name'), 'Portal');
    await screen.findByRole('option', { name: 'Sara Ahmed' });
    await user.selectOptions(screen.getByLabelText('Project manager (tech)'), 'Sara Ahmed');
    await user.selectOptions(screen.getByLabelText('Business project manager'), 'Mariam Al Suwaidi');
    await screen.findByRole('option', { name: 'Customer' });
    await user.selectOptions(screen.getByLabelText('Project type'), 'Customer');
    await user.selectOptions(screen.getByLabelText('Main project'), 'Digital Services');
    await user.click(screen.getByRole('checkbox', { name: 'Internal' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));

    await user.type(screen.getByLabelText('Background'), 'The portal is slow.');
    await user.type(screen.getByLabelText('New scope item'), 'Online payments{Enter}');
    expect(screen.getByLabelText('Scope item 1')).toHaveValue('Online payments');
    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByRole('heading', { name: 'Phases' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create project' }));

    expect(await screen.findByText('Project page 7')).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([url, init]) => url === '/api/projects' && init?.method === 'POST');
    const sent = JSON.parse(post![1]!.body as string);
    expect(sent).toMatchObject({
      name: 'Portal',
      projectManagerId: 70,
      businessPmId: 80,
      projectTypeId: 2,
      mainProjectId: 20,
      requester: { internal: true, external: false },
      background: 'The portal is slow.',
      scopeItems: [{ kind: 'scope', text: 'Online payments' }],
      color: '#3b82f6',
    });
    expect(sent.phases.map((p: { name: string }) => p.name)).toEqual([
      'Requirements gathering', 'Business analysis', 'Development plan', 'Development', 'QA', 'UAT',
      'Security testing', 'Deployment', 'Launch',
    ]);
  });

  it('adds a new department from the dropdown and selects it', async () => {
    mockFetch({
      ...baseRoutes,
      'POST /api/lists/department': () => ({ status: 201, body: { id: 31, list: 'department', name: 'Legal', order: 1 } }),
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('option', { name: 'Finance' });
    await user.selectOptions(screen.getByLabelText('Business user (department)'), '+ Add new department…');
    await user.type(screen.getByLabelText('New business user (department)'), 'Legal');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByRole('option', { name: 'Legal' })).toBeInTheDocument();
    expect(screen.getByLabelText('Business user (department)')).toHaveValue('31');
  });

  it('sends the user back to the step with a server-side error', async () => {
    mockFetch({
      ...baseRoutes,
      'POST /api/projects': () => ({
        status: 400,
        body: { error: 'Invalid project', issues: [{ path: 'projectTypeId', message: 'Unknown project type' }] },
      }),
    });
    const user = userEvent.setup();
    renderPage();
    await openPhasesStep(user);
    await user.click(screen.getByRole('button', { name: 'Create project' }));
    expect(await screen.findByText('Unknown project type')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Basic info' })).toBeInTheDocument();
  });

  it('starts with the nine standard phases, shown in dropdowns, and previews them', async () => {
    mockFetch(baseRoutes);
    const user = userEvent.setup();
    renderPage();
    await openPhasesStep(user);
    await phasesLoaded();
    const shown = Array.from({ length: 9 }, (_, i) =>
      (screen.getByLabelText(`Phase ${i + 1} name`) as HTMLSelectElement).selectedOptions[0].textContent);
    expect(shown).toEqual([
      'Requirements gathering', 'Business analysis', 'Development plan', 'Development', 'QA', 'UAT',
      'Security testing', 'Deployment', 'Launch',
    ]);
    expect(screen.queryByLabelText('Phase 10 name')).toBeNull();
    expect(await screen.findByTestId('gantt-row-8')).toBeInTheDocument();
  });

  it('picks a phase from the list, and adds a new one with Other…', async () => {
    mockFetch({
      ...baseRoutes,
      'POST /api/lists/phase': () => ({ status: 201, body: { id: 60, list: 'phase', name: 'Data migration', order: 10 } }),
    });
    const user = userEvent.setup();
    renderPage();
    await openPhasesStep(user);
    await phasesLoaded();

    await user.selectOptions(screen.getByLabelText('Phase 3 name'), 'Design');
    expect(screen.getByLabelText('Phase 3 name')).toHaveDisplayValue('Design');

    await user.selectOptions(screen.getByLabelText('Phase 1 name'), 'Other…');
    await user.type(screen.getByLabelText('New phase 1 name'), 'Data migration');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(screen.getByLabelText('Phase 1 name')).toHaveDisplayValue('Data migration'));
    expect(await screen.findByTestId('gantt-row-0')).toHaveTextContent('Data migration');
  });

  it('adds and removes phases', async () => {
    mockFetch(baseRoutes);
    const user = userEvent.setup();
    renderPage();
    await openPhasesStep(user);
    await phasesLoaded();
    await user.click(screen.getByRole('button', { name: 'Add phase' }));
    expect(screen.getByLabelText('Phase 10 name')).toHaveDisplayValue('Choose a phase…');
    await user.click(screen.getByRole('button', { name: 'Remove phase 10' }));
    expect(screen.queryByLabelText('Phase 10 name')).toBeNull();
  });

  it('reorders phases via drag-and-drop, updating the preview order', async () => {
    mockFetch(baseRoutes);
    const user = userEvent.setup();
    renderPage();
    await openPhasesStep(user);
    await phasesLoaded();

    const row1 = screen.getByLabelText('Reorder phase 1').closest('.phase-row') as HTMLElement;
    const dataTransfer = { setData: () => {}, getData: () => '', effectAllowed: '' };
    fireEvent.dragStart(screen.getByLabelText('Reorder phase 2'), { dataTransfer });
    fireEvent.dragOver(row1, { dataTransfer });
    fireEvent.drop(row1, { dataTransfer });

    expect(screen.getByLabelText('Phase 1 name')).toHaveDisplayValue('Business analysis');
    expect(screen.getByLabelText('Phase 2 name')).toHaveDisplayValue('Requirements gathering');
    expect(await screen.findByTestId('gantt-row-0')).toHaveTextContent('Business analysis');
  });

  it('reorders phases via keyboard, moving focus with the phase', async () => {
    mockFetch(baseRoutes);
    const user = userEvent.setup();
    renderPage();
    await openPhasesStep(user);
    await phasesLoaded();

    const handle2 = screen.getByLabelText('Reorder phase 2');
    handle2.focus();
    fireEvent.keyDown(handle2, { key: 'ArrowUp' });

    expect(screen.getByLabelText('Phase 1 name')).toHaveDisplayValue('Business analysis');
    expect(await screen.findByTestId('gantt-row-0')).toHaveTextContent('Business analysis');
    expect(screen.getByLabelText('Reorder phase 1')).toHaveFocus();
  });
});
