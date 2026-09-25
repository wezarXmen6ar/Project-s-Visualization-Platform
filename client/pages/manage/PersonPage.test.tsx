// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LeaveRecord, ResourceRecord, ToDoRecord, WorkloadData } from '../../../shared/types';
import type { WorkCalendar } from '../../../shared/calendar';
import { mockFetch, sampleLists, samplePeople, sampleWorkload, type MockHandler } from '../../testing/mockFetch';
import { PersonPage } from './PersonPage';

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/manage/resources" element={<div>Resources list</div>} />
        <Route path="/manage/resources/new" element={<PersonPage />} />
        <Route path="/manage/resources/:id" element={<PersonPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** A small in-memory stand-in for the people API, so reloads show changes. */
function fakeServer(calendar: WorkCalendar = { weekendDays: [0, 6], holidays: [] }): Record<string, MockHandler> {
  const people: ResourceRecord[] = samplePeople();
  let nextLeave = 900;
  const fatima = () => people.find((p) => p.id === 71)!;
  return {
    'GET /api/resources': () => ({ body: structuredClone(people) }),
    'GET /api/lists': () => ({ body: sampleLists() }),
    'GET /api/settings/calendar': () => ({ body: calendar }),
    'POST /api/resources': (init) => ({ status: 201, body: { ...people[0], ...JSON.parse(init!.body as string), id: 99 } }),
    'PUT /api/resources/72': (init) => ({ body: { ...people[2], ...JSON.parse(init!.body as string) } }),
    'DELETE /api/resources/70': () => ({
      status: 409,
      body: { error: "Sara Ahmed can't be deleted because they are a project manager on 2 projects. Make them inactive instead." },
    }),
    'POST /api/resources/71/leave': (init) => {
      const leave: LeaveRecord = { id: nextLeave++, note: null, ...JSON.parse(init!.body as string) };
      fatima().leave.push(leave);
      return { status: 201, body: leave };
    },
    'DELETE /api/leave/900': () => {
      fatima().leave = [];
      return { status: 204, body: null };
    },
    'GET /api/workload': () => ({ body: sampleWorkload() }),
    'GET /api/todos?assigneeId=70': () => ({ body: [] }),
    'GET /api/todos?assigneeId=71': () => ({ body: [] }),
    'GET /api/todos?assigneeId=72': () => ({ body: [] }),
    'GET /api/todos?assigneeId=80': () => ({ body: [] }),
  };
}

function toDo(overrides: Partial<ToDoRecord> & Pick<ToDoRecord, 'id' | 'title'>): ToDoRecord {
  return {
    projectId: 1, projectName: 'Portal', note: null, assignee: null, dueDate: null, done: false, doneDate: null,
    phase: null, formerPhase: null, createdAt: '2026-09-20T09:00:00.000Z', ...overrides,
  };
}

describe('PersonPage', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('adds a tech-team person', async () => {
    const fetchMock = mockFetch(fakeServer());
    const user = userEvent.setup();
    renderAt('/manage/resources/new');
    await user.type(screen.getByLabelText('Name'), 'Hassan Ali');
    await screen.findByRole('option', { name: 'Developer' });
    await user.selectOptions(screen.getByLabelText('Role'), 'Developer');
    await user.selectOptions(screen.getByLabelText('Specialisation'), 'Full stack');
    await user.clear(screen.getByLabelText('Capacity (%)'));
    await user.type(screen.getByLabelText('Capacity (%)'), '80');
    await user.click(screen.getByRole('button', { name: 'Add person' }));

    expect(await screen.findByText('Resources list')).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([url, init]) => url === '/api/resources' && init?.method === 'POST');
    expect(JSON.parse(post![1]!.body as string)).toMatchObject({
      name: 'Hassan Ali', side: 'tech', roleId: 63, specialisation: 'full-stack', capacity: 80, active: true,
    });
  });

  it('asks a business contact only for name, phone and email', async () => {
    const fetchMock = mockFetch(fakeServer());
    const user = userEvent.setup();
    renderAt('/manage/resources/new');
    await user.click(screen.getByRole('radio', { name: 'Business side' }));
    expect(screen.queryByLabelText('Role')).toBeNull();
    expect(screen.queryByLabelText('Capacity (%)')).toBeNull();
    await user.type(screen.getByLabelText('Name'), 'Noura Al Hammadi');
    await user.type(screen.getByLabelText('Phone (UAE mobile)'), '055 234 5678');
    await user.click(screen.getByRole('button', { name: 'Add person' }));

    expect(await screen.findByText('Resources list')).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([url, init]) => url === '/api/resources' && init?.method === 'POST');
    expect(JSON.parse(post![1]!.body as string)).toMatchObject({ name: 'Noura Al Hammadi', side: 'business', phone: '055 234 5678' });
  });

  it('shows what is wrong without saving', async () => {
    const fetchMock = mockFetch(fakeServer());
    const user = userEvent.setup();
    renderAt('/manage/resources/new');
    await user.type(screen.getByLabelText('Phone (UAE mobile)'), '04 123 4567');
    await user.click(screen.getByRole('button', { name: 'Add person' }));
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Enter a UAE mobile number, e.g. +971 50 123 4567')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('edits an existing person', async () => {
    const fetchMock = mockFetch(fakeServer());
    const user = userEvent.setup();
    renderAt('/manage/resources/72');
    expect(await screen.findByLabelText('Name')).toHaveValue('Rami Saleh');
    expect(screen.getByLabelText('Capacity (%)')).toHaveValue(80);
    await user.clear(screen.getByLabelText('Capacity (%)'));
    await user.type(screen.getByLabelText('Capacity (%)'), '100');
    await user.click(screen.getByRole('checkbox', { name: 'Active' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Resources list')).toBeInTheDocument();
    const put = fetchMock.mock.calls.find(([url, init]) => url === '/api/resources/72' && init?.method === 'PUT');
    expect(JSON.parse(put![1]!.body as string)).toMatchObject({ name: 'Rami Saleh', capacity: 100, active: false, roleId: 63 });
  });

  it('explains why someone in use cannot be deleted', async () => {
    mockFetch(fakeServer());
    const user = userEvent.setup();
    renderAt('/manage/resources/70');
    await user.click(await screen.findByRole('button', { name: 'Delete person' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Sara Ahmed can't be deleted because they are a project manager on 2 projects. Make them inactive instead.",
    );
  });

  it('books and removes leave', async () => {
    mockFetch(fakeServer());
    const user = userEvent.setup();
    renderAt('/manage/resources/71');
    expect(await screen.findByText('No leave booked.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Leave from'), { target: { value: '2026-10-12' } });
    fireEvent.change(screen.getByLabelText('Leave to'), { target: { value: '2026-10-16' } });
    await user.type(screen.getByLabelText('Note'), 'Annual leave');
    await user.click(screen.getByRole('button', { name: 'Add leave' }));
    expect(await screen.findByText('Mon 12 Oct 2026 → Fri 16 Oct 2026 · Annual leave · 5 working days')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove leave from Mon 12 Oct 2026' }));
    expect(await screen.findByText('No leave booked.')).toBeInTheDocument();
  });

  it('counts working days with a custom calendar', async () => {
    const customCalendar: WorkCalendar = { weekendDays: [5, 6], holidays: [] };
    mockFetch(fakeServer(customCalendar));
    const user = userEvent.setup();
    renderAt('/manage/resources/71');
    expect(await screen.findByText('No leave booked.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Leave from'), { target: { value: '2026-10-12' } });
    fireEvent.change(screen.getByLabelText('Leave to'), { target: { value: '2026-10-16' } });
    await user.click(screen.getByRole('button', { name: 'Add leave' }));
    expect(await screen.findByText('Mon 12 Oct 2026 → Fri 16 Oct 2026 · 4 working days')).toBeInTheDocument();
  });

  it('says when the person does not exist', async () => {
    mockFetch(fakeServer());
    renderAt('/manage/resources/999');
    expect(await screen.findByText('Person not found')).toBeInTheDocument();
  });

  it('shows what the person is working on, running first, soonest next, and not what is past', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-07T09:00:00'));
    const workload: WorkloadData = {
      calendar: { weekendDays: [0, 6], holidays: [] },
      resources: [{ id: 71, name: 'Fatima Noor', capacity: 100, leave: [] }],
      assignments: [
        {
          id: 600, resourceId: 71, phaseId: 800, projectId: 85, projectName: 'Old Project', phaseName: 'Deployment',
          start: '2026-08-01', end: '2026-08-10', allocation: 100, role: 'responsible',
        },
        {
          id: 601, resourceId: 71, phaseId: 801, projectId: 91, projectName: 'Case Management', phaseName: 'QA',
          start: '2026-10-05', end: '2026-10-09', allocation: 100, role: 'responsible',
        },
        {
          id: 602, resourceId: 71, phaseId: 802, projectId: 95, projectName: 'E-Services Mobile App',
          phaseName: 'Development › Increment 3 – Payments',
          start: '2026-11-02', end: '2026-11-20', allocation: 60, role: 'responsible',
        },
      ],
      decisions: [],
    };
    mockFetch({ ...fakeServer(), 'GET /api/workload': () => ({ body: workload }) });
    renderAt('/manage/resources/71');

    const heading = await screen.findByRole('heading', { name: 'Working on' });
    const card = heading.closest('section') as HTMLElement;
    const items = within(card).getAllByRole('listitem');
    expect(items).toHaveLength(2);

    expect(items[0]).toHaveTextContent('Case Management');
    expect(within(items[0]).getByText('Now')).toBeInTheDocument();
    expect(within(items[0]).getByRole('link', { name: 'Case Management' })).toHaveAttribute('href', '/manage/projects/91');

    expect(items[1]).toHaveTextContent('E-Services Mobile App › Development › Increment 3 – Payments');
    expect(items[1]).toHaveTextContent('Mon 2 Nov 2026 – Fri 20 Nov 2026');
    expect(items[1]).toHaveTextContent('60% · Responsible');
    expect(within(items[1]).getByRole('link', { name: 'E-Services Mobile App' })).toHaveAttribute('href', '/manage/projects/95');
    expect(within(items[1]).queryByText('Now')).toBeNull();
  });

  it('shows nothing booked when there is no upcoming work', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-07T09:00:00'));
    const empty: WorkloadData = { calendar: { weekendDays: [0, 6], holidays: [] }, resources: [], assignments: [], decisions: [] };
    mockFetch({ ...fakeServer(), 'GET /api/workload': () => ({ body: empty }) });
    renderAt('/manage/resources/71');
    const heading = await screen.findByRole('heading', { name: 'Working on' });
    const card = heading.closest('section') as HTMLElement;
    expect(within(card).getByText('Nothing booked from today on.')).toBeInTheDocument();
  });

  it("puts To-dos directly after Working on, before Leave, for a tech person", async () => {
    mockFetch(fakeServer());
    renderAt('/manage/resources/71');
    await screen.findByRole('heading', { name: 'Working on' });
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    const workingOn = headings.indexOf('Working on');
    const toDos = headings.indexOf('To-dos');
    const leave = headings.indexOf('Leave');
    expect(workingOn).toBeGreaterThanOrEqual(0);
    expect(toDos).toBeGreaterThan(workingOn);
    expect(leave).toBeGreaterThan(toDos);
  });

  it('has no Working on card for a business contact', async () => {
    mockFetch(fakeServer());
    renderAt('/manage/resources/80');
    await screen.findByLabelText('Name');
    expect(screen.queryByRole('heading', { name: 'Working on' })).toBeNull();
  });

  describe('To-dos', () => {
    it("shows a tech person's open to-dos with project links", async () => {
      mockFetch({
        ...fakeServer(),
        'GET /api/todos?assigneeId=71': () => ({
          body: [
            toDo({ id: 500, title: 'Review the API docs', dueDate: '2026-10-20' }),
            toDo({ id: 501, title: 'Done already', done: true, doneDate: '2026-09-20' }),
          ],
        }),
      });
      renderAt('/manage/resources/71');

      const heading = await screen.findByRole('heading', { name: 'To-dos' });
      const card = heading.closest('section') as HTMLElement;
      expect(within(card).getByText('Review the API docs')).toBeInTheDocument();
      expect(within(card).getByRole('link', { name: 'Portal' })).toHaveAttribute('href', '/manage/projects/1');
      expect(within(card).queryByText('Done already')).toBeNull();
    });

    it("shows a business contact's open to-dos too", async () => {
      mockFetch({
        ...fakeServer(),
        'GET /api/todos?assigneeId=80': () => ({
          body: [toDo({ id: 502, title: 'Get sign-off from the business' })],
        }),
      });
      renderAt('/manage/resources/80');

      const heading = await screen.findByRole('heading', { name: 'To-dos' });
      const card = heading.closest('section') as HTMLElement;
      expect(within(card).getByText('Get sign-off from the business')).toBeInTheDocument();
    });

    it('shows "No open to-dos." for a person with none', async () => {
      mockFetch(fakeServer());
      renderAt('/manage/resources/72');

      const heading = await screen.findByRole('heading', { name: 'To-dos' });
      const card = heading.closest('section') as HTMLElement;
      expect(within(card).getByText('No open to-dos.')).toBeInTheDocument();
    });
  });

  it('shows the to-do linked to a sub-phase under its assignment item in Working on', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-07T09:00:00'));
    const workload: WorkloadData = {
      calendar: { weekendDays: [0, 6], holidays: [] },
      resources: [{ id: 71, name: 'Fatima Noor', capacity: 100, leave: [] }],
      assignments: [
        {
          id: 602, resourceId: 71, phaseId: 802, projectId: 95, projectName: 'E-Services Mobile App',
          phaseName: 'Development › Increment 3 – Payments',
          start: '2026-11-02', end: '2026-11-20', allocation: 60, role: 'responsible',
        },
      ],
      decisions: [],
    };
    mockFetch({
      ...fakeServer(),
      'GET /api/workload': () => ({ body: workload }),
      'GET /api/todos?assigneeId=71': () => ({
        body: [toDo({
          id: 503, title: "Review the payment provider's API documentation", dueDate: '2026-12-18',
          projectId: 95, projectName: 'E-Services Mobile App', phase: { id: 802, name: 'Development › Increment 3 – Payments' },
        })],
      }),
    });
    renderAt('/manage/resources/71');

    const heading = await screen.findByRole('heading', { name: 'Working on' });
    const card = heading.closest('section') as HTMLElement;
    expect(within(card).getByText(/Review the payment provider's API documentation/)).toBeInTheDocument();
  });
});
