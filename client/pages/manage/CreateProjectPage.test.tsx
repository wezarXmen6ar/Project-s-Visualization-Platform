// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router';
import { describe, expect, it } from 'vitest';
import { mockFetch, sampleProject } from '../../testing/mockFetch';
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

const calendarRoute = { 'GET /api/settings/calendar': () => ({ body: { weekendDays: [0, 6], holidays: [] } }) };

describe('CreateProjectPage', () => {
  it('starts with standard phases and previews them on a Gantt chart', async () => {
    mockFetch(calendarRoute);
    renderPage();
    expect(screen.getByLabelText('Phase 4 name')).toHaveValue('Development');
    expect(await screen.findByTestId('gantt-row-3')).toBeInTheDocument();
  });

  it('saves the project and opens its page', async () => {
    const fetchMock = mockFetch({
      ...calendarRoute,
      'POST /api/projects': () => ({ status: 201, body: sampleProject({ id: 7 }) }),
    });
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('Project name'), 'Portal');
    await user.type(screen.getByLabelText('Jira key'), 'PRJ-7');
    await user.click(screen.getByRole('button', { name: 'Create project' }));

    expect(await screen.findByText('Project page 7')).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([url, init]) => url === '/api/projects' && init?.method === 'POST');
    const sent = JSON.parse(post![1]!.body as string);
    expect(sent).toMatchObject({ name: 'Portal', jiraKey: 'PRJ-7', color: '#3b82f6' });
    expect(sent.phases).toHaveLength(7);
  });

  it('shows validation errors and does not submit', async () => {
    const fetchMock = mockFetch(calendarRoute);
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Create project' }));
    expect(await screen.findByText('Project name is required')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('adds and removes phases', async () => {
    mockFetch(calendarRoute);
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Add phase' }));
    expect(screen.getByLabelText('Phase 8 name')).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Remove phase 8' }));
    expect(screen.queryByLabelText('Phase 8 name')).toBeNull();
  });

  it('reorders phases via drag-and-drop, updating the preview order', async () => {
    mockFetch(calendarRoute);
    renderPage();

    expect(screen.getByLabelText('Phase 1 name')).toHaveValue('Requirements gathering');
    expect(screen.getByLabelText('Phase 2 name')).toHaveValue('Business analysis');

    const row1 = screen.getByLabelText('Reorder phase 1').closest('.phase-row') as HTMLElement;
    const row2 = screen.getByLabelText('Reorder phase 2').closest('.phase-row') as HTMLElement;
    const dataTransfer = { setData: () => {}, getData: () => '' };

    fireEvent.dragStart(row2, { dataTransfer });
    fireEvent.dragOver(row1, { dataTransfer });
    fireEvent.drop(row1, { dataTransfer });

    expect(screen.getByLabelText('Phase 1 name')).toHaveValue('Business analysis');
    expect(screen.getByLabelText('Phase 2 name')).toHaveValue('Requirements gathering');

    const previewRow0 = await screen.findByTestId('gantt-row-0');
    expect(previewRow0).toHaveTextContent('Business analysis');
  });
});
