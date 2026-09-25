// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { ToDoRecord } from '../../../shared/types';
import { mockFetch, sampleLists, sampleProject, type MockHandler } from '../../testing/mockFetch';
import { EditPhasesPage } from './EditPhasesPage';

function ProjectStub() {
  const location = useLocation();
  return <div>Project page{location.search}</div>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/manage/projects/1/phases']}>
      <Routes>
        <Route path="/manage/projects/:id/phases" element={<EditPhasesPage />} />
        <Route path="/manage/projects/:id" element={<ProjectStub />} />
      </Routes>
    </MemoryRouter>,
  );
}

function project() {
  return sampleProject({
    phases: [
      { id: 11, name: 'Requirements gathering', order: 0, durationDays: 2, start: '2026-09-24', end: '2026-09-25', subPhases: [] },
      {
        id: 12, name: 'Development', order: 1, durationDays: 10, start: '2026-09-28', end: '2026-10-09',
        subPhases: [
          { id: 21, name: 'Increment 1', order: 0, durationDays: 5, start: '2026-09-28', end: '2026-10-02', withPrevious: false },
          { id: 22, name: 'Increment 2', order: 1, durationDays: 5, start: '2026-10-05', end: '2026-10-09', withPrevious: false },
        ],
      },
    ],
    assignments: [
      { id: 900, phaseId: 21, resource: { id: 71, name: 'Fatima Noor' }, allocation: 50, role: 'contributor' },
    ],
  });
}

function todo(overrides: Partial<ToDoRecord> & Pick<ToDoRecord, 'id' | 'title'>): ToDoRecord {
  return {
    projectId: 1, projectName: 'Portal', note: null, assignee: null, dueDate: null, done: false, doneDate: null,
    phase: null, formerPhase: null, createdAt: '2026-09-20T09:00:00.000Z', ...overrides,
  };
}

function baseRoutes(todos: ToDoRecord[] = []): Record<string, MockHandler> {
  return {
    'GET /api/projects/1': () => ({ body: project() }),
    'GET /api/todos?projectId=1&done=include': () => ({ body: todos }),
    'GET /api/lists': () => ({ body: sampleLists() }),
    'GET /api/settings/calendar': () => ({ body: { weekendDays: [0, 6], holidays: [] } }),
  };
}

