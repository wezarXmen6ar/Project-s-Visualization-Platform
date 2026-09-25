// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StarterSuggestion, ToDoRecord } from '../../../shared/types';
import { mockFetch, sampleProject, samplePeople, sampleToDos, sampleWorkload } from '../../testing/mockFetch';
import { ProjectPage } from './ProjectPage';

/** sampleProject with a "Development › Increment 1" sub-phase (id 120), matching sampleToDos' phase link. */
function projectWithSubPhase() {
  return sampleProject({
    phases: [
      { id: 11, name: 'Requirements', order: 0, durationDays: 2, start: '2026-09-24', end: '2026-09-25', subPhases: [] },
      {
        id: 12, name: 'Development', order: 1, durationDays: 3, start: '2026-09-28', end: '2026-09-30',
        subPhases: [{ id: 120, name: 'Increment 1', order: 0, durationDays: 3, start: '2026-09-28', end: '2026-09-30', withPrevious: false }],
      },
    ],
  });
}

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
      'GET /api/todos?projectId=1&done=include': () => ({ body: [] }),
      'GET /api/settings/me': () => ({ body: { resourceId: null, name: null } }),
    });
    renderAt('/manage/projects/1');
    expect(await screen.findByRole('heading', { name: 'Portal' })).toBeInTheDocument();
    expect(screen.getByText(/2026-09-24 → 2026-09-30/)).toBeInTheDocument();
    expect(screen.getByTestId('gantt-row-12')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Portal' }).closest('main')).toHaveClass('page-wide');
    expect(screen.getByText('24 Sep – 25 Sep')).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByText('Development')).toBeInTheDocument();
    expect(within(table).getAllByText('3')).toHaveLength(2);
    expect(within(table).getAllByText('Mon 28 Sep 2026')).toHaveLength(2);
    expect(within(table).getAllByText('Wed 30 Sep 2026')).toHaveLength(2);
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
      'GET /api/todos?projectId=1&done=include': () => ({ body: [] }),
      'GET /api/settings/me': () => ({ body: { resourceId: null, name: null } }),
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
    expect(screen.getByRole('link', { name: 'Edit phases' })).toHaveAttribute('href', '/manage/projects/1/phases');
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
      'GET /api/todos?projectId=1&done=include': () => ({ body: [] }),
      'GET /api/settings/me': () => ({ body: { resourceId: null, name: null } }),
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
      'GET /api/todos?projectId=1&done=include': () => ({ body: [] }),
      'GET /api/settings/me': () => ({ body: { resourceId: null, name: null } }),
    });
    renderAt('/manage/projects/999');
    expect(await screen.findByText('Project not found')).toBeInTheDocument();
  });

  it('edits the people on a phase, warning about overbooking before saving', async () => {
    const withTeam = sampleProject({
      phases: [{ id: 11, name: 'Requirements', order: 0, durationDays: 5, start: '2026-10-05', end: '2026-10-09', subPhases: [] }],
      assignments: [{ id: 300, phaseId: 11, resource: { id: 72, name: 'Rami Saleh' }, allocation: 50, role: 'responsible' }],
    });
    const workload = sampleWorkload();
    workload.assignments.push({
      id: 300, resourceId: 72, phaseId: 11, projectId: 1, projectName: 'Portal', phaseName: 'Requirements', topPhaseName: 'Requirements', subPhaseName: null,
      start: '2026-10-05', end: '2026-10-09', allocation: 50, role: 'responsible',
    });
    const fetchMock = mockFetch({
      'GET /api/projects/1': () => ({ body: withTeam }),
      'GET /api/settings/calendar': () => ({ body: { weekendDays: [0, 6], holidays: [] } }),
      'GET /api/todos?projectId=1&done=include': () => ({ body: [] }),
      'GET /api/settings/me': () => ({ body: { resourceId: null, name: null } }),
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
    expect(await screen.findByText('Mon 5 Oct – Fri 9 Oct: 110% booked, 80% available')).toBeInTheDocument();

    const allocation = screen.getByLabelText('Requirements allocation 1');
    await user.clear(allocation);
    await user.type(allocation, '20');
    await waitFor(() => expect(screen.queryByText(/Mon 5 Oct – Fri 9 Oct: \d+% booked/)).toBeNull());

    await user.click(screen.getByRole('button', { name: 'Save people on Requirements' }));
    expect(await screen.findByText(/20% · Responsible/)).toBeInTheDocument();
    const put = fetchMock.mock.calls.find(([url, init]) => url === '/api/phases/11/assignments' && init?.method === 'PUT');
    expect(JSON.parse(put![1]!.body as string)).toEqual({ assignments: [{ resourceId: 72, allocation: 20, role: 'responsible' }] });
  });

  it('edits the people on a sub-phase', async () => {
    const withSub = sampleProject({
      phases: [
        {
          id: 12, name: 'Development', order: 0, durationDays: 5, start: '2026-10-05', end: '2026-10-09',
          subPhases: [
            { id: 31, name: 'Increment 1', order: 0, durationDays: 5, start: '2026-10-05', end: '2026-10-09', withPrevious: false },
          ],
        },
      ],
      assignments: [{ id: 300, phaseId: 31, resource: { id: 72, name: 'Rami Saleh' }, allocation: 50, role: 'responsible' }],
    });
    const workload = sampleWorkload();
    workload.assignments.push({
      id: 300, resourceId: 72, phaseId: 31, projectId: 1, projectName: 'Portal', phaseName: 'Development › Increment 1', topPhaseName: 'Development', subPhaseName: 'Increment 1',
      start: '2026-10-05', end: '2026-10-09', allocation: 50, role: 'responsible',
    });
    const fetchMock = mockFetch({
      'GET /api/projects/1': () => ({ body: withSub }),
      'GET /api/settings/calendar': () => ({ body: { weekendDays: [0, 6], holidays: [] } }),
      'GET /api/todos?projectId=1&done=include': () => ({ body: [] }),
      'GET /api/settings/me': () => ({ body: { resourceId: null, name: null } }),
      'GET /api/resources': () => ({ body: samplePeople() }),
      'GET /api/workload': () => ({ body: workload }),
      'PUT /api/phases/31/assignments': () => ({
        body: {
          ...withSub,
          assignments: [{ id: 301, phaseId: 31, resource: { id: 72, name: 'Rami Saleh' }, allocation: 20, role: 'responsible' }],
        },
      }),
    });
    const user = userEvent.setup();
    renderAt('/manage/projects/1');

    expect(await screen.findByText('Development › Increment 1')).toBeInTheDocument();
    expect(screen.getByText(/50% · Responsible/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit people on Development › Increment 1' }));

    const allocation = screen.getByLabelText('Development › Increment 1 allocation 1');
    await user.clear(allocation);
    await user.type(allocation, '20');

    await user.click(screen.getByRole('button', { name: 'Save people on Development › Increment 1' }));
    expect(await screen.findByText(/20% · Responsible/)).toBeInTheDocument();
    const put = fetchMock.mock.calls.find(([url, init]) => url === '/api/phases/31/assignments' && init?.method === 'PUT');
    expect(JSON.parse(put![1]!.body as string)).toEqual({ assignments: [{ resourceId: 72, allocation: 20, role: 'responsible' }] });
  });

  it('shows sub-phases in the Phases table and inside their phase bar on the Gantt chart', async () => {
    mockFetch({
      'GET /api/projects/1': () => ({
        body: sampleProject({
          phases: [
            {
              id: 12, name: 'Development', order: 0, durationDays: 10, start: '2026-10-05', end: '2026-10-16',
              subPhases: [
                { id: 21, name: 'Increment 1', order: 0, durationDays: 5, start: '2026-10-05', end: '2026-10-09', withPrevious: false },
                { id: 22, name: 'Increment 2', order: 1, durationDays: 3, start: '2026-10-05', end: '2026-10-07', withPrevious: true },
                { id: 23, name: 'Increment 3', order: 2, durationDays: 5, start: '2026-10-12', end: '2026-10-16', withPrevious: false },
              ],
            },
          ],
          assignments: [{ id: 300, phaseId: 21, resource: { id: 71, name: 'Fatima Noor' }, allocation: 60, role: 'responsible' }],
        }),
      }),
      'GET /api/settings/calendar': () => ({ body: { weekendDays: [0, 6], holidays: [] } }),
      'GET /api/todos?projectId=1&done=include': () => ({ body: [] }),
      'GET /api/settings/me': () => ({ body: { resourceId: null, name: null } }),
    });
    const user = userEvent.setup();
    renderAt('/manage/projects/1');
    expect(await screen.findByText(/↳ Increment 1/)).toBeInTheDocument();
    expect(screen.getByText(/↳ Increment 2/)).toBeInTheDocument();
    expect(screen.getByText(/starts with the one above/)).toBeInTheDocument();
    expect(screen.getByText(/\(from sub-phases\)/)).toBeInTheDocument();

    expect(screen.getByTestId('gantt-row-12')).toBeInTheDocument();
    expect(screen.queryByTestId('gantt-row-21')).toBeNull();
    expect(screen.queryByTestId('gantt-row-23')).toBeNull();
    expect(screen.getByTestId('gantt-row-12-lane-1')).toBeInTheDocument();

    await user.hover(screen.getByTestId('gantt-segment-21'));
    const card = screen.getByRole('tooltip');
    expect(card).toHaveTextContent('Development › Increment 1');
    expect(card).toHaveTextContent('Mon 5 Oct 2026 – Fri 9 Oct 2026 · 5 working days');
    expect(card).toHaveTextContent('Fatima Noor · 60% · Responsible');
  });
});

describe('ProjectPage to-dos', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows my three most urgent open to-dos in Next up, in order', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-07T09:00:00'));
    const me = { id: 70, name: 'Sara Ahmed' };
    const todos = sampleToDos().map((t) => ([200, 201, 202, 204].includes(t.id) ? { ...t, assignee: me } : t));
    mockFetch({
      'GET /api/projects/1': () => ({ body: sampleProject() }),
      'GET /api/settings/calendar': () => ({ body: { weekendDays: [0, 6], holidays: [] } }),
      'GET /api/todos?projectId=1&done=include': () => ({ body: todos }),
      'GET /api/settings/me': () => ({ body: { resourceId: 70, name: 'Sara Ahmed' } }),
    });
    renderAt('/manage/projects/1');

    const card = (await screen.findByRole('heading', { name: 'My next steps' })).closest('section') as HTMLElement;
    const titles = within(card).getAllByText(/Chase the missing contract|Book the UAT room|Draft the go-live checklist/);
    expect(titles.map((el) => el.textContent)).toEqual([
      'Chase the missing contract',
      'Book the UAT room',
      'Draft the go-live checklist',
    ]);
    const overdueLabel = within(card).getByText('Overdue · Thu 1 Oct');
    expect(overdueLabel).toHaveClass('overdue');
  });

  it("shows the Settings link in Next up when I am isn't set", async () => {
    mockFetch({
      'GET /api/projects/1': () => ({ body: sampleProject() }),
      'GET /api/settings/calendar': () => ({ body: { weekendDays: [0, 6], holidays: [] } }),
      'GET /api/todos?projectId=1&done=include': () => ({ body: [] }),
      'GET /api/settings/me': () => ({ body: { resourceId: null, name: null } }),
    });
    renderAt('/manage/projects/1');

    const card = (await screen.findByRole('heading', { name: 'My next steps' })).closest('section') as HTMLElement;
    expect(within(card).getByText(/Set who you are in/)).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/manage/settings');
  });

  it('adds a to-do', async () => {
    let created: ToDoRecord[] = [];
    const fetchMock = mockFetch({
      'GET /api/projects/1': () => ({ body: projectWithSubPhase() }),
      'GET /api/settings/calendar': () => ({ body: { weekendDays: [0, 6], holidays: [] } }),
      'GET /api/todos?projectId=1&done=include': () => ({ body: created }),
      'GET /api/settings/me': () => ({ body: { resourceId: 70, name: 'Sara Ahmed' } }),
      'POST /api/projects/1/todos': (init) => {
        const input = JSON.parse(init!.body as string);
        const record: ToDoRecord = {
          id: 900, projectId: 1, projectName: 'Portal', title: input.title, note: input.note,
          assignee: { id: 70, name: 'Sara Ahmed' }, dueDate: input.dueDate, done: false, doneDate: null,
          phase: { id: 11, name: 'Requirements', phaseName: 'Requirements', subPhaseName: null }, formerPhase: null, createdAt: '2026-10-07T09:00:00.000Z',
        };
        created = [record];
        return { status: 201, body: record };
      },
    });
    const user = userEvent.setup();
    renderAt('/manage/projects/1');

    await user.click(await screen.findByRole('button', { name: 'Add to-do' }));
    await user.type(screen.getByLabelText('Title'), 'Chase the vendor');
    await user.selectOptions(screen.getByLabelText('Assigned to'), 'Me — Sara Ahmed');
    await user.selectOptions(screen.getByLabelText('Phase'), 'Requirements');
    await user.click(screen.getByRole('button', { name: 'Save to-do' }));

    expect((await screen.findAllByText('Chase the vendor')).length).toBeGreaterThan(0);
    const post = fetchMock.mock.calls.find(([url, init]) => url === '/api/projects/1/todos' && init?.method === 'POST');
    expect(JSON.parse(post![1]!.body as string)).toEqual({
      title: 'Chase the vendor', note: null, assigneeId: 70, dueDate: null, phaseId: 11, done: false,
    });
  });

  it('shows an error and sends nothing when the title is empty', async () => {
    const fetchMock = mockFetch({
      'GET /api/projects/1': () => ({ body: sampleProject() }),
      'GET /api/settings/calendar': () => ({ body: { weekendDays: [0, 6], holidays: [] } }),
      'GET /api/todos?projectId=1&done=include': () => ({ body: [] }),
      'GET /api/settings/me': () => ({ body: { resourceId: null, name: null } }),
    });
    const user = userEvent.setup();
    renderAt('/manage/projects/1');

    await user.click(await screen.findByRole('button', { name: 'Add to-do' }));
    await user.click(screen.getByRole('button', { name: 'Save to-do' }));

    expect(await screen.findByText('Write what needs doing')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url, init]) => url === '/api/projects/1/todos' && init?.method === 'POST')).toBe(false);
  });

  it('ticks a to-do as done', async () => {
    const todos = sampleToDos();
    const fetchMock = mockFetch({
      'GET /api/projects/1': () => ({ body: sampleProject() }),
      'GET /api/settings/calendar': () => ({ body: { weekendDays: [0, 6], holidays: [] } }),
      'GET /api/todos?projectId=1&done=include': () => ({ body: todos }),
      'GET /api/settings/me': () => ({ body: { resourceId: null, name: null } }),
      'PUT /api/todos/200': () => ({ body: { ...todos[0], done: true } }),
    });
    const user = userEvent.setup();
    renderAt('/manage/projects/1');

    const toDosCard = (await screen.findByRole('heading', { name: 'To-dos' })).closest('section') as HTMLElement;
    await user.click(within(toDosCard).getByLabelText('Done: Chase the missing contract'));

    const put = await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url, init]) => url === '/api/todos/200' && init?.method === 'PUT');
      expect(call).toBeTruthy();
      return call!;
    });
    expect(JSON.parse(put[1]!.body as string)).toMatchObject({ done: true });
  });

  it('shows an error when ticking a to-do fails', async () => {
    const todos = sampleToDos();
    mockFetch({
      'GET /api/projects/1': () => ({ body: sampleProject() }),
      'GET /api/settings/calendar': () => ({ body: { weekendDays: [0, 6], holidays: [] } }),
      'GET /api/todos?projectId=1&done=include': () => ({ body: todos }),
      'GET /api/settings/me': () => ({ body: { resourceId: null, name: null } }),
      'PUT /api/todos/200': () => ({ status: 500, body: { error: 'Something went wrong' } }),
    });
    const user = userEvent.setup();
    renderAt('/manage/projects/1');

    const toDosCard = (await screen.findByRole('heading', { name: 'To-dos' })).closest('section') as HTMLElement;
    await user.click(within(toDosCard).getByLabelText('Done: Chase the missing contract'));

    expect(await within(toDosCard).findByRole('alert')).toHaveTextContent('Something went wrong');
  });

  it('deletes a to-do after confirming, and does nothing on Keep', async () => {
    const todos = sampleToDos();
    const fetchMock = mockFetch({
      'GET /api/projects/1': () => ({ body: sampleProject() }),
      'GET /api/settings/calendar': () => ({ body: { weekendDays: [0, 6], holidays: [] } }),
      'GET /api/todos?projectId=1&done=include': () => ({ body: todos }),
      'GET /api/settings/me': () => ({ body: { resourceId: null, name: null } }),
      'DELETE /api/todos/200': () => ({ status: 204, body: null }),
    });
    const user = userEvent.setup();
    renderAt('/manage/projects/1');

    await screen.findByText('Chase the missing contract');
    await user.click(screen.getByRole('button', { name: 'Delete Chase the missing contract' }));
    expect(await screen.findByText('Delete this to-do?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Keep' }));
    expect(fetchMock.mock.calls.some(([url, init]) => url === '/api/todos/200' && init?.method === 'DELETE')).toBe(false);
    expect(screen.queryByText('Delete this to-do?')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Delete Chase the missing contract' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url, init]) => url === '/api/todos/200' && init?.method === 'DELETE')).toBe(true);
    });
  });

  it('reveals done to-dos on "Show N done"', async () => {
    const todos = sampleToDos();
    mockFetch({
      'GET /api/projects/1': () => ({ body: sampleProject() }),
      'GET /api/settings/calendar': () => ({ body: { weekendDays: [0, 6], holidays: [] } }),
      'GET /api/todos?projectId=1&done=include': () => ({ body: todos }),
      'GET /api/settings/me': () => ({ body: { resourceId: null, name: null } }),
    });
    const user = userEvent.setup();
    renderAt('/manage/projects/1');

    await user.click(await screen.findByRole('button', { name: 'Show 1 done' }));
    expect(screen.getByRole('button', { name: 'Hide done' })).toBeInTheDocument();
    expect(screen.getByText('Confirm the sandbox is ready')).toBeInTheDocument();
    expect(screen.getByText('Done Tue 22 Sep')).toBeInTheDocument();
  });

  it("shows Next up's due label and phase name for a to-do assigned to me with a phase", async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-25T09:00:00'));
    const me = { resourceId: 70, name: 'Sara Ahmed' };
    const todos = [
      {
        id: 200, projectId: 1, projectName: 'Portal', title: 'Task with phase', note: null,
        assignee: { id: 70, name: 'Sara Ahmed' }, dueDate: '2026-10-01', done: false, doneDate: null,
        phase: { id: 120, name: 'Increment 1', phaseName: 'Increment 1', subPhaseName: null }, formerPhase: null, createdAt: '2026-09-24T09:00:00.000Z',
      },
    ];
    mockFetch({
      'GET /api/projects/1': () => ({ body: projectWithSubPhase() }),
      'GET /api/settings/calendar': () => ({ body: { weekendDays: [0, 6], holidays: [] } }),
      'GET /api/todos?projectId=1&done=include': () => ({ body: todos }),
      'GET /api/settings/me': () => ({ body: me }),
    });
    renderAt('/manage/projects/1');

    const card = (await screen.findByRole('heading', { name: 'My next steps' })).closest('section') as HTMLElement;
    expect(within(card).getByText('Task with phase')).toBeInTheDocument();
    expect(within(card).getByText('Due Thu 1 Oct')).toBeInTheDocument();
    expect(within(card).getByText(/Increment 1/)).toBeInTheDocument();
  });

  it('shows assignee name, due label, and phase name in a to-do row meta line', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-25T09:00:00'));
    const assignee = { id: 70, name: 'Sara Ahmed' };
    const todos = [
      {
        id: 200, projectId: 1, projectName: 'Portal', title: 'Task with meta', note: null,
        assignee, dueDate: '2026-10-01', done: false, doneDate: null,
        phase: { id: 120, name: 'Increment 1', phaseName: 'Increment 1', subPhaseName: null }, formerPhase: null, createdAt: '2026-09-24T09:00:00.000Z',
      },
    ];
    mockFetch({
      'GET /api/projects/1': () => ({ body: projectWithSubPhase() }),
      'GET /api/settings/calendar': () => ({ body: { weekendDays: [0, 6], holidays: [] } }),
      'GET /api/todos?projectId=1&done=include': () => ({ body: todos }),
      'GET /api/settings/me': () => ({ body: { resourceId: null, name: null } }),
    });
    renderAt('/manage/projects/1');

    const toDosCard = (await screen.findByRole('heading', { name: 'To-dos' })).closest('section') as HTMLElement;
    const taskTitle = within(toDosCard).getByText('Task with meta');
    const parentDiv = taskTitle.closest('div') as HTMLElement;
    const metaLine = parentDiv.parentElement?.querySelector('.todo-meta') as HTMLElement;
    expect(metaLine).toBeInTheDocument();
    expect(metaLine.textContent).toContain('Sara Ahmed');
    expect(metaLine.textContent).toContain('Due Thu 1 Oct');
    expect(metaLine.textContent).toContain('Increment 1');
  });

  it('unticks a done to-do and sends PUT with done: false', async () => {
    const todos = sampleToDos();
    const fetchMock = mockFetch({
      'GET /api/projects/1': () => ({ body: sampleProject() }),
      'GET /api/settings/calendar': () => ({ body: { weekendDays: [0, 6], holidays: [] } }),
      'GET /api/todos?projectId=1&done=include': () => ({ body: todos }),
      'GET /api/settings/me': () => ({ body: { resourceId: null, name: null } }),
      'PUT /api/todos/203': () => ({ body: { ...todos[3], done: false } }),
    });
    const user = userEvent.setup();
    renderAt('/manage/projects/1');

    await user.click(await screen.findByRole('button', { name: 'Show 1 done' }));
    const toDosCard = (await screen.findByRole('heading', { name: 'To-dos' })).closest('section') as HTMLElement;
    await user.click(within(toDosCard).getByLabelText('Done: Confirm the sandbox is ready'));

    const put = await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url, init]) => url === '/api/todos/203' && init?.method === 'PUT');
      expect(call).toBeTruthy();
      return call!;
    });
    expect(JSON.parse(put[1]!.body as string)).toMatchObject({ done: false });
  });
});

