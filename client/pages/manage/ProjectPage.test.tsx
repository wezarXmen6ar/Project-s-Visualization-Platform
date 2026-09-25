// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { mockFetch, sampleProject, samplePeople, sampleWorkload } from '../../testing/mockFetch';
import { ProjectPage } from './ProjectPage';

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/manage/projects/:id" element={<ProjectPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProjectPage', () => {
  it('shows the project header, Gantt chart and phase table', async () => {
    mockFetch({
      'GET /api/projects/1': () => ({ body: sampleProject() }),
      'GET /api/settings/calendar': () => ({ body: { weekendDays: [0, 6], holidays: [] } }),
    });
    renderAt('/manage/projects/1');
    expect(await screen.findByRole('heading', { name: 'Portal' })).toBeInTheDocument();
    expect(screen.getByText(/2026-09-24 → 2026-09-30/)).toBeInTheDocument();
    expect(screen.getByTestId('gantt-row-12')).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByText('Development')).toBeInTheDocument();
    expect(within(table).getByText('3')).toBeInTheDocument();
  });

  it('shows the classification, description and scope, with a link to edit', async () => {
    mockFetch({
      'GET /api/projects/1': () => ({
        body: sampleProject({
          priority: 'high',
          projectManager: { id: 70, name: 'Sara Ahmed' },
          mainProject: { id: 20, name: 'Digital Services' },
          category: 'strategic',
          department: { id: 30, name: 'Finance' },
          requester: { internal: true, external: true },
          beneficiary: { employees: false, customers: true },
          background: 'The portal is slow.',
          scopeItems: [
            { id: 6, kind: 'objective', text: 'Faster checkout', order: 0, dateAdded: '2026-09-24' },
            { id: 5, kind: 'scope', text: 'Online payments', order: 0, dateAdded: '2026-09-24' },
          ],
        }),
      }),
      'GET /api/settings/calendar': () => ({ body: { weekendDays: [0, 6], holidays: [] } }),
    });
    renderAt('/manage/projects/1');
    expect(await screen.findByText('Digital Services')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Sara Ahmed')).toBeInTheDocument();
    expect(screen.getByText('Strategic')).toBeInTheDocument();
    expect(screen.getByText('Finance')).toBeInTheDocument();
    expect(screen.getByText('Both (internal and external)')).toBeInTheDocument();
    expect(screen.getByText('Customers')).toBeInTheDocument();
    expect(screen.getByText('The portal is slow.')).toBeInTheDocument();
    expect(screen.getByText('Online payments')).toBeInTheDocument();
    expect(screen.getByText('Faster checkout')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit details' })).toHaveAttribute('href', '/manage/projects/1/edit');
  });

  it("shows both project managers, with the business PM's phone and email as links", async () => {
    mockFetch({
      'GET /api/projects/1': () => ({
        body: sampleProject({
          projectManager: { id: 70, name: 'Sara Ahmed' },
          businessPm: { id: 80, name: 'Mariam Al Suwaidi', phone: '+971 50 123 4567', email: 'mariam@example.com' },
        }),
      }),
      'GET /api/settings/calendar': () => ({ body: { weekendDays: [0, 6], holidays: [] } }),
    });
    renderAt('/manage/projects/1');
    expect(await screen.findByText('Mariam Al Suwaidi')).toBeInTheDocument();
    expect(screen.getByText('Project manager (tech)')).toBeInTheDocument();
    expect(screen.getByText('Sara Ahmed')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '+971 50 123 4567' })).toHaveAttribute('href', 'tel:+971501234567');
    expect(screen.getByRole('link', { name: 'mariam@example.com' })).toHaveAttribute('href', 'mailto:mariam@example.com');
  });

  it('says when a project does not exist', async () => {
    mockFetch({
      'GET /api/projects/999': () => ({ status: 404, body: { error: 'Project not found' } }),
      'GET /api/settings/calendar': () => ({ body: { weekendDays: [0, 6], holidays: [] } }),
    });
    renderAt('/manage/projects/999');
    expect(await screen.findByText('Project not found')).toBeInTheDocument();
  });

  it('edits the people on a phase, warning about overbooking before saving', async () => {
    const withTeam = sampleProject({
      phases: [{ id: 11, name: 'Requirements', order: 0, durationDays: 5, start: '2026-10-05', end: '2026-10-09' }],
      assignments: [{ id: 300, phaseId: 11, resource: { id: 72, name: 'Rami Saleh' }, allocation: 50, role: 'responsible' }],
    });
    const workload = sampleWorkload();
    workload.assignments.push({
      id: 300, resourceId: 72, phaseId: 11, projectId: 1, projectName: 'Portal', phaseName: 'Requirements',
      start: '2026-10-05', end: '2026-10-09', allocation: 50, role: 'responsible',
    });
    const fetchMock = mockFetch({
      'GET /api/projects/1': () => ({ body: withTeam }),
      'GET /api/settings/calendar': () => ({ body: { weekendDays: [0, 6], holidays: [] } }),
      'GET /api/resources': () => ({ body: samplePeople() }),
      'GET /api/workload': () => ({ body: workload }),
      'PUT /api/phases/11/assignments': () => ({
        body: { ...withTeam, assignments: [{ id: 301, phaseId: 11, resource: { id: 72, name: 'Rami Saleh' }, allocation: 20, role: 'responsible' }] },
      }),
    });
    const user = userEvent.setup();
    renderAt('/manage/projects/1');

    expect(await screen.findByText(/50% · Responsible/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit people on Requirements' }));
    // Rami (capacity 80) is also 60% on Case Management that week: 60 + 50 = 110.
    expect(await screen.findByText('Week of 5 Oct: 110% booked, 80% available')).toBeInTheDocument();

    const allocation = screen.getByLabelText('Requirements allocation 1');
    await user.clear(allocation);
    await user.type(allocation, '20');
    await waitFor(() => expect(screen.queryByText(/Week of 5 Oct/)).toBeNull());

    await user.click(screen.getByRole('button', { name: 'Save people on Requirements' }));
    expect(await screen.findByText(/20% · Responsible/)).toBeInTheDocument();
    const put = fetchMock.mock.calls.find(([url, init]) => url === '/api/phases/11/assignments' && init?.method === 'PUT');
    expect(JSON.parse(put![1]!.body as string)).toEqual({ assignments: [{ resourceId: 72, allocation: 20, role: 'responsible' }] });
  });
});