describe('EditPhasesPage', () => {
  it('shows the saved phases and sub-phases', async () => {
    mockFetch(baseRoutes());
    renderPage();
    expect(await screen.findByLabelText('Phase 1 name')).toHaveDisplayValue('Requirements gathering');
    expect(screen.getByLabelText('Phase 2 name')).toHaveDisplayValue('Development');
    expect(screen.getByLabelText('Phase 2 sub-phase 1 name')).toHaveValue('Increment 1');
    expect(screen.getByLabelText('Phase 2 sub-phase 2 name')).toHaveValue('Increment 2');
  });

  it('shows phase 2 working days derived from its sub-phases', async () => {
    mockFetch(baseRoutes());
    renderPage();
    expect(await screen.findByLabelText('Phase 2 working days')).toHaveTextContent('10 working days (from sub-phases)');
  });

  it('adds a sub-phase to phase 2 and saves it with no id', async () => {
    const fetchMock = mockFetch({
      ...baseRoutes(),
      'PUT /api/projects/1/schedule': () => ({ body: { project: project(), addedPhaseIds: [] } }),
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByLabelText('Phase 2 sub-phase 1 name');

    await user.click(screen.getByRole('button', { name: 'Add sub-phase to phase 2' }));
    await user.type(screen.getByLabelText('Phase 2 sub-phase 3 name'), 'Increment 3');
    const days = screen.getByLabelText('Phase 2 sub-phase 3 working days');
    await user.clear(days);
    await user.type(days, '4');

    await user.click(screen.getByRole('button', { name: 'Save phases' }));

    expect(await screen.findByText('Project page')).toBeInTheDocument();
    const put = fetchMock.mock.calls.find(([url, init]) => url === '/api/projects/1/schedule' && init?.method === 'PUT');
    const sent = JSON.parse(put![1]!.body as string);
    const dev = sent.phases.find((p: { id?: number }) => p.id === 12);
    expect(dev.id).toBe(12);
    expect(dev.subPhases).toEqual([
      { id: 21, name: 'Increment 1', durationDays: 5, withPrevious: false },
      { id: 22, name: 'Increment 2', durationDays: 5, withPrevious: false },
      { name: 'Increment 3', durationDays: 4, withPrevious: false },
    ]);
  });

  it('warns before removing a sub-phase that has people, and saves after confirming', async () => {
    const fetchMock = mockFetch({
      ...baseRoutes(),
      'PUT /api/projects/1/schedule': () => ({ body: { project: project(), addedPhaseIds: [] } }),
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByLabelText('Phase 2 sub-phase 1 name');

    await user.click(screen.getByRole('button', { name: 'Remove phase 2 sub-phase 1' }));
    await user.click(screen.getByRole('button', { name: 'Save phases' }));

    expect(await screen.findByText(/Development › Increment 1 \(1 person\)/)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url, init]) => url === '/api/projects/1/schedule' && init?.method === 'PUT')).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Save anyway' }));

    expect(await screen.findByText('Project page')).toBeInTheDocument();
    const put = fetchMock.mock.calls.find(([url, init]) => url === '/api/projects/1/schedule' && init?.method === 'PUT');
    const sent = JSON.parse(put![1]!.body as string);
    const dev = sent.phases.find((p: { id?: number }) => p.id === 12);
    expect(dev.subPhases.map((s: { id?: number }) => s.id)).toEqual([22]);
  });

  it('shows people and open to-dos when removing a sub-phase that has both, with Keep checked by default', async () => {
    mockFetch({
      ...baseRoutes([
        todo({ id: 300, title: 'A', phase: { id: 21, name: 'Development › Increment 1' } }),
        todo({ id: 301, title: 'B', phase: { id: 21, name: 'Development › Increment 1' } }),
        todo({ id: 302, title: 'C', phase: { id: 21, name: 'Development › Increment 1' }, done: true, doneDate: '2026-09-20' }),
      ]),
      'PUT /api/projects/1/schedule': () => ({ body: { project: project(), addedPhaseIds: [] } }),
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByLabelText('Phase 2 sub-phase 1 name');

    await user.click(screen.getByRole('button', { name: 'Remove phase 2 sub-phase 1' }));
    await user.click(screen.getByRole('button', { name: 'Save phases' }));

    expect(await screen.findByText('Saving will remove Development › Increment 1 (1 person, 2 open to-dos). The people on them will be unassigned.')).toBeInTheDocument();
    const keep = screen.getByRole('radio', { name: 'Keep them on the project' });
    const del = screen.getByRole('radio', { name: 'Delete them' });
    expect(keep).toBeChecked();
    expect(del).not.toBeChecked();
  });

  it('sends removedToDos: delete after choosing Delete them and Save anyway', async () => {
    const fetchMock = mockFetch({
      ...baseRoutes([
        todo({ id: 300, title: 'A', phase: { id: 21, name: 'Development › Increment 1' } }),
        todo({ id: 301, title: 'B', phase: { id: 21, name: 'Development › Increment 1' } }),
      ]),
      'PUT /api/projects/1/schedule': () => ({ body: { project: project(), addedPhaseIds: [] } }),
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByLabelText('Phase 2 sub-phase 1 name');

    await user.click(screen.getByRole('button', { name: 'Remove phase 2 sub-phase 1' }));
    await user.click(screen.getByRole('button', { name: 'Save phases' }));
    await screen.findByRole('radio', { name: 'Delete them' });
    await user.click(screen.getByRole('radio', { name: 'Delete them' }));
    await user.click(screen.getByRole('button', { name: 'Save anyway' }));

    expect(await screen.findByText('Project page')).toBeInTheDocument();
    const put = fetchMock.mock.calls.find(([url, init]) => url === '/api/projects/1/schedule' && init?.method === 'PUT');
    const sent = JSON.parse(put![1]!.body as string);
    expect(sent.removedToDos).toBe('delete');
  });

  it('starts every new warning on Keep, even after Delete them was chosen and the warning dismissed', async () => {
    mockFetch(baseRoutes([todo({ id: 300, title: 'A', phase: { id: 21, name: 'Development › Increment 1' } })]));
    const user = userEvent.setup();
    renderPage();
    await screen.findByLabelText('Phase 2 sub-phase 1 name');

    await user.click(screen.getByRole('button', { name: 'Remove phase 2 sub-phase 1' }));
    await user.click(screen.getByRole('button', { name: 'Save phases' }));
    await user.click(await screen.findByRole('radio', { name: 'Delete them' }));
    await user.click(screen.getByRole('button', { name: 'Keep editing' }));
    await user.click(screen.getByRole('button', { name: 'Save phases' }));

    expect(await screen.findByRole('radio', { name: 'Keep them on the project' })).toBeChecked();
  });

  it('warns about a removed phase with to-dos but no people, without the unassigned line', async () => {
    mockFetch({
      ...baseRoutes([
        todo({ id: 300, title: 'A', phase: { id: 11, name: 'Requirements gathering' } }),
      ]),
      'PUT /api/projects/1/schedule': () => ({ body: { project: project(), addedPhaseIds: [] } }),
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByLabelText('Phase 2 sub-phase 1 name');

    // Phase 1 (Requirements gathering) has no people assigned, only the to-do above.
    await user.click(screen.getByRole('button', { name: 'Remove phase 1' }));
    await user.click(screen.getByRole('button', { name: 'Save phases' }));

    expect(await screen.findByRole('radio', { name: 'Keep them on the project' })).toBeInTheDocument();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Saving will remove Requirements gathering (1 open to-do).');
    expect(alert).not.toHaveTextContent('unassigned');
  });

  it('moves a sub-phase down within its phase via keyboard', async () => {
    mockFetch(baseRoutes());
    renderPage();
    const handle = await screen.findByLabelText('Reorder phase 2 sub-phase 1');
    handle.focus();
    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    expect(screen.getByLabelText('Phase 2 sub-phase 1 name')).toHaveValue('Increment 2');
    expect(screen.getByLabelText('Phase 2 sub-phase 2 name')).toHaveValue('Increment 1');
  });

  it('saves a phase with a cleared working-days input after adding a sub-phase', async () => {
    const fetchMock = mockFetch({
      ...baseRoutes(),
      'PUT /api/projects/1/schedule': () => ({ body: { project: project(), addedPhaseIds: [] } }),
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByLabelText('Phase 1 name');

    // Clear phase 1's working days
    const phase1Days = screen.getByLabelText('Phase 1 working days');
    await user.clear(phase1Days);

    // Add sub-phase to phase 1
    await user.click(screen.getByRole('button', { name: 'Add sub-phase to phase 1' }));
    await user.type(screen.getByLabelText('Phase 1 sub-phase 1 name'), 'Subtask');
    const subDays = screen.getByLabelText('Phase 1 sub-phase 1 working days');
    await user.clear(subDays);
    await user.type(subDays, '3');

    // Save
    await user.click(screen.getByRole('button', { name: 'Save phases' }));

    // Verify PUT was sent successfully (no validation error)
    expect(await screen.findByText('Project page')).toBeInTheDocument();
    const put = fetchMock.mock.calls.find(([url, init]) => url === '/api/projects/1/schedule' && init?.method === 'PUT');
    expect(put).toBeDefined();
    const sent = JSON.parse(put![1]!.body as string);
    const req = sent.phases.find((p: { id?: number }) => p.id === 11);
    expect(req.durationDays).toBe(3);
  });

  it('navigates to the project with ?starter=<addedPhaseIds> when phases were added', async () => {
    mockFetch({
      ...baseRoutes(),
      'PUT /api/projects/1/schedule': () => ({ body: { project: project(), addedPhaseIds: [55] } }),
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByLabelText('Phase 1 name');

    await user.click(screen.getByRole('button', { name: 'Save phases' }));
    expect(await screen.findByText('Project page?starter=55')).toBeInTheDocument();
  });

  it('navigates to the plain project URL when no phases were added', async () => {
    mockFetch({
      ...baseRoutes(),
      'PUT /api/projects/1/schedule': () => ({ body: { project: project(), addedPhaseIds: [] } }),
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByLabelText('Phase 1 name');

    await user.click(screen.getByRole('button', { name: 'Save phases' }));
    expect(await screen.findByText('Project page')).toBeInTheDocument();
  });
});