describe('ProjectPage starter offer', () => {
  function projectWithUatAndDeployment() {
    return sampleProject({
      phases: [
        { id: 11, name: 'UAT', order: 0, durationDays: 2, start: '2026-09-24', end: '2026-09-25', subPhases: [] },
        { id: 12, name: 'Deployment', order: 1, durationDays: 3, start: '2026-09-28', end: '2026-09-30', subPhases: [] },
      ],
    });
  }

  function baseRoutes(suggestions: StarterSuggestion[]) {
    return {
      'GET /api/projects/1': () => ({ body: projectWithUatAndDeployment() }),
      'GET /api/settings/calendar': () => ({ body: { weekendDays: [0, 6], holidays: [] } }),
      'GET /api/todos?projectId=1&done=include': () => ({ body: [] }),
      'GET /api/settings/me': () => ({ body: { resourceId: null, name: null } }),
      'GET /api/projects/1/starter-suggestions': () => ({ body: suggestions }),
    };
  }

  it('shows suggestions grouped by phase, ticked by default, and posts only the ticked ones', async () => {
    const suggestions: StarterSuggestion[] = [
      { phaseId: 11, phaseName: 'UAT', title: 'Write test cases' },
      { phaseId: 11, phaseName: 'UAT', title: 'Get UAT sign-off' },
      { phaseId: 12, phaseName: 'Deployment', title: 'Prepare release notes' },
    ];
    const fetchMock = mockFetch({
      ...baseRoutes(suggestions),
      'POST /api/projects/1/todos/from-starters': () => ({ status: 201, body: [] }),
    });
    const user = userEvent.setup();
    renderAt('/manage/projects/1?starter=all');

    const card = (await screen.findByRole('heading', { name: 'Starter to-dos' })).closest('section') as HTMLElement;
    expect(within(card).getByRole('heading', { name: 'UAT', level: 3 })).toBeInTheDocument();
    expect(within(card).getByRole('heading', { name: 'Deployment', level: 3 })).toBeInTheDocument();
    expect(within(card).getByRole('checkbox', { name: 'Write test cases' })).toBeChecked();
    expect(within(card).getByRole('checkbox', { name: 'Get UAT sign-off' })).toBeChecked();
    expect(within(card).getByRole('button', { name: 'Add 3 to-dos' })).toBeInTheDocument();

    await user.click(within(card).getByRole('checkbox', { name: 'Get UAT sign-off' }));
    expect(within(card).getByRole('button', { name: 'Add 2 to-dos' })).toBeInTheDocument();

    await user.click(within(card).getByRole('button', { name: 'Add 2 to-dos' }));

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Starter to-dos' })).toBeNull());
    const post = fetchMock.mock.calls.find(([url, init]) => url === '/api/projects/1/todos/from-starters' && init?.method === 'POST');
    expect(JSON.parse(post![1]!.body as string)).toEqual({
      items: [
        { phaseId: 11, title: 'Write test cases' },
        { phaseId: 12, title: 'Prepare release notes' },
      ],
    });
  });

  it('Skip hides the card without posting', async () => {
    const suggestions: StarterSuggestion[] = [{ phaseId: 11, phaseName: 'UAT', title: 'Write test cases' }];
    const fetchMock = mockFetch(baseRoutes(suggestions));
    const user = userEvent.setup();
    renderAt('/manage/projects/1?starter=all');

    await screen.findByRole('heading', { name: 'Starter to-dos' });
    await user.click(screen.getByRole('button', { name: 'Skip' }));
    expect(screen.queryByRole('heading', { name: 'Starter to-dos' })).toBeNull();
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/projects/1/todos/from-starters')).toBe(false);
  });

  it('renders no card when there are no suggestions', async () => {
    mockFetch(baseRoutes([]));
    renderAt('/manage/projects/1?starter=all');
    await screen.findByRole('heading', { name: 'Portal' });
    expect(screen.queryByRole('heading', { name: 'Starter to-dos' })).toBeNull();
  });
});
